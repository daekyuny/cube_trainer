import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyMove,
  applyMoves,
  centerColor,
  equal,
  FACES,
  hasWhiteCross,
  inverse,
  isSolved,
  NORMALS,
  solvedCube,
} from '../src/domain/cube/cube.ts';
import {
  EXERCISES,
  getExercise,
  guideCursor,
  isPairFormed,
  isTargetInserted,
  targetPieces,
  trainingStatus,
  TARGET_IDS,
} from '../src/domain/f2l/lessons.ts';

test('F2L-01: five teaching categories cover all twelve separated starting arrangements', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((id) => EXERCISES.filter((e) => e.id === id).length),
    [2, 2, 2, 2, 4],
  );
  const signatures = EXERCISES.map((e) => {
    const { corner, edge } = targetPieces(e.initial);
    return [...corner, ...edge]
      .map((s) => [s.position, s.normal])
      .flat()
      .join(';');
  });
  assert.equal(new Set(signatures).size, 12);
});

for (const exercise of EXERCISES) {
  test(`F2L-01/02/03: type ${exercise.id}, arrangement ${exercise.variant + 1}: legal setup, recognition, pairing and complete insertion`, () => {
    const cube = exercise.initial;
    assert.deepEqual(applyMoves(solvedCube(), exercise.setup), cube);
    assert.ok(
      isSolved(applyMoves(cube, exercise.setup.slice().reverse().map(inverse))),
    );
    assert.ok(hasWhiteCross(cube));
    assert.equal(centerColor(cube, 'F'), 'red');
    assert.equal(centerColor(cube, 'R'), 'green');
    assert.equal(centerColor(cube, 'U'), 'yellow');
    assert.equal(centerColor(cube, 'D'), 'white');
    const { corner, edge } = targetPieces(cube);
    // The corner must already be above its own slot, not somewhere else on U.
    for (const sticker of corner) assert.deepEqual(sticker.position, [1, 1, 1]);
    for (const sticker of edge)
      assert.deepEqual(
        sticker.position,
        exercise.definition.edge === 'UL' ? [-1, 1, 0] : [0, 1, -1],
      );
    const w = corner.find((s) => s.color === 'white')!;
    assert.deepEqual(
      w.normal,
      exercise.id <= 2 ? NORMALS.R : exercise.id <= 4 ? NORMALS.F : NORMALS.U,
    );
    const cornerUp = corner.find((s) => equal(s.normal, NORMALS.U))!.color;
    const edgeUp = edge.find((s) => equal(s.normal, NORMALS.U))!.color;
    assert.equal(edgeUp, exercise.definition.top);
    if (exercise.id !== 5)
      assert.equal(cornerUp === edgeUp, exercise.id === 2 || exercise.id === 3);
    assert.equal(isPairFormed(cube), false);
    assert.equal(isTargetInserted(cube), false);
    const pair = exercise.checkpoints[exercise.stages[0].end];
    assert.equal(isPairFormed(pair), true);
    assert.equal(isTargetInserted(pair), false);
    assert.equal(trainingStatus(pair), 'paired');
    for (const stage of exercise.stages) {
      const checkpoint = exercise.checkpoints[stage.end];
      assert.ok(
        hasWhiteCross(checkpoint),
        `${stage.id}: cross must be restored`,
      );
      // Existing pairs outside the target slot must also survive each stage.
      const preservedIds = solvedCube()
        .filter((s) => s.position[1] < 1 && !TARGET_IDS.includes(s.id))
        .map((s) => s.id);
      const otherBottom = checkpoint.filter((s) => preservedIds.includes(s.id));
      for (const sticker of otherBottom) {
        const face = FACES.find((f) => equal(sticker.normal, NORMALS[f]))!;
        assert.equal(sticker.color, centerColor(checkpoint, face));
      }
    }
    const ready = exercise.checkpoints[exercise.stages[1].end];
    assert.ok(isPairFormed(ready));
    const insert =
      exercise.definition.route === 'right'
        ? ([
            { face: 'U', turns: 1 },
            { face: 'R', turns: 1 },
            { face: 'U', turns: -1 },
            { face: 'R', turns: -1 },
          ] as const)
        : ([
            { face: 'U', turns: -1 },
            { face: 'L', turns: -1 },
            { face: 'U', turns: 1 },
            { face: 'L', turns: 1 },
          ] as const);
    const result = applyMoves(ready, insert);
    assert.ok(isTargetInserted(result));
    assert.ok(hasWhiteCross(result));
    assert.ok(isSolved(result));
    assert.equal(trainingStatus(result), 'inserted');
    for (
      let yaw = 0, view = pair;
      yaw < 4;
      yaw++, view = applyMove(view, { face: 'Y', turns: 1 })
    )
      assert.ok(isPairFormed(view));
  });
}

test('F2L-04: guide progresses through repeated cube states without skipping the four-move insertion', () => {
  for (const e of EXERCISES) {
    let cursor: number | null = 0;
    let cube = e.initial;
    for (let i = 0; i < e.solution.length; i++) {
      cube = applyMove(cube, e.solution[i]);
      cursor = guideCursor(e, cube, cursor);
      assert.equal(cursor, i + 1);
    }
    for (let i = e.solution.length - 1; i >= 0; i--) {
      cube = applyMove(cube, inverse(e.solution[i]));
      cursor = guideCursor(e, cube, cursor, true);
      assert.equal(cursor, i);
    }
  }
});

test('F2L-02: representative explanations agree with intermediate piece motion', () => {
  for (const id of [1, 4] as const) {
    const e = getExercise(id);
    const first = e.checkpoints[1];
    assert.ok(isPairFormed(first));
    assert.equal(hasWhiteCross(first), false);
    assert.deepEqual(
      targetPieces(first).corner[0].position,
      id === 1 ? [1, 1, -1] : [-1, 1, 1],
    );
  }
  for (const id of [2, 3] as const) {
    const e = getExercise(id);
    assert.equal(targetPieces(e.checkpoints[2]).corner[0].position[1], -1);
    assert.equal(targetPieces(e.checkpoints[2]).edge[0].position[1], 1);
  }
  const whiteUp = getExercise(5);
  const edge = targetPieces(whiteUp.checkpoints[2]).edge;
  assert.deepEqual(edge[0].position, [1, 1, 0]);
  assert.equal(edge.find((s) => equal(s.normal, NORMALS.R))!.color, 'green');
});

test('F2L-03: actual state decides success; a broken cross is never success', () => {
  const e = getExercise(1);
  assert.equal(
    trainingStatus(applyMove(e.initial, { face: 'L', turns: 1 })),
    'cross-broken',
  );
  const final = e.checkpoints.at(-1)!;
  assert.equal(
    trainingStatus(applyMove(final, { face: 'U', turns: 1 })),
    'inserted',
  );
  assert.equal(
    trainingStatus(applyMove(final, { face: 'L', turns: 1 })),
    'cross-broken',
  );
  assert.equal(
    guideCursor(e, applyMove(e.initial, { face: 'D', turns: 1 }), 0),
    null,
  );
});
