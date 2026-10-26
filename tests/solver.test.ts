import assert from 'node:assert/strict';
import { test } from 'node:test';
import min2phase from 'min2phase.js';
import {
  applyMoves,
  hasFirstTwoLayers,
  hasWhiteCross,
  inverse,
  isSolved,
  makePreset,
  notation,
  solvedCube,
} from '../src/domain/cube/cube.ts';
import type { Cube } from '../src/domain/cube/cube.ts';
import { lastLayerStatus } from '../src/domain/last-layer/cases.ts';
import { solveCfop } from '../src/domain/solver/cfop.ts';
import { solveCross } from '../src/domain/solver/cross.ts';
import {
  buildSolveExercise,
  currentStage,
  optimalStages,
  randomStart,
} from '../src/domain/solver/demo.ts';
import {
  FACE_MOVES,
  FACELETS,
  toFaceletString,
} from '../src/domain/solver/facelets.ts';
import { isSlotSolved, pairMoves } from '../src/domain/solver/f2l.ts';
import { F2L_TABLE } from '../src/domain/solver/f2lTable.ts';
import { solveNearOptimal } from '../src/domain/solver/optimal.ts';
import {
  CROSS_STICKERS,
  homeFacelet,
  SLOTS,
  stickerFacelets,
} from '../src/domain/solver/pieces.ts';
import { parseAlgorithm } from '../src/domain/training/guide.ts';
import {
  createSession,
  sessionReducer,
} from '../src/features/simulator/session.ts';
import type { Session } from '../src/features/simulator/session.ts';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const scrambles = (count: number, seed = 11) => {
  const random = seeded(seed);
  return Array.from({ length: count }, () => makePreset('random', random));
};
const run = (cube: Cube, algorithm: string) =>
  applyMoves(cube, parseAlgorithm(algorithm));
const undo = (algorithm: string) =>
  parseAlgorithm(algorithm).reverse().map(inverse);

test('SOLVER-01: facelet strings follow the engine and the two-phase solver', () => {
  assert.equal(
    toFaceletString(solvedCube()),
    'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
  );
  // The solver reads one turn of ours as exactly that turn: it answers with
  // the inverse, so faces and directions agree.
  for (const move of FACE_MOVES)
    assert.equal(
      new min2phase.Search()
        .solution(toFaceletString(applyMoves(solvedCube(), [move])))
        .trim(),
      notation(inverse(move)),
    );
  // Whole-cube turns do not change what is read (it is read upright).
  const { cube } = scrambles(1)[0];
  assert.equal(toFaceletString(run(cube, 'x y2 z')), toFaceletString(cube));
});

test('SOLVER-02: the white cross takes the fewest turns', () => {
  for (const { cube } of scrambles(60)) {
    const moves = solveCross(cube);
    assert.ok(hasWhiteCross(applyMoves(cube, moves)));
    assert.ok(moves.length <= 8);
  }
  // A cross broken by k turns comes back in at most k.
  for (const scramble of ['R U F', "D2 L'", 'B', "F R2 D' B L"])
    assert.ok(
      solveCross(run(solvedCube(), scramble)).length <=
        parseAlgorithm(scramble).length,
    );
  assert.deepEqual(solveCross(run(solvedCube(), "R U R' U'")), []);
});

test('SOLVER-03: every F2L table answer solves its pair and keeps the cross and other slots', () => {
  const [front, ...others] = SLOTS;
  assert.equal(Object.keys(F2L_TABLE).length, 24 * 16 - 1);
  for (const [key, algorithm] of Object.entries(F2L_TABLE)) {
    assert.doesNotMatch(algorithm, /D/);
    const [corner, edge] = key.split(':').map(Number);
    // The answer undone from solved gives exactly this case …
    const start = applyMoves(solvedCube(), undo(algorithm));
    const where = stickerFacelets(start);
    assert.equal(where.get(front.corner), corner, key);
    assert.equal(where.get(front.edge), edge, key);
    for (const id of CROSS_STICKERS)
      assert.equal(where.get(id), homeFacelet(id));
    // … and slots not holding the pair's pieces stay solved through it.
    const place = (f: number) => FACELETS[f].position.join();
    const held = (slot: (typeof SLOTS)[number]) =>
      [corner, edge].some((f) =>
        [slot.corner, slot.edge].some(
          (id) => place(homeFacelet(id)) === place(f),
        ),
      );
    for (const slot of others)
      if (!held(slot))
        assert.ok(isSlotSolved(start, slot), `${key} ${slot.id}`);
  }
});

test('SOLVER-04: pair answers work for every slot, seen from any side', () => {
  for (const { cube } of scrambles(40, 5)) {
    const crossed = applyMoves(cube, solveCross(cube));
    for (const slot of SLOTS) {
      const after = applyMoves(crossed, pairMoves(crossed, slot));
      assert.ok(isSlotSolved(after, slot), slot.id);
      assert.ok(hasWhiteCross(after));
      for (const other of SLOTS)
        if (other !== slot && isSlotSolved(crossed, other))
          assert.ok(isSlotSolved(after, other), `${slot.id} kept ${other.id}`);
    }
  }
});

test('SOLVER-05: CFOP reaches each of its six goals in order and solves the cube', () => {
  const goals: Record<string, (cube: Cube) => boolean> = {
    cross: hasWhiteCross,
    f2l: hasFirstTwoLayers,
    'oll-edges': (c) => lastLayerStatus(c, 'oll-edges') === 'complete',
    'oll-corners': (c) => lastLayerStatus(c, 'oll-corners') === 'complete',
    'pll-corners': (c) => lastLayerStatus(c, 'pll-corners') === 'complete',
    'pll-edges': isSolved,
  };
  const totals: number[] = [];
  for (const { cube, moves } of scrambles(80, 23)) {
    const stages = solveCfop(cube);
    assert.deepEqual(
      stages.map((stage) => stage.id),
      Object.keys(goals),
    );
    let state = cube;
    for (const stage of stages) {
      for (const part of stage.parts) state = run(state, part.algorithm);
      assert.ok(goals[stage.id](state), stage.id);
      assert.equal(Boolean(stage.skipped), stage.parts.length === 0);
    }
    // One F2L part per slot still open after the cross.
    const crossed = run(
      cube,
      stages[0].parts.map((p) => p.algorithm).join(' '),
    );
    assert.equal(
      stages[1].parts.length,
      SLOTS.filter((slot) => !isSlotSolved(crossed, slot)).length,
    );
    const exercise = buildSolveExercise(cube, moves, 'cfop', 'test', stages);
    assert.ok(isSolved(applyMoves(cube, exercise.solution)));
    totals.push(exercise.stages.reduce((sum, stage) => sum + stage.moves, 0));
  }
  // Beginner CFOP with 2-Look: well under 100 turns.
  assert.ok(Math.max(...totals) < 100, String(Math.max(...totals)));
  // An already solved cube skips every stage.
  assert.ok(solveCfop(solvedCube()).every((stage) => stage.skipped));
});

test('SOLVER-06: the nearly optimal answer solves the cube in at most 21 turns', () => {
  for (const { cube } of scrambles(4, 31)) {
    const answer = solveNearOptimal(cube, 2000);
    const turns = parseAlgorithm(answer);
    assert.ok(turns.length <= 21);
    assert.ok(isSolved(applyMoves(cube, turns)));
  }
  assert.equal(solveNearOptimal(solvedCube()), '');
  assert.ok(optimalStages('')[0].skipped);
});

test('SOLVER-07: demo stages split the solution into contiguous ranges', () => {
  const start = randomStart(seeded(3));
  assert.ok(start.pending);
  assert.equal(start.setup.length, 25);
  const exercise = buildSolveExercise(
    start.initial,
    start.setup,
    'cfop',
    start.source,
    solveCfop(start.initial),
  );
  let cursor = 0;
  let token = 0;
  for (const stage of exercise.stages) {
    assert.equal(stage.start, cursor);
    assert.equal(stage.tokenStart, token);
    for (const part of stage.parts) {
      assert.equal(part.start, cursor);
      cursor = part.end;
      token = part.tokenEnd;
    }
    assert.equal(stage.end, cursor);
    assert.equal(stage.tokenEnd, token);
  }
  assert.equal(cursor, exercise.solution.length);
  assert.equal(token, exercise.tokens.length);
  assert.equal(
    currentStage(exercise, 0),
    exercise.stages.find((s) => s.end > 0),
  );
  assert.equal(currentStage(exercise, cursor), undefined);
});

test('SOLVER-08: the session plays one stage, pauses, and jumps between stages', () => {
  const drain = (session: Session) => {
    while (session.queue.length)
      session = sessionReducer(session, {
        type: 'frame',
        progress: 1,
        command: session.queue[0],
      });
    return session;
  };
  const start = randomStart(seeded(8));
  const exercise = buildSolveExercise(
    start.initial,
    start.setup,
    'cfop',
    start.source,
    solveCfop(start.initial),
  );
  let session = sessionReducer(createSession(), { type: 'solve', exercise });
  assert.equal(session.cube, exercise.initial);
  const [cross, f2l] = exercise.stages;
  // Playing a stage stops at its end.
  session = drain(sessionReducer(session, { type: 'guide', to: cross.end }));
  assert.equal(session.lesson?.cursor, cross.end);
  assert.ok(hasWhiteCross(session.cube));
  // Pause keeps only the turn in progress.
  session = sessionReducer(session, { type: 'guide', to: f2l.end });
  assert.ok(session.queue.length > 1);
  session = drain(sessionReducer(session, { type: 'pause' }));
  assert.equal(session.lesson?.cursor, cross.end + 1);
  // A jump puts the cube at a stage start at once, with a fresh history.
  session = sessionReducer(session, { type: 'jump', cursor: f2l.end });
  assert.equal(session.cube, exercise.checkpoints[f2l.end]);
  assert.equal(session.lesson?.cursor, f2l.end);
  assert.deepEqual(session.history, []);
  assert.ok(hasFirstTwoLayers(session.cube));
  // Whole playback finishes the cube; then nothing more plays.
  session = drain(sessionReducer(session, { type: 'guide', wholeStage: true }));
  assert.ok(isSolved(session.cube));
  assert.equal(
    sessionReducer(session, { type: 'guide', wholeStage: true }),
    session,
  );
  // Jumps are refused while turning and outside the range.
  const restarted = sessionReducer(session, { type: 'jump', cursor: 0 });
  const turning = sessionReducer(restarted, { type: 'guide', to: 5 });
  assert.equal(sessionReducer(turning, { type: 'jump', cursor: 3 }), turning);
  assert.equal(
    sessionReducer(session, { type: 'jump', cursor: 9999 }),
    session,
  );
});
