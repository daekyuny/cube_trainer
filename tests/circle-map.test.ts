import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACES,
  NORMALS,
  ROTATIONS,
  SLICES,
  WIDE_FACES,
  applyMove,
  applyMoves,
  solvedCube,
} from '../src/domain/cube/cube.ts';
import type { Axis, Cube, Move, Vec3 } from '../src/domain/cube/cube.ts';
import {
  RINGS,
  activeTurn,
  layoutSpots,
  moveSymbol,
  stickerPoint,
} from '../src/features/simulator/circleMap.ts';
import type { Point } from '../src/features/simulator/circleMap.ts';

const ALL_MOVES: Move[] = [
  ...FACES,
  ...SLICES,
  ...ROTATIONS,
  ...WIDE_FACES,
].flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns }) as Move),
);
const scrambled = applyMoves(
  solvedCube(),
  ['R', 'U', 'F', 'D', 'L', 'B', 'M', 'R', 'E', 'S', 'U', 'X'].map(
    (face, index) =>
      ({
        face,
        turns: index % 3 === 0 ? -1 : 1,
      }) as Move,
  ),
);
const axisOf = (vector: Vec3) =>
  vector.findIndex((value) => value !== 0) as Axis;
const ring = (axis: Axis, layer: number) =>
  RINGS.find((r) => r.axis === axis && r.layer === layer)!;
const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const byId = (cube: Cube, move?: Move, progress = 0) =>
  new Map(layoutSpots(cube, move, progress).map((s) => [s.id, s.point]));

test('CIRCLE-01: every sticker sits where the rings of its two in-face axes cross', () => {
  assert.equal(RINGS.length, 9);
  for (const sticker of scrambled) {
    const point = stickerPoint(sticker.position, sticker.normal);
    for (const axis of [0, 1, 2] as Axis[]) {
      if (axis === axisOf(sticker.normal)) continue;
      const { center, radius } = ring(axis, sticker.position[axis]);
      assert.ok(Math.abs(distance(point, center) - radius) < 1e-9);
    }
  }
  // Distinct, non-overlapping dots (radius 8).
  const points = layoutSpots(solvedCube()).map((s) => s.point);
  for (let a = 0; a < points.length; a++)
    for (let b = a + 1; b < points.length; b++)
      assert.ok(distance(points[a], points[b]) >= 16);
});

test('CIRCLE-01: visible faces form the inner triangle, each ring axis centred on one', () => {
  const center = (face: keyof typeof NORMALS) =>
    stickerPoint(NORMALS[face], NORMALS[face]);
  assert.deepEqual(center('R'), ring(0, 0).center);
  assert.deepEqual(center('U'), ring(1, 0).center);
  assert.deepEqual(center('F'), ring(2, 0).center);
  const middle: Point = [
    (center('R')[0] + center('U')[0] + center('F')[0]) / 3,
    (center('R')[1] + center('U')[1] + center('F')[1]) / 3,
  ];
  for (const [inner, outer] of [
    ['U', 'D'],
    ['F', 'B'],
    ['R', 'L'],
  ] as const)
    assert.ok(
      distance(center(outer), middle) > 1.5 * distance(center(inner), middle),
    );
  // Up is up: U above F/R, D below them.
  assert.ok(center('U')[1] < center('F')[1] && center('D')[1] > center('F')[1]);
});

test('CIRCLE-02: a turn starts and ends exactly on the cube states', () => {
  for (const move of ALL_MOVES) {
    const start = byId(scrambled);
    const end = byId(applyMove(scrambled, move));
    for (const [id, point] of byId(scrambled, move, 0))
      assert.ok(distance(point, start.get(id)!) < 1e-9, `${moveSymbol(move)}`);
    for (const [id, point] of byId(scrambled, move, 1))
      assert.ok(distance(point, end.get(id)!) < 1e-9, `${moveSymbol(move)}`);
  }
});

test('CIRCLE-02: mid-turn, layer stickers slide on their ring the way the arrow points; others stay', () => {
  for (const move of ALL_MOVES) {
    const turn = activeTurn(move);
    const axis = turn.rings[0].axis;
    const start = byId(scrambled);
    for (const progress of [0.1, 0.5, 0.9]) {
      const now = byId(scrambled, move, progress);
      for (const sticker of scrambled) {
        const before = start.get(sticker.id)!;
        const point = now.get(sticker.id)!;
        const moving = turn.rings.some(
          (r) => r.layer === sticker.position[axis],
        );
        if (!moving) {
          assert.ok(distance(point, before) < 1e-9);
          continue;
        }
        if (axisOf(sticker.normal) === axis) continue; // the face spins in place
        const { center, radius } = ring(axis, sticker.position[axis]);
        assert.ok(Math.abs(distance(point, center) - radius) < 1e-9);
        if (progress !== 0.1) continue;
        const angle = (p: Point) =>
          Math.atan2(p[1] - center[1], p[0] - center[0]);
        const step = angle(point) - angle(before);
        assert.equal(
          Math.sign(Math.atan2(Math.sin(step), Math.cos(step))),
          turn.direction,
          moveSymbol(move),
        );
      }
    }
  }
});

test('CIRCLE-02: the turning face spins about its own centre', () => {
  const spin = byId(solvedCube(), { face: 'U', turns: 1 }, 0.5);
  assert.deepEqual(spin.get('U:0:0'), stickerPoint([0, 1, 0], [0, 1, 0]));
  const corner = spin.get('U:1:1')!;
  assert.ok(distance(corner, stickerPoint([1, 1, 1], [0, 1, 0])) > 5);
});

test('CIRCLE-03: active rings and symbols per move kind', () => {
  const rings = (move: Move) =>
    activeTurn(move)
      .rings.map((r) => `${r.axis}:${r.layer}`)
      .sort();
  assert.deepEqual(rings({ face: 'R', turns: 1 }), ['0:1']);
  assert.deepEqual(rings({ face: 'L', turns: 1 }), ['0:-1']);
  assert.deepEqual(rings({ face: 'M', turns: -1 }), ['0:0']);
  assert.deepEqual(rings({ face: 'r', turns: 1 }), ['0:0', '0:1']);
  assert.deepEqual(rings({ face: 'D', turns: 2 }), ['1:-1']);
  assert.deepEqual(rings({ face: 'X', turns: 1 }), ['0:-1', '0:0', '0:1']);
  // Faces are drawn as seen from outside, so a visible face's clockwise
  // turn runs clockwise on screen; the opposite hidden layer runs the other way.
  for (const face of ['U', 'F', 'R'] as const) {
    assert.equal(activeTurn({ face, turns: 1 }).direction, 1);
    assert.equal(activeTurn({ face, turns: -1 }).direction, -1);
  }
  assert.equal(activeTurn({ face: 'D', turns: 1 }).direction, -1);
  assert.deepEqual(
    [
      { face: 'R', turns: -1 },
      { face: 'U', turns: 2 },
      { face: 'X', turns: 1 },
      { face: 'Y', turns: -1 },
      { face: 'M', turns: 1 },
      { face: 'f', turns: 1 },
    ].map((move) => moveSymbol(move as Move)),
    ['R′', 'U2', 'x', 'y′', 'M', 'f'],
  );
});
