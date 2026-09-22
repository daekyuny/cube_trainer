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
import type { Cube, Move } from '../src/domain/cube/cube.ts';
import {
  EXERCISES,
  TARGET_IDS,
  areOtherSlotsSolved,
  getExercise,
  guideCursor,
  isPairFormed,
  targetPieces,
  trainingStatus,
} from '../src/domain/f2l/lessons.ts';

// Compare every non-target lower-layer sticker with its original position and
// orientation, independently of the production center-color success predicate.
const protectedStickers = solvedCube().filter(
  (s) => s.position[1] < 1 && !TARGET_IDS.includes(s.id),
);
function preservesOtherPieces(cube: Cube): boolean {
  return protectedStickers.every((original) => {
    const actual = cube.find((s) => s.id === original.id)!;
    return (
      equal(actual.position, original.position) &&
      equal(actual.normal, original.normal)
    );
  });
}

test('F2L-01/02: fixed UFR corner and UB edge, exactly the five requested orientations', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((id) => EXERCISES.filter((e) => e.id === id).length),
    [1, 1, 1, 1, 2],
  );
  const signatures = new Set<string>();
  for (const e of EXERCISES) {
    const cube = e.initial;
    assert.deepEqual(applyMoves(solvedCube(), e.setup), cube);
    assert.ok(
      isSolved(applyMoves(cube, e.setup.slice().reverse().map(inverse))),
    );
    assert.ok(hasWhiteCross(cube));
    assert.ok(preservesOtherPieces(cube));
    assert.ok(areOtherSlotsSolved(cube));
    for (const [face, color] of [
      ['F', 'red'],
      ['R', 'green'],
      ['B', 'orange'],
      ['U', 'yellow'],
      ['D', 'white'],
    ] as const)
      assert.equal(centerColor(cube, face), color);
    const { corner, edge } = targetPieces(cube);
    assert.deepEqual(corner.map((s) => s.color).sort(), [
      'green',
      'red',
      'white',
    ]);
    assert.deepEqual(edge.map((s) => s.color).sort(), ['green', 'red']);
    for (const s of corner) assert.deepEqual(s.position, [1, 1, 1]);
    for (const s of edge) assert.deepEqual(s.position, [0, 1, -1]);
    const white = corner.find((s) => s.color === 'white')!;
    assert.deepEqual(
      white.normal,
      e.id <= 2 ? NORMALS.R : e.id <= 4 ? NORMALS.F : NORMALS.U,
    );
    assert.deepEqual(white.normal, NORMALS[e.definition.whiteFace]);
    const topC = corner.find((s) => equal(s.normal, NORMALS.U))!.color;
    const topE = edge.find((s) => equal(s.normal, NORMALS.U))!.color;
    assert.equal(topE, e.definition.top);
    if (e.id !== 5) assert.equal(topC === topE, e.id === 2 || e.id === 4);
    else assert.equal(topC, 'white');
    signatures.add(
      [...corner, ...edge]
        .map((s) => [s.position, s.normal])
        .flat()
        .join(';'),
    );
    assert.equal(trainingStatus(cube), 'working');
  }
  assert.equal(signatures.size, 6);
});

// Exhaust all shorter outer-face sequences, counting 180 degrees as one move.
// This checks the result itself, independently of the catalog's algorithms.
function canPairWithin(
  cube: Cube,
  remaining: number,
  previous?: Move['face'],
): boolean {
  if (isPairFormed(cube) && preservesOtherPieces(cube)) return true;
  if (!remaining) return false;
  for (const face of FACES) {
    if (face === previous) continue; // consecutive turns of one face combine
    for (const turns of [1, -1, 2] as const) {
      if (canPairWithin(applyMove(cube, { face, turns }), remaining - 1, face))
        return true;
    }
  }
  return false;
}

for (const e of EXERCISES) {
  test(`F2L-03/06: case ${e.id}/${e.variant}: shortest pair preserves the cross and all three other corners/edges`, () => {
    assert.equal(e.stages.length, 1);
    assert.equal(e.stages[0].id, 'pair');
    assert.ok(e.solution.every((m) => m.face !== 'Y'));
    const final = applyMoves(e.initial, e.solution);
    assert.ok(isPairFormed(final));
    assert.ok(hasWhiteCross(final));
    assert.ok(preservesOtherPieces(final));
    assert.ok(areOtherSlotsSolved(final));
    for (const original of protectedStickers) {
      const before = e.initial.find((s) => s.id === original.id)!;
      const after = final.find((s) => s.id === original.id)!;
      assert.deepEqual(after, before, `preserve ${original.id}`);
    }
    assert.equal(trainingStatus(final), 'paired');
    for (const piece of Object.values(targetPieces(final)))
      for (const s of piece) assert.equal(s.position[1], 1);
    assert.equal(isSolved(final), false);
    assert.equal(
      canPairWithin(e.initial, e.definition.pair.split(' ').length - 1),
      false,
    );
    for (let i = 1; i < e.checkpoints.length - 1; i++)
      assert.notEqual(trainingStatus(e.checkpoints[i]), 'paired');
    let cube = final;
    for (let yaw = 0; yaw < 4; yaw++) {
      assert.equal(trainingStatus(cube), 'paired');
      cube = applyMove(cube, { face: 'Y', turns: 1 });
    }
  });
}

test('F2L-04: guide follows every manual quarter turn and undo, including U2', () => {
  for (const e of EXERCISES) {
    let cube = e.initial;
    let cursor: number | null = 0;
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
    assert.equal(
      guideCursor(e, applyMove(e.initial, { face: 'D', turns: 1 }), 0),
      null,
    );
  }
});

test('F2L-07: case 1 connects after R but restores the cross without inserting the pair', () => {
  const e = getExercise(1);
  assert.ok(isPairFormed(e.checkpoints[1]));
  assert.equal(trainingStatus(e.checkpoints[1]), 'pair-cross-broken');
  assert.equal(trainingStatus(e.checkpoints.at(-1)!), 'paired');
  const inserted = applyMoves(e.initial, [
    { face: 'R', turns: 1 },
    { face: 'U', turns: 1 },
    { face: 'R', turns: -1 },
  ]);
  assert.ok(isSolved(inserted));
  assert.equal(trainingStatus(inserted), 'working'); // slot insertion is not the lesson goal
});

test('F2L-02: hints agree with actual piece motion', () => {
  for (const id of [2, 4] as const)
    assert.equal(
      targetPieces(getExercise(id).checkpoints[2]).corner[0].position[1],
      -1,
    );
  const third = getExercise(3);
  assert.deepEqual(
    targetPieces(third.checkpoints[1]).corner[0].position,
    [1, 1, -1],
  );
  assert.equal(targetPieces(third.checkpoints[3]).corner[0].position[1], -1);
  for (const cube of third.checkpoints.slice(1))
    assert.deepEqual(targetPieces(cube).edge[0].position, [-1, 1, 0]);
  for (const variant of [0, 1])
    assert.equal(
      targetPieces(getExercise(5, variant).checkpoints[variant === 0 ? 2 : 3])
        .edge[0].position[1],
      0,
    );
});

test('F2L-09: reject the former answers that pair on Y and restore the cross but break another corner', () => {
  const former = [
    [2, 0, "R' U2 R"],
    [3, 0, "F' L F L'"],
    [4, 0, "F U F'"],
    [5, 0, "B U2 B'"],
    [5, 1, "B' U' B"],
  ] as const;
  const brokenCorners = new Set<string>();
  for (const [id, variant, algorithm] of former) {
    const moves: Move[] = algorithm.split(' ').map((token) => ({
      face: token[0] as Move['face'],
      turns: token.endsWith('2') ? 2 : token.endsWith("'") ? -1 : 1,
    }));
    let cube = applyMoves(getExercise(id, variant).initial, moves);
    assert.ok(isPairFormed(cube));
    assert.ok(hasWhiteCross(cube));
    assert.equal(preservesOtherPieces(cube), false);
    for (const original of protectedStickers.filter(
      (s) =>
        s.color === 'white' &&
        Math.abs(s.position[0]) === 1 &&
        Math.abs(s.position[2]) === 1,
    )) {
      const actual = cube.find((s) => s.id === original.id)!;
      if (
        !equal(original.position, actual.position) ||
        !equal(original.normal, actual.normal)
      )
        brokenCorners.add(original.id);
    }
    for (let yaw = 0; yaw < 4; yaw++) {
      assert.equal(areOtherSlotsSolved(cube), false);
      assert.equal(trainingStatus(cube), 'slots-disturbed');
      cube = applyMove(cube, { face: 'Y', turns: 1 });
    }
  }
  assert.equal(
    brokenCorners.size,
    3,
    'regression exercises damage each of the three protected corners',
  );
});
