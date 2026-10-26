import { useRef } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { gridLines, samplePoints } from '../../domain/scan/geometry';
import type { Hexagon, Point } from '../../domain/scan/geometry';
import type { Photo } from './photo';

const HANDLE_NAMES = [
  '가운데 꼭짓점',
  '위 꼭짓점',
  '오른쪽 위 꼭짓점',
  '오른쪽 아래 꼭짓점',
  '아래 꼭짓점',
  '왼쪽 아래 꼭짓점',
  '왼쪽 위 꼭짓점',
];

// Drag the seven corners of the outline onto the cube in the photo; the
// outline itself moves everything at once.
export function PhotoFit({
  photo,
  onChange,
}: {
  photo: Photo;
  onChange: (hexagon: Hexagon) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ handle: number; start: Point; from: Hexagon } | null>(
    null,
  );
  const { width, height, hexagon } = photo;
  const points = [hexagon.center, ...hexagon.outer];
  const size = Math.max(width, height);

  const toImage = (event: PointerEvent): Point => {
    const rect = svg.current!.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * width,
      ((event.clientY - rect.top) / rect.height) * height,
    ];
  };
  // Handle -1 moves the whole outline.
  const moved = (from: Hexagon, handle: number, dx: number, dy: number) => {
    const shift = ([x, y]: Point): Point => [
      Math.min(width, Math.max(0, x + dx)),
      Math.min(height, Math.max(0, y + dy)),
    ];
    if (handle < 0)
      return { center: shift(from.center), outer: from.outer.map(shift) };
    if (handle === 0) return { ...from, center: shift(from.center) };
    return {
      ...from,
      outer: from.outer.map((p, i) => (i === handle - 1 ? shift(p) : p)),
    };
  };
  const begin = (event: PointerEvent, handle: number) => {
    event.preventDefault();
    event.stopPropagation();
    svg.current!.setPointerCapture(event.pointerId);
    drag.current = { handle, start: toImage(event), from: hexagon };
  };
  const follow = (event: PointerEvent) => {
    if (!drag.current) return;
    const [x, y] = toImage(event);
    const {
      handle,
      start: [sx, sy],
      from,
    } = drag.current;
    onChange(moved(from, handle, x - sx, y - sy));
  };
  const end = () => {
    drag.current = null;
  };
  const nudge = (event: KeyboardEvent, handle: number) => {
    const step = size / 200;
    const delta: Record<string, Point> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    if (!delta[event.key]) return;
    event.preventDefault();
    event.stopPropagation();
    onChange(moved(hexagon, handle, ...delta[event.key]));
  };

  return (
    <div className="photo-fit">
      <img src={photo.url} alt="찍은 큐브 사진" />
      <svg
        ref={svg}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerMove={follow}
        onPointerUp={end}
        onPointerCancel={end}
        data-testid="photo-fit"
      >
        <polygon
          className="fit-area"
          points={hexagon.outer.map((p) => p.join(',')).join(' ')}
          onPointerDown={(event) => begin(event, -1)}
        />
        {gridLines(hexagon).map(([a, b], index) => (
          <line
            key={index}
            className="fit-grid"
            x1={a[0]}
            y1={a[1]}
            x2={b[0]}
            y2={b[1]}
            strokeWidth={size / 400}
          />
        ))}
        {samplePoints(hexagon).map(({ facelet, point, radius }) => (
          <circle
            key={facelet}
            className="fit-sample"
            cx={point[0]}
            cy={point[1]}
            r={radius}
            strokeWidth={size / 500}
          />
        ))}
        {points.map(([x, y], handle) => (
          <g
            key={handle}
            className="fit-handle"
            data-handle={handle}
            role="button"
            tabIndex={0}
            aria-label={`${HANDLE_NAMES[handle]} · 화살표 키로 옮기기`}
            onPointerDown={(event) => begin(event, handle)}
            onKeyDown={(event) => nudge(event, handle)}
          >
            <circle cx={x} cy={y} r={size / 22} className="fit-hit" />
            <circle
              cx={x}
              cy={y}
              r={size / 70}
              strokeWidth={size / 300}
              className="fit-dot"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
