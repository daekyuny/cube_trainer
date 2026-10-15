import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FACES, NORMALS, rotate, rotation } from '../src/domain/cube/cube.ts';
import type { Vec3 } from '../src/domain/cube/cube.ts';
import {
  COMMIT_PROGRESS,
  dragState,
  planFaceDrag,
  planYawDrag,
  progressForFraction,
  projectPoint,
  viewCamera,
} from '../src/features/simulator/gesture.ts';
import {
  createSession,
  sessionReducer,
} from '../src/features/simulator/session.ts';

const LONG = 400; // SVG units: well beyond a quarter turn.
function faceDrag(
  position: Vec3,
  face: keyof typeof NORMALS,
  delta: [number, number],
  reverse = false,
) {
  const plan = planFaceDrag(position, NORMALS[face], reverse, delta);
  return plan && dragState(plan, delta);
}

test('DRAG-01: dragging a sticker turns the layer it visibly moves with', () => {
  // Front view: F top row left = U, F right column up = R, U front row right = F.
  assert.deepEqual(faceDrag([0, 1, 1], 'F', [-LONG, 0])?.move, {
    face: 'U',
    turns: 1,
  });
  assert.deepEqual(faceDrag([1, 0, 1], 'F', [0, -LONG])?.move, {
    face: 'R',
    turns: 1,
  });
  assert.deepEqual(faceDrag([1, 0, 1], 'F', [0, LONG])?.move, {
    face: 'R',
    turns: -1,
  });
  assert.deepEqual(faceDrag([0, 1, 1], 'U', [LONG, 0])?.move, {
    face: 'F',
    turns: 1,
  });
  assert.deepEqual(faceDrag([-1, -1, 1], 'F', [LONG, 0])?.move, {
    face: 'D',
    turns: 1,
  });
  // Flipped view (white up, orange front): B top row left = D clockwise.
  assert.deepEqual(faceDrag([0, -1, -1], 'B', [-LONG, 0], true)?.move, {
    face: 'D',
    turns: 1,
  });
  // Middle layers cannot turn.
  assert.equal(faceDrag([0, 0, 1], 'F', [LONG, 0]), null);
  assert.equal(faceDrag([0, 0, 1], 'F', [0, LONG]), null);
  assert.equal(faceDrag([0, 1, 1], 'F', [0, -LONG]), null);
});

test('DRAG-02: every visible sticker moves toward the pointer for its chosen turn', () => {
  const directions: [number, number][] = [];
  for (let k = 0; k < 16; k++)
    directions.push([
      Math.cos((k * Math.PI) / 8) * 30,
      Math.sin((k * Math.PI) / 8) * 30,
    ]);
  let planned = 0;
  for (const reverse of [false, true])
    for (const face of FACES) {
      const normal = NORMALS[face];
      const camera = viewCamera(reverse);
      if (normal.reduce((sum, v, i) => sum + v * camera[i], 0) <= 0) continue;
      for (const position of [
        [-1, 0, 1],
        [0, -1, 1],
        [1, 1, 0],
        [1, 1, 1],
        [-1, -1, -1],
        [1, -1, 0],
        [0, 1, -1],
      ] as Vec3[]) {
        // Use only slots that actually lie on this face.
        const axis = normal.findIndex((v) => v !== 0);
        if (position[axis] !== normal[axis]) continue;
        for (const delta of directions) {
          const plan = planFaceDrag(position, normal, reverse, delta);
          if (!plan) continue;
          planned++;
          const { move, progress } = dragState(plan, delta);
          assert.ok(progress > 0);
          // Independent check through the engine's own rotation convention.
          const { axis: turnAxis, layer, angle } = rotation(move);
          assert.equal(turnAxis, plan.axis);
          assert.equal(layer, position[turnAxis]);
          const point = position.map(
            (v, i) => v + normal[i] * 0.5,
          ) as unknown as Vec3;
          const before = projectPoint(point, reverse);
          const after = projectPoint(
            rotate(point, turnAxis, angle * 0.01),
            reverse,
          );
          const motion = [after[0] - before[0], after[1] - before[1]];
          assert.ok(motion[0] * delta[0] + motion[1] * delta[1] > 0);
        }
      }
    }
  assert.ok(planned > 100);
});

test('DRAG-03: outside the cube a sideways drag spins the facing side with the pointer', () => {
  assert.deepEqual(dragState(planYawDrag(false), [LONG, 0]).move, {
    face: 'Y',
    turns: -1,
  });
  assert.deepEqual(dragState(planYawDrag(false), [-LONG, 0]).move, {
    face: 'Y',
    turns: 1,
  });
  // The flipped view sees the back face, so the same drag turns the other way.
  assert.deepEqual(dragState(planYawDrag(true), [LONG, 0]).move, {
    face: 'Y',
    turns: 1,
  });
});

test('DRAG-04: progress tracks the visible angle; half a turn is the commit point', () => {
  const smoothstep = (p: number) => p * p * (3 - 2 * p);
  for (let f = 0; f <= 1; f += 0.05)
    assert.ok(Math.abs(smoothstep(progressForFraction(f)) - f) < 1e-9);
  assert.equal(progressForFraction(0.5), COMMIT_PROGRESS);
  const plan = planYawDrag(false);
  // Moving along the tangent by |tangent| units is one radian of rotation.
  const length = Math.hypot(...plan.tangent);
  const at = (fraction: number) => {
    const units = ((length * Math.PI) / 2) * fraction;
    return dragState(plan, [
      (plan.tangent[0] / length) * units,
      (plan.tangent[1] / length) * units,
    ]).progress;
  };
  assert.ok(at(0.45) < COMMIT_PROGRESS);
  assert.ok(at(0.55) > COMMIT_PROGRESS);
  assert.equal(at(3), 1);
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
