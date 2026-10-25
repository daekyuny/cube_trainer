import {
  NORMALS,
  isCubeRotation,
  isTurning,
  rotate,
  rotation,
} from '../../domain/cube/cube.ts';
import type {
  Axis,
  Color,
  Cube,
  Face,
  Move,
  Vec3,
} from '../../domain/cube/cube.ts';

// A flat "circle graph" of the 54 stickers. Each axis owns three concentric
// rings (its layers) centred on its visible face: x on R, y on U, z on F. The
// three centres form an equilateral triangle, so the hidden faces B, L, D sit
// at the mirror points across its sides. Every sticker is where the rings of
// its two in-face axes cross, and a layer turn slides its stickers along that
// layer's ring while the turning face spins in place.
export type Point = readonly [number, number];
export type Ring = {
  axis: Axis;
  layer: number;
  center: Point;
  radius: number;
};
export type Spot = { id: string; color: Color; point: Point };

// Distance between ring centres, and the radius step between layers.
const SPACING = 100;
const STEP = 21;
const HEIGHT = (SPACING * Math.sqrt(3)) / 2;
// Screen y grows downward: U on top, F lower left, R lower right.
const CENTERS: Record<Axis, Point> = {
  0: [SPACING / 2, HEIGHT],
  1: [0, 0],
  2: [-SPACING / 2, HEIGHT],
};
const CENTROID: Point = [0, (HEIGHT * 2) / 3];
export const VIEW_BOX = [-188, -150, 376, 386] as const;

const axisOf = (vector: Vec3) =>
  vector.findIndex((value) => Math.abs(value) > 0.5) as Axis;
const otherAxes = (axis: Axis): [Axis, Axis] => [
  ((axis + 1) % 3) as Axis,
  ((axis + 2) % 3) as Axis,
];
const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
const minus = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]];
const angleAround = (center: Point, point: Point) =>
  Math.atan2(point[1] - center[1], point[0] - center[0]);

export const ringRadius = (layer: number) => SPACING - layer * STEP;

export const RINGS: Ring[] = ([0, 1, 2] as Axis[]).flatMap((axis) =>
  [1, 0, -1].map((layer) => ({
    axis,
    layer,
    center: CENTERS[axis],
    radius: ringRadius(layer),
  })),
);

// The point on a face (normal along `axis`, outward `sign`) whose in-face
// coordinates are `position`; non-integral coordinates give the in-between
// points used while that face spins.
function facePoint(axis: Axis, sign: number, position: Vec3): Point {
  const [i, j] = otherAxes(axis);
  const a = CENTERS[i];
  const b = CENTERS[j];
  const ra = ringRadius(position[i]);
  const rb = ringRadius(position[j]);
  const along = (ra * ra - rb * rb + SPACING * SPACING) / (2 * SPACING);
  const offset = Math.sqrt(Math.max(0, ra * ra - along * along));
  const unit = [(b[0] - a[0]) / SPACING, (b[1] - a[1]) / SPACING];
  // Two crossings mirror each other across the line between the centres:
  // the visible face takes the one on its own centre's side.
  const side = sign * Math.sign(cross(minus(b, a), minus(CENTERS[axis], a)));
  return [
    a[0] + along * unit[0] - side * offset * unit[1],
    a[1] + along * unit[1] + side * offset * unit[0],
  ];
}

export function stickerPoint(position: Vec3, normal: Vec3): Point {
  const axis = axisOf(normal);
  return facePoint(axis, Math.sign(normal[axis]), position);
}

// +1 when a positive turn about the axis moves stickers clockwise on screen
// around that axis's centre, -1 otherwise.
const ORIENTATION = ([0, 1, 2] as Axis[]).map((axis) => {
  for (const other of otherAxes(axis))
    for (const sign of [1, -1]) {
      const normal = [0, 0, 0] as [number, number, number];
      normal[other] = sign;
      const next = rotate(normal, axis, Math.PI / 2).map(
        Math.round,
      ) as unknown as Vec3;
      let delta =
        angleAround(CENTERS[axis], stickerPoint(next, next)) -
        angleAround(CENTERS[axis], stickerPoint(normal, normal));
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      // Skip the half-turn gap between the two hidden ring faces.
      if (Math.abs(delta) < 3) return Math.sign(delta);
    }
  throw new Error('ring orientation');
});

const ease = (progress: number) => progress * progress * (3 - 2 * progress);

// Sticker spots for the cube, with `move` drawn `progress` of the way.
export function layoutSpots(cube: Cube, move?: Move, progress = 0): Spot[] {
  const turn = move ? rotation(move) : null;
  return cube.map(({ id, color, position, normal }) => {
    const point = stickerPoint(position, normal);
    if (!turn || !progress || !isTurning(turn, position))
      return { id, color, point };
    const { axis, angle } = turn;
    const normalAxis = axisOf(normal);
    if (normalAxis === axis)
      return {
        id,
        color,
        point: facePoint(
          axis,
          Math.sign(normal[axis]),
          rotate(position, axis, angle * ease(progress)),
        ),
      };
    const whole = (vector: Vec3) =>
      rotate(vector, axis, angle).map(Math.round) as unknown as Vec3;
    const center = CENTERS[axis];
    const start = angleAround(center, point);
    const end = angleAround(
      center,
      stickerPoint(whole(position), whole(normal)),
    );
    // Travel the ring the way the layer turns, through the empty arc between
    // the hidden faces when that is the way.
    const turnDirection = Math.sign(angle) * ORIENTATION[axis];
    const full = 2 * Math.PI;
    let delta = (((end - start) % full) + full) % full;
    if (turnDirection < 0) delta -= full;
    const radius = ringRadius(position[axis]);
    const at = start + delta * ease(progress);
    return {
      id,
      color,
      point: [
        center[0] + radius * Math.cos(at),
        center[1] + radius * Math.sin(at),
      ],
    };
  });
}

export type ActiveTurn = {
  rings: Ring[];
  // +1 clockwise on screen, -1 counterclockwise.
  direction: number;
  // Angle of the empty arc between the two hidden faces, where the
  // direction arrow fits.
  arrowAngle: number;
};

export function activeTurn(move: Move): ActiveTurn {
  const turn = rotation(move);
  const center = CENTERS[turn.axis];
  return {
    rings: RINGS.filter(
      (ring) =>
        ring.axis === turn.axis &&
        (turn.layers === null || turn.layers.includes(ring.layer)),
    ),
    direction: Math.sign(turn.angle) * ORIENTATION[turn.axis],
    arrowAngle: angleAround(CENTROID, center),
  };
}

// Where to letter each face: just outside its sticker group.
export function faceLabelPoint(face: Face): Point {
  const center = stickerPoint(NORMALS[face], NORMALS[face]);
  const away = minus(center, CENTROID);
  const length = Math.hypot(...away);
  const reach = length + 48;
  return [
    CENTROID[0] + (away[0] / length) * reach,
    CENTROID[1] + (away[1] / length) * reach,
  ];
}

// Standard symbols here, unlike the history's arrows for y.
export function moveSymbol(move: Move): string {
  const face = isCubeRotation(move) ? move.face.toLowerCase() : move.face;
  return face + (move.turns === -1 ? '′' : move.turns === 2 ? '2' : '');
}
