import { useEffect, useRef, useState } from 'react';
import type { Dispatch, PointerEvent } from 'react';
import { NORMALS } from '../../domain/cube/cube';
import type { Face, Move, Vec3 } from '../../domain/cube/cube';
import {
  COMMIT_PROGRESS,
  dragState,
  planCubeDrag,
  planFaceDrag,
} from './gesture';
import type { DragPlan } from './gesture';
import type { Action } from './session';

type Preview = { move: Move; progress: number };
type Gesture = {
  pointerId: number;
  start: [number, number];
  // Press point in SVG units, used to pick the face held from outside.
  origin: [number, number];
  pixelsPerUnit: number;
  reverse: boolean;
  grab: { position: Vec3; normal: Vec3 } | null;
  plan: DragPlan | null;
};
// Pixels before the drag direction (and thus the turning layer) is locked.
const LOCK_DISTANCE = 8;

// Press a sticker and drag along the cube's rows or columns to turn that layer
// (outer or middle); press outside the cube and drag along the nearest face's
// grid to turn the whole cube. A release past half a turn commits through
// the common input queue; otherwise the layer springs back unchanged.
export function useCubeDrag({
  busy,
  slow,
  dispatch,
}: {
  busy: boolean;
  slow: boolean;
  dispatch: Dispatch<Action>;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const spring = useRef(0);
  const show = (next: Preview | null) => {
    previewRef.current = next;
    setPreview(next);
  };
  useEffect(() => () => cancelAnimationFrame(spring.current), []);

  const springBack = (from: Preview) => {
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const duration = reduced ? 0 : (slow ? 420 : 180) * from.progress;
    let start: number | undefined;
    const tick = (time: number) => {
      start ??= time;
      const t = duration ? Math.min(1, (time - start) / duration) : 1;
      if (t < 1) {
        show({ ...from, progress: from.progress * (1 - t) });
        spring.current = requestAnimationFrame(tick);
      } else {
        spring.current = 0;
        show(null);
      }
    };
    spring.current = requestAnimationFrame(tick);
  };

  const finish = (commit: boolean) => {
    gesture.current = null;
    const last = previewRef.current;
    if (!last) return;
    if (commit && !busy && last.progress >= COMMIT_PROGRESS) {
      dispatch({ type: 'move', move: last.move, from: last.progress });
      show(null);
    } else if (busy) show(null);
    else springBack(last);
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      busy ||
      gesture.current ||
      spring.current ||
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0)
    )
      return;
    const element = event.target as Element;
    const svg =
      element.closest<SVGSVGElement>('svg[data-view]') ??
      element
        .closest('figure')
        ?.querySelector<SVGSVGElement>('svg[data-view]') ??
      event.currentTarget.querySelector<SVGSVGElement>('svg[data-view]');
    if (!svg) return;
    const sticker = element.closest<SVGGElement>('[data-face]');
    const matrix = svg.getScreenCTM();
    const origin = matrix
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(
          matrix.inverse(),
        )
      : { x: 0, y: 0 };
    gesture.current = {
      pointerId: event.pointerId,
      start: [event.clientX, event.clientY],
      origin: [origin.x, origin.y],
      pixelsPerUnit: matrix?.a || 1,
      reverse: svg.dataset.view === 'back',
      grab: sticker
        ? {
            position: sticker.dataset
              .position!.split(',')
              .map(Number) as unknown as Vec3,
            normal: NORMALS[sticker.dataset.face as Face],
          }
        : null,
      plan: null,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (busy) {
      gesture.current = null;
      show(null);
      return;
    }
    const pixels: [number, number] = [
      event.clientX - current.start[0],
      event.clientY - current.start[1],
    ];
    const delta: [number, number] = [
      pixels[0] / current.pixelsPerUnit,
      pixels[1] / current.pixelsPerUnit,
    ];
    if (current.plan === null) {
      if (Math.hypot(...pixels) < LOCK_DISTANCE) return;
      current.plan = current.grab
        ? planFaceDrag(
            current.grab.position,
            current.grab.normal,
            current.reverse,
            delta,
          )
        : planCubeDrag(current.origin, current.reverse, delta);
    }
    show(dragState(current.plan, delta));
  };

  const onPointerEnd = (event: PointerEvent<HTMLElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) return;
    finish(event.type === 'pointerup');
  };

  return {
    preview,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onLostPointerCapture: onPointerEnd,
    },
  };
}
