import {
  FACES,
  NORMALS,
  ROTATIONS,
  rotate,
  rotation,
  SLICES,
} from '../../domain/cube/cube.ts';
import type { Axis, Face, Move, Vec3 } from '../../domain/cube/cube.ts';

// Shared by the SVG renderer and drag gestures so both use one view geometry.
const RIGHT: Vec3 = [0.91, 0, -0.415];
const UP: Vec3 = [-0.2075, 0.866, -0.455];
const CAMERA: Vec3 = [0.3594, 0.5, 0.7881];
const SCALE = 70;
export const VIEW_CENTER = [190, 180] as const;

const dot = (a: Vec3, b: Vec3) =>
  a.reduce((sum, value, index) => sum + value * b[index], 0);

// The flipped view looks from the opposite side, upside down (B/L/D visible).
export function viewCamera(reverse: boolean): Vec3 {
  return CAMERA.map((value) => (reverse ? -value : value)) as unknown as Vec3;
}

// Screen offset (SVG units, y down) of a 3D vector, without the view origin.
export function projectVector(
  vector: Vec3,
  reverse: boolean,
): [number, number] {
  return [
    dot(vector, RIGHT) * SCALE,
    -dot(vector, UP) * SCALE * (reverse ? -1 : 1),
  ];
}

export function projectPoint(point: Vec3, reverse: boolean): [number, number] {
  const [x, y] = projectVector(point, reverse);
  return [VIEW_CENTER[0] + x, VIEW_CENTER[1] + y];
}

// A drag turns one layer (outer, middle, or the whole cube when `layer` is
// null) about one axis, and the grabbed `point` should stay under the pointer.
export type DragPlan = {
  axis: Axis;
  layer: number | null;
  point: Vec3;
  reverse: boolean;
};

const unit = (axis: Axis): Vec3 =>
  [0, 1, 2].map((index) => (index === axis ? 1 : 0)) as unknown as Vec3;
const scaled = (vector: Vec3, value: number): Vec3 =>
  vector.map((v) => v * value) as unknown as Vec3;

// Express a screen drag as motion inside a face plane, in that face's grid
// directions, so the turn follows the cube's visible rows and columns.
function planOnFace(
  normal: Vec3,
  reverse: boolean,
  delta: readonly [number, number],
  point: Vec3,
  position: Vec3 | null,
): DragPlan {
  const [i, j] = ([0, 1, 2] as const).filter((axis) => normal[axis] === 0);
  const si = projectVector(unit(i), reverse);
  const sj = projectVector(unit(j), reverse);
  const det = si[0] * sj[1] - sj[0] * si[1];
  const along = [
    (delta[0] * sj[1] - sj[0] * delta[1]) / det,
    (si[0] * delta[1] - delta[0] * si[1]) / det,
  ];
  // Moving along one grid direction turns about the other in-plane axis.
  const axis = Math.abs(along[0]) >= Math.abs(along[1]) ? j : i;
  return { axis, layer: position ? position[axis] : null, point, reverse };
}

// Grabbing a sticker turns its row or column: an outer face, or M/E/S when
// the row or column runs through the middle of the cube.
export function planFaceDrag(
  position: Vec3,
  normal: Vec3,
  reverse: boolean,
  delta: readonly [number, number],
): DragPlan {
  const point = position.map(
    (value, index) => value + normal[index] * 0.5,
  ) as unknown as Vec3;
  return planOnFace(normal, reverse, delta, point, position);
}

// Outside the cube, the visible face nearest the press is "held": dragging
// along its rows or columns turns the whole cube in that direction (x/y/z).
export function planCubeDrag(
  start: readonly [number, number],
  reverse: boolean,
  delta: readonly [number, number],
): DragPlan {
  const camera = viewCamera(reverse);
  const distance = (face: Face) => {
    const [x, y] = projectPoint(scaled(NORMALS[face], 1.5), reverse);
    return Math.hypot(x - start[0], y - start[1]);
  };
  const face = FACES.filter((f) => dot(NORMALS[f], camera) > 0).sort(
    (a, b) => distance(a) - distance(b),
  )[0];
  const normal = NORMALS[face];
  return planOnFace(normal, reverse, delta, scaled(normal, 1.5), null);
}

// The renderer eases progress with smoothstep; invert it so the visible angle
// tracks the pointer and a release continues from the same frame.
export function progressForFraction(fraction: number): number {
  if (fraction <= 0) return 0;
  if (fraction >= 1) return 1;
  return 0.5 - Math.sin(Math.asin(1 - 2 * fraction) / 3);
}

// Angle (radians, within a quarter turn) that keeps the grabbed point closest
// to the pointer along its real, projected circular path.
export function followAngle(
  plan: DragPlan,
  delta: readonly [number, number],
): number {
  const origin = projectPoint(plan.point, plan.reverse);
  const target = [origin[0] + delta[0], origin[1] + delta[1]];
  const miss = (angle: number) => {
    const [x, y] = projectPoint(
      rotate(plan.point, plan.axis, angle),
      plan.reverse,
    );
    return Math.hypot(x - target[0], y - target[1]);
  };
  const step = Math.PI / 180;
  // Ties keep zero, so a drag across the path does not start a turn.
  let best = 0;
  let bestMiss = miss(0);
  const consider = (angle: number) => {
    const value = miss(angle);
    if (Math.abs(angle) <= Math.PI / 2 && value < bestMiss - 1e-9) {
      best = angle;
      bestMiss = value;
    }
  };
  for (let index = -90; index <= 90; index++) consider(index * step);
  // Refine within one degree.
  for (let fine = step / 2; fine > 1e-5; fine /= 2) {
    const center = best;
    consider(center - fine);
    consider(center + fine);
  }
  return best;
}

export function dragMove(plan: DragPlan, angle: number): Move {
  const face =
    plan.layer === null
      ? ROTATIONS[plan.axis]
      : plan.layer === 0
        ? SLICES[plan.axis]
        : FACES.find((f) => NORMALS[f][plan.axis] === plan.layer)!;
  const clockwise = rotation({ face, turns: 1 }).angle;
  return { face, turns: Math.sign(angle) === Math.sign(clockwise) ? 1 : -1 };
}

export function dragState(
  plan: DragPlan,
  delta: readonly [number, number],
): { move: Move; progress: number } {
  const angle = followAngle(plan, delta);
  return {
    move: dragMove(plan, angle),
    progress: progressForFraction(Math.abs(angle) / (Math.PI / 2)),
  };
}

// Release at or beyond the visible half turn commits; otherwise it springs back.
export const COMMIT_PROGRESS = 0.5;
