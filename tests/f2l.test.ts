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
    assert.deepEqual(w.normal, NORMALS[exercise.definition.whiteFace]);
    const cornerUp = corner.find((s) => equal(s.normal, NORMALS.U))!.color;
    const edgeUp = edge.find((s) => equal(s.normal, NORMALS.U))!.color;
    assert.equal(edgeUp, exercise.definition.top);
    if (exercise.id !== 5)
      assert.equal(cornerUp === edgeUp, exercise.id === 2 || exercise.id === 3);
    assert.equal(isPairFormed(cube), false);
    assert.equal(isTargetInserted(cube), false);
    const pair =
      exercise.checkpoints[
        exercise.definition.direct
          ? exercise.definition.route === 'left'
            ? 2
            : 1
          : exercise.stages[0].end
      ];
    assert.equal(isPairFormed(pair), true);
    assert.equal(isTargetInserted(pair), false);
    assert.equal(
      trainingStatus(pair),
      exercise.definition.direct ? 'cross-broken' : 'paired',
    );
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
    const ready =
      exercise.checkpoints[
        exercise.definition.direct
          ? exercise.definition.route === 'left'
            ? 2
            : 1
          : exercise.stages[1].end
      ];
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
    const result = exercise.definition.direct
      ? exercise.checkpoints.at(-1)!
      : applyMoves(ready, insert);
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
  for (const variant of [0, 1]) {
    const e = getExercise(1, variant);
    const first = e.checkpoints[variant === 1 ? 2 : 1];
    assert.ok(isPairFormed(first));
    assert.equal(hasWhiteCross(first), false);
    assert.deepEqual(
      targetPieces(first).corner[0].position,
      variant === 0 ? [1, 1, -1] : [-1, 1, -1],
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

test('F2L-06: case 1 finishes in R U R-prime; the left mirror finishes in L-prime U-prime L', () => {
  const e = getExercise(1);
  const right = [
    { face: 'R', turns: 1 },
    { face: 'U', turns: 1 },
    { face: 'R', turns: -1 },
  ] as const;
  assert.deepEqual(e.solution, right);
  assert.equal(e.stages.length, 1);
  assert.equal(e.stages[0].end, 3);
  assert.equal(trainingStatus(applyMoves(e.initial, right)), 'inserted');
  assert.ok(isSolved(applyMoves(e.initial, right)));
  // A different edge position is not covered by the representative shortcut.
  assert.equal(
    isTargetInserted(applyMoves(getExercise(4, 1).initial, right)),
    false,
  );
  const left = [
    { face: 'L', turns: -1 },
    { face: 'U', turns: -1 },
    { face: 'L', turns: 1 },
  ] as const;
  const mirror = applyMoves(solvedCube(), left.slice().reverse().map(inverse));
  const corner = mirror.filter((s) => equal(s.position, [-1, 1, 1]));
  assert.equal(corner.find((s) => equal(s.normal, NORMALS.L))!.color, 'white');
  assert.equal(
    corner.find((s) => equal(s.normal, NORMALS.F))!.color,
    centerColor(mirror, 'F'),
  );
  const edge = mirror.filter((s) => equal(s.position, [0, 1, -1]));
  assert.equal(edge.find((s) => equal(s.normal, NORMALS.U))!.color, 'red');
  assert.equal(corner.find((s) => equal(s.normal, NORMALS.U))!.color, 'blue');
  assert.ok(hasWhiteCross(mirror));
  assert.ok(isSolved(applyMoves(mirror, left)));
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

test('F2L-07: case 4 has its edge behind W; the three-move shortcut inserts only the corner', () => {
  for (const variant of [0, 1]) {
    const e = getExercise(4, variant);
    const { corner, edge } = targetPieces(e.initial);
    assert.deepEqual(corner[0].position, [1, 1, 1]);
    assert.deepEqual(edge[0].position, variant === 0 ? [0, 1, -1] : [-1, 1, 0]);
    const afterThree = applyMoves(e.initial, e.solution.slice(0, 3));
    assert.ok(hasWhiteCross(afterThree));
    assert.equal(isTargetInserted(afterThree), false);
    assert.deepEqual(targetPieces(afterThree).corner[0].position, [1, -1, 1]);
    assert.equal(targetPieces(afterThree).edge[0].position[1], 1);
    assert.ok(isPairFormed(e.checkpoints[e.stages[0].end]));
    assert.equal(e.stages.length, 3);
    assert.equal(trainingStatus(e.checkpoints.at(-1)!), 'inserted');
  }
});

test('F2L-08: all variants retain five distinct geometric patterns through every horizontal rotation', () => {
  // Observe actual stickers, without relying on titles, metadata or algorithms.
  // Equality of top colors and W-to-edge opposition survive both yaw and reflection.
  const expected = [
    'different/other',
    'same/opposite',
    'same/other',
    'different/opposite',
    'white-up',
  ];
  for (const e of EXERCISES) {
    let cube = e.initial;
    for (let yaw = 0; yaw < 4; yaw++) {
      const { corner, edge } = targetPieces(cube);
      const white = corner.find((s) => s.color === 'white')!;
      const upCorner = corner.find((s) => equal(s.normal, NORMALS.U))!.color;
      const upEdge = edge.find((s) => equal(s.normal, NORMALS.U))!.color;
      const opposition = white.normal.reduce(
        (sum, n, i) => sum + n * edge[0].position[i],
        0,
      );
      const pattern =
        upCorner === 'white'
          ? 'white-up'
          : `${upCorner === upEdge ? 'same' : 'different'}/${opposition === -1 ? 'opposite' : 'other'}`;
      assert.equal(
        pattern,
        expected[e.id - 1],
        `case ${e.id}, variant ${e.variant}, yaw ${yaw}`,
      );
      cube = applyMove(cube, { face: 'Y', turns: 1 });
    }
  }
});
