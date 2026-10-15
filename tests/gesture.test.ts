import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACES, NORMALS, rotate } from '../src/domain/cube/cube.ts';
import type { Axis, Face, Vec3 } from '../src/domain/cube/cube.ts';
import {
  COMMIT_PROGRESS,
  dragState,
  followAngle,
  planCubeDrag,
  planFaceDrag,
  progressForFraction,
  projectPoint,
  projectVector,
  viewCamera,
} from '../src/features/simulator/gesture.ts';
import {
  createSession,
  sessionReducer,
} from '../src/features/simulator/session.ts';

const unit = (axis: Axis, sign = 1): Vec3 =>
  [0, 1, 2].map((i) => (i === axis ? sign : 0)) as unknown as Vec3;
// Screen drag that follows one of the cube's grid directions (3D axis).
const along = (axis: Axis, units: number, reverse = false) =>
  projectVector(unit(axis, units), reverse);
function faceDrag(
  position: Vec3,
  face: Face,
  delta: readonly [number, number],
  reverse = false,
) {
  return dragState(planFaceDrag(position, NORMALS[face], reverse, delta), delta)
    .move;
}
const visibleFaces = (reverse: boolean) =>
  FACES.filter(
    (face) =>
      NORMALS[face].reduce((s, v, i) => s + v * viewCamera(reverse)[i], 0) > 0,
  );

test('DRAG-01: dragging along a row or column turns that row or column, middle ones included', () => {
  // Front view rows/columns: F top row left = U, F right column up = R.
  assert.deepEqual(faceDrag([0, 1, 1], 'F', along(0, -1)), {
    face: 'U',
    turns: 1,
  });
  assert.deepEqual(faceDrag([1, 0, 1], 'F', along(1, 1)), {
    face: 'R',
    turns: 1,
  });
  assert.deepEqual(faceDrag([1, 0, 1], 'F', along(1, -1)), {
    face: 'R',
    turns: -1,
  });
  // U front row to the right = F; R top row toward the front = U.
  assert.deepEqual(faceDrag([0, 1, 1], 'U', along(0, 1)), {
    face: 'F',
    turns: 1,
  });
  assert.deepEqual(faceDrag([1, 1, 0], 'R', along(2, 1)), {
    face: 'U',
    turns: 1,
  });
  // Middle rows/columns: E follows D, M follows L, S follows F.
  assert.deepEqual(faceDrag([0, 0, 1], 'F', along(0, 1)), {
    face: 'E',
    turns: 1,
  });
  assert.deepEqual(faceDrag([0, 0, 1], 'F', along(1, 1)), {
    face: 'M',
    turns: -1,
  });
  assert.deepEqual(faceDrag([0, 1, 0], 'U', along(0, 1)), {
    face: 'S',
    turns: 1,
  });
  assert.deepEqual(faceDrag([1, 0, 0], 'R', along(2, 1)), {
    face: 'E',
    turns: -1,
  });
  // Flipped view (white up, orange front): B white-side row toward L = D.
  assert.deepEqual(faceDrag([0, -1, -1], 'B', along(0, -1, true), true), {
    face: 'D',
    turns: 1,
  });
});

test('DRAG-02: every visible sticker picks the grid turn and stays under the pointer on its arc', () => {
  let checked = 0;
  for (const reverse of [false, true])
    for (const face of visibleFaces(reverse)) {
      const normal = NORMALS[face];
      const inPlane = ([0, 1, 2] as const).filter((a) => normal[a] === 0);
      for (const a of [-1, 0, 1])
        for (const b of [-1, 0, 1]) {
          const position = [0, 0, 0] as [number, number, number];
          position[inPlane[0]] = a;
          position[inPlane[1]] = b;
          position[normal.findIndex((v) => v !== 0)] = normal.find((v) => v)!;
          const point = position.map(
            (v, i) => v + normal[i] * 0.5,
          ) as unknown as Vec3;
          for (const [direction, turnAxis] of [
            [inPlane[0], inPlane[1]],
            [inPlane[1], inPlane[0]],
          ] as const)
            for (const sign of [1, -1]) {
              // A short drag along a grid line selects the perpendicular axis.
              const start = along(direction, sign * 0.15, reverse);
              const plan = planFaceDrag(position, normal, reverse, start);
              assert.equal(plan.axis, turnAxis, `${face} ${position}`);
              assert.equal(plan.layer, position[turnAxis]);
              // Moving the pointer exactly as the sticker would, the drag
              // recovers that angle: the sticker follows the finger.
              for (const degrees of [15, 40, 60, 85]) {
                const angle =
                  (Math.sign(followAngle(plan, start)) * degrees * Math.PI) /
                  180;
                const before = projectPoint(point, reverse);
                const after = projectPoint(
                  rotate(point, plan.axis, angle),
                  reverse,
                );
                const recovered = followAngle(plan, [
                  after[0] - before[0],
                  after[1] - before[1],
                ]);
                assert.ok(
                  Math.abs(recovered - angle) < 0.01,
                  `${face} ${position} ${degrees}°: ${recovered} vs ${angle}`,
                );
                checked++;
              }
            }
        }
    }
  assert.equal(checked, 2 * 3 * 9 * 4 * 4);
});

test('DRAG-03: outside the cube, dragging along the nearest face grid turns the whole cube', () => {
  const near = (face: Face, reverse = false) => {
    const [x, y] = projectPoint(
      NORMALS[face].map((v) => v * 2.4) as unknown as Vec3,
      reverse,
    );
    return [x, y] as const;
  };
  const cube = (
    face: Face,
    delta: readonly [number, number],
    reverse = false,
  ) => {
    const plan = planCubeDrag(near(face, reverse), reverse, delta);
    assert.equal(plan.layer, null);
    return dragState(plan, delta).move;
  };
  // Beside the front face: sideways = y, up/down = x.
  assert.deepEqual(cube('F', along(0, 1)), { face: 'Y', turns: -1 });
  assert.deepEqual(cube('F', along(0, -1)), { face: 'Y', turns: 1 });
  assert.deepEqual(cube('F', along(1, 1)), { face: 'X', turns: 1 });
  assert.deepEqual(cube('F', along(1, -1)), { face: 'X', turns: -1 });
  // Above the top face: along its left-right rows = z.
  assert.deepEqual(cube('U', along(0, 1)), { face: 'Z', turns: 1 });
  // x carries the top face toward the back.
  assert.deepEqual(cube('U', along(2, -1)), { face: 'X', turns: 1 });
  // Beside the right face: up = z′, toward the front = y.
  assert.deepEqual(cube('R', along(1, 1)), { face: 'Z', turns: -1 });
  assert.deepEqual(cube('R', along(2, 1)), { face: 'Y', turns: 1 });
  // The flipped view holds its visible back face.
  assert.deepEqual(cube('B', along(0, 1, true), true), {
    face: 'Y',
    turns: 1,
  });
});

test('DRAG-04: progress tracks the visible angle; half a turn is the commit point', () => {
  const smoothstep = (p: number) => p * p * (3 - 2 * p);
  for (let f = 0; f <= 1; f += 0.05)
    assert.ok(Math.abs(smoothstep(progressForFraction(f)) - f) < 1e-9);
  assert.equal(progressForFraction(0.5), COMMIT_PROGRESS);
  const position: Vec3 = [1, 0, 1];
  const point: Vec3 = [1, 0, 1.5];
  const plan = planFaceDrag(position, NORMALS.F, false, along(1, 0.2));
  const at = (degrees: number) => {
    const before = projectPoint(point, false);
    const after = projectPoint(
      rotate(point, plan.axis, (-degrees * Math.PI) / 180),
      false,
    );
    return dragState(plan, [after[0] - before[0], after[1] - before[1]])
      .progress;
  };
  assert.ok(at(40) < COMMIT_PROGRESS);
  assert.ok(at(50) > COMMIT_PROGRESS);
  // Far past the face, the turn stops at a quarter.
  assert.equal(dragState(plan, along(1, 20)).progress, 1);
  // A drag across the path does not turn anything.
  assert.equal(dragState(plan, [0, 0]).progress, 0);
});

test('DRAG-05: a committed drag resumes from its angle through the common queue', () => {
  let session = sessionReducer(createSession(), {
    type: 'move',
    move: { face: 'R', turns: 1 },
    from: 0.7,
  });
  assert.equal(session.progress, 0.7);
  assert.equal(session.queue[0].from, 0.7);
  session = sessionReducer(session, {
    type: 'frame',
    progress: 1,
    command: session.queue[0],
  });
  assert.equal(session.history.length, 1);
  assert.equal(session.progress, 0);
  // Behind another queued move it starts from zero like any input.
  session = sessionReducer(session, {
    type: 'move',
    move: { face: 'U', turns: 1 },
  });
  session = sessionReducer(session, {
    type: 'move',
    move: { face: 'R', turns: 1 },
    from: 0.8,
  });
  assert.equal(session.queue[1].from, undefined);
  assert.equal(session.progress, 0);
});
