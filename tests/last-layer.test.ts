import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyMove,
  applyMoves,
  centerColor,
  equal,
  FACES,
  inverse,
  isSolved,
  NORMALS,
  solvedCube,
} from '../src/domain/cube/cube.ts';
import type { Cube, Move } from '../src/domain/cube/cube.ts';
import {
  getLastLayerExercise,
  LAST_LAYER_CASES,
  LAST_LAYER_EXERCISES,
  LAST_LAYER_STEPS,
  lastLayerCases,
  lastLayerStatus,
} from '../src/domain/last-layer/cases.ts';
import type { LastLayerCaseId } from '../src/domain/last-layer/cases.ts';
import {
  moveCount,
  parseAlgorithm,
  triggerName,
} from '../src/domain/training/guide.ts';
import {
  createSession,
  sessionReducer,
} from '../src/features/simulator/session.ts';

// Independent of the production predicates: every lower-two-layer sticker
// must sit at its solved position with its solved orientation.
const lowerStickers = solvedCube().filter((s) => s.position[1] < 1);
function lowerLayersIntact(cube: Cube): boolean {
  return lowerStickers.every((original) => {
    const actual = cube.find((s) => s.id === original.id)!;
    return (
      equal(actual.position, original.position) &&
      equal(actual.normal, original.normal)
    );
  });
}
const place = (p: readonly number[]) =>
  (p[2] === 1 ? 'F' : p[2] === -1 ? 'B' : '') +
  (p[0] === 1 ? 'R' : p[0] === -1 ? 'L' : '');
const faceOf = (normal: readonly number[]) =>
  FACES.find((face) => equal(NORMALS[face], normal as never))!;
const oriented = (signature: string[]) =>
  signature.filter((entry) => entry.endsWith(':U')).length;
const topYellow = (cube: Cube, corners: boolean) =>
  cube
    .filter(
      (s) =>
        s.position[1] === 1 &&
        s.color === 'yellow' &&
        Math.abs(s.position[0]) + Math.abs(s.position[2]) === (corners ? 2 : 1),
    )
    .map((s) => `${place(s.position)}:${faceOf(s.normal)}`)
    .sort();
// Top-layer side stickers, read left to right while facing each side.
function sideRow(cube: Cube, face: 'F' | 'R' | 'B' | 'L'): string[] {
  const along = { F: 0, R: 2, B: 0, L: 2 }[face];
  const sign = { F: 1, R: -1, B: -1, L: 1 }[face];
  return cube
    .filter((s) => s.position[1] === 1 && equal(s.normal, NORMALS[face]))
    .sort((a, b) => sign * (a.position[along] - b.position[along]))
    .map((s) => s.color);
}
function solveAll(cube: Cube, id: LastLayerCaseId | null): Cube {
  for (; id; id = getLastLayerExercise(id).case.next)
    cube = applyMoves(
      cube,
      parseAlgorithm(getLastLayerExercise(id).case.algorithm),
    );
  return cube;
}
function drain(session: ReturnType<typeof createSession>) {
  while (session.queue.length)
    session = sessionReducer(session, {
      type: 'frame',
      progress: 1,
      command: session.queue[0],
    });
  return session;
}

test('LL-01: 3+7 OLL and 2+4 PLL cases start legally from intact F2L with default centers', () => {
  assert.deepEqual(
    LAST_LAYER_STEPS.map(
      (step) => LAST_LAYER_CASES.filter((item) => item.step === step.id).length,
    ),
    [3, 7, 2, 4],
  );
  assert.equal(lastLayerCases('oll').length, 10);
  assert.equal(lastLayerCases('pll').length, 6);
  for (const e of LAST_LAYER_EXERCISES) {
    const moves = parseAlgorithm(e.case.algorithm);
    // Outer faces plus the video's f, M and x; x always returns with x'.
    assert.ok(
      moves.every((move) =>
        [...FACES, 'f', 'M', 'X'].includes(move.face as never),
      ),
    );
    assert.equal(e.tokens.length, moves.length);
    assert.equal(
      moves.filter((move) => move.face === 'X').length % 2,
      0,
      e.case.id,
    );
    assert.deepEqual(applyMoves(solvedCube(), e.setup), e.initial);
    assert.ok(
      isSolved(applyMoves(e.initial, e.setup.slice().reverse().map(inverse))),
    );
    assert.ok(lowerLayersIntact(e.initial), e.case.id);
    for (const [face, color] of [
      ['F', 'red'],
      ['R', 'green'],
      ['B', 'orange'],
      ['L', 'blue'],
      ['U', 'yellow'],
      ['D', 'white'],
    ] as const)
      assert.equal(centerColor(e.initial, face), color);
    assert.notEqual(lastLayerStatus(e.initial, e.case.step), 'complete');
  }
});

test('LL-02: each start shows its named case in the orientation the algorithm expects', () => {
  const edges: Partial<Record<LastLayerCaseId, string[]>> = {
    'oll-line': ['B:B', 'F:F', 'L:U', 'R:U'],
    'oll-l': ['B:B', 'F:U', 'L:L', 'R:U'],
    'oll-dot': ['B:B', 'F:F', 'L:L', 'R:R'],
  };
  const corners: Partial<Record<LastLayerCaseId, string[]>> = {
    'oll-sune': ['BL:B', 'BR:R', 'FL:U', 'FR:F'],
    'oll-antisune': ['BL:L', 'BR:B', 'FL:F', 'FR:U'],
    'oll-h': ['BL:B', 'BR:B', 'FL:F', 'FR:F'],
    'oll-pi': ['BL:L', 'BR:B', 'FL:L', 'FR:F'],
    'oll-headlights': ['BL:U', 'BR:U', 'FL:F', 'FR:F'],
    'oll-t': ['BL:B', 'BR:U', 'FL:F', 'FR:U'],
    'oll-bowtie': ['BL:U', 'BR:R', 'FL:F', 'FR:U'],
  };
  const sides = ['F', 'R', 'B', 'L'] as const;
  for (const e of LAST_LAYER_EXERCISES) {
    const { id, step } = e.case;
    const cube = e.initial;
    if (step === 'oll-edges')
      assert.deepEqual(topYellow(cube, false), edges[id]);
    if (step === 'oll-corners') {
      assert.equal(oriented(topYellow(cube, false)), 4, id);
      assert.deepEqual(topYellow(cube, true), corners[id], id);
    }
    if (step === 'pll-corners' || step === 'pll-edges')
      assert.equal(
        oriented(topYellow(cube, true)) + oriented(topYellow(cube, false)),
        8,
      );
    if (step === 'pll-corners') {
      const headlights = sides.filter((face) => {
        const row = sideRow(cube, face);
        return row[0] === row[2];
      });
      assert.deepEqual(headlights, id === 'pll-t' ? ['L'] : [], id);
    }
    if (step === 'pll-edges') {
      // Corners already solved relative to the centers; only edges differ.
      for (const face of sides) {
        const row = sideRow(cube, face);
        assert.equal(row[0], centerColor(cube, face));
        assert.equal(row[2], centerColor(cube, face));
      }
      const edgeOf = (face: (typeof sides)[number]) => sideRow(cube, face)[1];
      const expected: Record<string, Record<string, string>> = {
        'pll-ua': { F: 'R', R: 'L', B: 'B', L: 'F' },
        'pll-ub': { F: 'L', R: 'F', B: 'B', L: 'R' },
        'pll-h': { F: 'B', R: 'L', B: 'F', L: 'R' },
        'pll-z': { F: 'L', R: 'B', B: 'R', L: 'F' },
      };
      for (const face of sides)
        assert.equal(
          edgeOf(face),
          centerColor(cube, expected[id][face] as never),
          `${id} ${face}`,
        );
    }
  }
});

test('LL-03: every algorithm completes its step, keeps F2L and hands over the next case', () => {
  const order = LAST_LAYER_STEPS.map((step) => step.id);
  for (const e of LAST_LAYER_EXERCISES) {
    const done = applyMoves(e.initial, parseAlgorithm(e.case.algorithm));
    assert.deepEqual(done, e.checkpoints.at(-1));
    assert.equal(lastLayerStatus(done, e.case.step), 'complete', e.case.id);
    assert.ok(lowerLayersIntact(done));
    if (e.case.next) {
      const next = getLastLayerExercise(e.case.next);
      assert.equal(
        order.indexOf(next.case.step),
        order.indexOf(e.case.step) + 1,
      );
      assert.deepEqual(done, next.initial);
    } else {
      assert.equal(e.case.step, 'pll-edges');
      assert.ok(isSolved(done));
    }
    // Following the chain always ends with a solved cube.
    assert.ok(isSolved(solveAll(e.initial, e.case.id)));
  }
});

test('LL-04: status reads the real cube: yaw, AUF, open F2L and wrong algorithms', () => {
  for (const e of LAST_LAYER_EXERCISES) {
    let done = e.checkpoints.at(-1)!;
    for (let turn = 0; turn < 4; turn++) {
      done = applyMove(done, { face: 'Y', turns: 1 });
      assert.equal(lastLayerStatus(done, e.case.step), 'complete');
    }
    assert.equal(
      lastLayerStatus(
        applyMove(e.initial, { face: 'R', turns: 1 }),
        e.case.step,
      ),
      'f2l-open',
    );
  }
  const solvedAfterU = applyMove(solvedCube(), { face: 'U', turns: 1 });
  assert.equal(lastLayerStatus(solvedAfterU, 'pll-edges'), 'needs-auf');
  assert.equal(lastLayerStatus(solvedAfterU, 'pll-corners'), 'complete');
  // The line algorithm only turns a dot into an L shape: not a cross yet.
  const dot = getLastLayerExercise('oll-dot').initial;
  const wrong = applyMoves(dot, parseAlgorithm("F R U R' U' F'"));
  assert.equal(oriented(topYellow(wrong, false)), 2);
  assert.equal(lastLayerStatus(wrong, 'oll-edges'), 'working');
  // Sune applied to Antisune leaves corners unoriented.
  const anti = getLastLayerExercise('oll-antisune').initial;
  assert.equal(
    lastLayerStatus(
      applyMoves(anti, parseAlgorithm("R U R' U R U2 R'")),
      'oll-corners',
    ),
    'working',
  );
  // A T-perm on the diagonal case does not give headlights on every side.
  const diagonal = getLastLayerExercise('pll-y').initial;
  assert.equal(
    lastLayerStatus(
      applyMoves(
        diagonal,
        parseAlgorithm(getLastLayerExercise('pll-t').case.algorithm),
      ),
      'pll-corners',
    ),
    'working',
  );
});

test('LL-05: session guides, seeks, follows rotated views and blocks demos after completion', () => {
  for (const e of LAST_LAYER_EXERCISES) {
    let session = sessionReducer(createSession('random'), {
      type: 'last-layer',
      id: e.case.id,
    });
    assert.deepEqual(session.cube, e.initial);
    assert.deepEqual(session.setup, e.setup);
    assert.equal(session.preset, 'f2l');
    assert.deepEqual(session.lesson, {
      kind: 'last-layer',
      id: e.case.id,
      cursor: 0,
    });
    // View from the back: printed red-front moves map to the actual faces.
    for (let turn = 0; turn < 2; turn++)
      session = drain(
        sessionReducer(session, {
          type: 'move',
          move: { face: 'Y', turns: 1 },
        }),
      );
    session = drain(
      sessionReducer(session, { type: 'guide', wholeStage: true }),
    );
    assert.equal(session.lesson!.cursor, e.solution.length);
    let expected = e.checkpoints.at(-1)!;
    for (let turn = 0; turn < 2; turn++)
      expected = applyMove(expected, { face: 'Y', turns: 1 });
    assert.deepEqual(session.cube, expected);
    assert.equal(lastLayerStatus(session.cube, e.case.step), 'complete');
    assert.equal(sessionReducer(session, { type: 'guide' }), session);
    // Seek back to the start with real inverse turns, then restart exactly.
    session = drain(sessionReducer(session, { type: 'seek', cursor: 0 }));
    assert.equal(session.lesson!.cursor, 0);
    assert.notEqual(lastLayerStatus(session.cube, e.case.step), 'complete');
    session = sessionReducer(session, { type: 'restart' });
    assert.deepEqual(session.cube, e.initial);
    assert.equal(session.lesson!.cursor, 0);
  }
});

test('LL-06: manual input tracks the guide, U2 as two quarter turns, and off-path detection', () => {
  const e = getLastLayerExercise('oll-pi');
  let session = sessionReducer(createSession(), {
    type: 'last-layer',
    id: e.case.id,
  });
  const u2 = e.tokens.findIndex((token) => token.label === 'U2');
  for (const move of e.solution.slice(0, e.tokens[u2].start))
    session = drain(sessionReducer(session, { type: 'move', move }));
  assert.equal(session.lesson!.cursor, e.tokens[u2].start);
  const quarter: Move = { face: 'U', turns: 1 };
  session = drain(sessionReducer(session, { type: 'move', move: quarter }));
  assert.equal(session.lesson!.cursor, e.tokens[u2].start + 1);
  session = drain(sessionReducer(session, { type: 'move', move: quarter }));
  assert.equal(session.lesson!.cursor, e.tokens[u2].end);
  session = drain(
    sessionReducer(session, { type: 'move', move: { face: 'D', turns: 1 } }),
  );
  assert.equal(session.lesson!.cursor, null);
  assert.equal(sessionReducer(session, { type: 'guide' }), session);
  session = drain(sessionReducer(session, { type: 'undo' }));
  assert.equal(session.lesson!.cursor, e.tokens[u2].end);
  // Switching cases cancels pending input and starts the new fixed case.
  session = sessionReducer(session, { type: 'guide', wholeStage: true });
  const stale = session.queue[0];
  session = sessionReducer(session, { type: 'last-layer', id: 'pll-z' });
  assert.equal(
    sessionReducer(session, { type: 'frame', progress: 1, command: stale }),
    session,
  );
  assert.deepEqual(session.cube, getLastLayerExercise('pll-z').initial);
});

test('LL-08: grouped notation, named triggers, f / M / x steps and held views', () => {
  const groups = (id: LastLayerCaseId) => {
    const { tokens } = getLastLayerExercise(id);
    const ids = [...new Set(tokens.map((token) => token.group))].filter(
      (group) => group !== undefined,
    );
    return ids.map((group) => tokens.filter((token) => token.group === group));
  };
  // H: F, three twists, F′; the twist group is named once per repeat.
  assert.deepEqual(
    groups('oll-h').map((group) => triggerName(group)),
    ['트위스트', '트위스트', '트위스트'],
  );
  assert.deepEqual(
    groups('pll-t').map((group) => triggerName(group)),
    ['트위스트', '슬레지해머', undefined, undefined],
  );
  assert.equal(groups('oll-pi').length, 2);
  // Rotations change the view only: T is 8 turns between x and x′.
  const t = getLastLayerExercise('oll-t');
  assert.equal(t.tokens.length, 10);
  assert.equal(moveCount(t.tokens), 8);
  // A viewing turn of the learner's own does not pass the printed x.
  let session = sessionReducer(createSession(), {
    type: 'last-layer',
    id: 'oll-t',
  });
  session = drain(
    sessionReducer(session, { type: 'move', move: { face: 'Y', turns: 1 } }),
  );
  assert.equal(session.lesson!.cursor, 0);
  session = drain(
    sessionReducer(session, { type: 'move', move: { face: 'X', turns: -1 } }),
  );
  assert.equal(session.lesson!.cursor, 0);
  // From that held view, the next guided step turns the cube the printed way.
  session = drain(sessionReducer(session, { type: 'guide' }));
  assert.equal(session.lesson!.cursor, 1);
  session = drain(sessionReducer(session, { type: 'guide', wholeStage: true }));
  assert.equal(lastLayerStatus(session.cube, 'oll-corners'), 'complete');
  // f and M are followed by hand like any face turn.
  for (const id of ['oll-l', 'pll-ua'] as const) {
    const e = getLastLayerExercise(id);
    session = sessionReducer(createSession(), { type: 'last-layer', id });
    for (const move of e.solution)
      session = drain(sessionReducer(session, { type: 'move', move }));
    assert.equal(session.lesson!.cursor, e.solution.length, id);
    assert.equal(lastLayerStatus(session.cube, e.case.step), 'complete');
  }
});
