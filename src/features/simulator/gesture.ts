import { FACES, NORMALS } from '../../domain/cube/cube.ts';
import type { Axis, Move, Vec3 } from '../../domain/cube/cube.ts';

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

// A drag turns one layer about one axis; `tangent` is the projected screen
// motion of the grabbed point per radian of positive (right-handed) rotation.
export type DragPlan = {
  axis: Axis;
  layer: number | null;
  tangent: [number, number];
};

const cross = (axis: Axis, p: Vec3): Vec3 => {
  const unit = [0, 0, 0] as [number, number, number];
  unit[axis] = 1;
  return [
    unit[1] * p[2] - unit[2] * p[1],
    unit[2] * p[0] - unit[0] * p[2],
    unit[0] * p[1] - unit[1] * p[0],
  ];
};

// Choose the turn whose sticker motion best matches the drag direction.
// Middle layers cannot turn (no slice moves), so such drags are ignored.
export function planFaceDrag(
  position: Vec3,
  normal: Vec3,
  reverse: boolean,
  delta: readonly [number, number],
): DragPlan | null {
  const point = position.map(
    (value, index) => value + normal[index] * 0.5,
  ) as unknown as Vec3;
  const length = Math.hypot(delta[0], delta[1]);
  if (!length) return null;
  const best = ([0, 1, 2] as const)
    .filter((axis) => normal[axis] === 0)
    .map((axis) => {
      const tangent = projectVector(cross(axis, point), reverse);
      const score =
        Math.abs(delta[0] * tangent[0] + delta[1] * tangent[1]) /
        (Math.hypot(tangent[0], tangent[1]) * length);
      return { axis, tangent, score };
    })
    .sort((a, b) => b.score - a.score)[0];
  if (position[best.axis] === 0) return null;
  return { axis: best.axis, layer: position[best.axis], tangent: best.tangent };
}

// Outside the cube, a drag spins the whole cube horizontally; the face that
// looks at the viewer follows the pointer.
export function planYawDrag(reverse: boolean): DragPlan {
  return {
    axis: 1,
    layer: null,
    tangent: projectVector(cross(1, [0, 0, reverse ? -1.5 : 1.5]), reverse),
  };
}

// The renderer eases progress with smoothstep; invert it so the visible angle
// tracks the pointer linearly and a release continues from the same frame.
export function progressForFraction(fraction: number): number {
  const f = Math.min(1, Math.max(0, fraction));
  return 0.5 - Math.sin(Math.asin(1 - 2 * f) / 3);
}

export function dragState(
  plan: DragPlan,
  delta: readonly [number, number],
): { move: Move; progress: number } {
  const [tx, ty] = plan.tangent;
  const angle = (delta[0] * tx + delta[1] * ty) / (tx * tx + ty * ty);
  const sign = plan.layer ?? 1;
  const turns = (angle > 0 ? -sign : sign) as 1 | -1;
  const face =
    plan.layer === null
      ? 'Y'
      : FACES.find((f) => NORMALS[f][plan.axis] === plan.layer)!;
  return {
    move: { face, turns },
    progress: progressForFraction(Math.abs(angle) / (Math.PI / 2)),
  };
}

// Release at or beyond the visible half turn commits; otherwise it springs back.
export const COMMIT_PROGRESS = 0.5;
