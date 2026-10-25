import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyMoves,
  centerColor,
  equal,
  FACES,
  FACE_COLORS,
  hasFirstTwoLayers,
  hasWhiteCross,
  NORMALS,
  solvedCube,
} from '../src/domain/cube/cube.ts';
import type { Cube } from '../src/domain/cube/cube.ts';
import {
  areOtherSlotsSolved,
  getExercise,
  targetIds,
  trainingStatus,
} from '../src/domain/f2l/lessons.ts';
import {
  getLastLayerExercise,
  LAST_LAYER_CASES,
  LAST_LAYER_STEPS,
  lastLayerStatus,
} from '../src/domain/last-layer/cases.ts';
import {
  findCase,
  isPracticeComplete,
  makePractice,
  PRACTICE_STAGES,
  startView,
} from '../src/domain/practice/practice.ts';
import type { PracticeExercise } from '../src/domain/practice/practice.ts';
import { parseAlgorithm } from '../src/domain/training/guide.ts';
import {
  createSession,
  sessionReducer,
} from '../src/features/simulator/session.ts';
import type { Session } from '../src/features/simulator/session.ts';

// Small seeded generator so every run checks the same starts.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const samples = (stage: PracticeExercise['stage'], count = 120) => {
  const random = seeded(stage.length * 7919 + 17);
  return Array.from({ length: count }, () => makePractice(stage, random));
};
const solve = (exercise: PracticeExercise) =>
  applyMoves(exercise.initial, exercise.solution);
const defaultCenters = (cube: Cube) =>
  FACES.every((face) => centerColor(cube, face) === FACE_COLORS[face]);
const ORDER = LAST_LAYER_STEPS.map((step) => step.id);

test('PRACTICE-01: five stages in order — F2L, OLL 1·2, PLL 1·2', () => {
  assert.deepEqual(
    PRACTICE_STAGES.map((stage) => stage.id),
    ['f2l', 'oll-edges', 'oll-corners', 'pll-corners', 'pll-edges'],
  );
});

test('PRACTICE-02: F2L starts are one of the five taught cases, either side, any U angle', () => {
  const cases = new Set<string>();
  const angles = new Set<string>();
  for (const exercise of samples('f2l', 200)) {
    const { initial, side } = exercise;
    assert.deepEqual(applyMoves(solvedCube(), exercise.setup), initial);
    assert.ok(defaultCenters(initial));
    assert.ok(hasWhiteCross(initial) && areOtherSlotsSolved(initial, side));
    assert.equal(trainingStatus(initial, side), 'working');
    assert.equal(isPracticeComplete(exercise, initial), false);
    assert.equal(isPracticeComplete(exercise, solve(exercise)), true);
    assert.equal(trainingStatus(solve(exercise), side), 'paired');
    // Undoing the U angle gives exactly a lesson's target pieces.
    const turned = applyMoves(initial, parseAlgorithm(exercise.before));
    const lesson = [1, 2, 3, 4, 5]
      .flatMap((id) => [0, 1].map((variant) => ({ id, variant })))
      .filter(({ id, variant }) => variant === 0 || id === 5)
      .map(({ id, variant }) => getExercise(id as 1, variant, side))
      .find((candidate) =>
        targetIds(side).every((id) => {
          const a = turned.find((s) => s.id === id)!;
          const b = candidate.initial.find((s) => s.id === id)!;
          return equal(a.position, b.position) && equal(a.normal, b.normal);
        }),
      );
    assert.ok(lesson, exercise.caseName);
    assert.ok(exercise.caseName.startsWith(`${lesson.id}번`));
    cases.add(`${lesson.id}/${lesson.variant}/${side}`);
    angles.add(exercise.before);
  }
  // 6 variants × 2 sides, and every U angle.
  assert.equal(cases.size, 12);
  assert.equal(angles.size, 4);
});

for (const step of ORDER)
  test(`PRACTICE-03: ${step} starts keep the earlier steps, need the step, and the shown answer finishes it`, () => {
    const cases = new Set<string>();
    for (const exercise of samples(step)) {
      const { initial } = exercise;
      assert.deepEqual(applyMoves(solvedCube(), exercise.setup), initial);
      assert.ok(defaultCenters(initial));
      assert.ok(hasFirstTwoLayers(initial));
      for (const earlier of ORDER.slice(0, ORDER.indexOf(step)))
        assert.equal(lastLayerStatus(initial, earlier), 'complete');
      assert.equal(lastLayerStatus(initial, step), 'working');
      assert.equal(isPracticeComplete(exercise, initial), false);
      assert.equal(lastLayerStatus(solve(exercise), step), 'complete');
      const found = findCase(initial, step)!;
      assert.equal(exercise.caseName, found.item.name);
      cases.add(found.item.id);
    }
    // Every taught case of the step comes up.
    assert.deepEqual(
      [...cases].sort(),
      LAST_LAYER_CASES.filter((item) => item.step === step)
        .map((item) => item.id)
        .sort(),
    );
  });

test('PRACTICE-03: the U angle puts the case at its printed angle (edge and corner patterns)', () => {
  const yellowUp = (cube: Cube) =>
    cube
      .filter((s) => s.color === 'yellow' && equal(s.normal, NORMALS.U))
      .map((s) => s.position.join())
      .sort();
  for (const step of ['oll-edges', 'oll-corners'] as const)
    for (const exercise of samples(step, 60)) {
      const turned = applyMoves(
        exercise.initial,
        parseAlgorithm(exercise.before),
      );
      const taught = getLastLayerExercise(
        findCase(exercise.initial, step)!.item.id,
      );
      const edgesOnly = (positions: string[]) =>
        positions.filter((p) => p.split(',').filter((v) => v === '0').length);
      assert.deepEqual(
        step === 'oll-edges' ? edgesOnly(yellowUp(turned)) : yellowUp(turned),
        step === 'oll-edges'
          ? edgesOnly(yellowUp(taught.initial))
          : yellowUp(taught.initial),
        exercise.caseName,
      );
    }
});

// The top layer in side words: where each yellow sticker faces, where the
// headlights are, and whose corner color each side's edge shows.
const WORD: Record<string, string> = {
  '0,0,1': '앞',
  '0,0,-1': '뒤',
  '-1,0,0': '왼쪽',
  '1,0,0': '오른쪽',
  '0,1,0': '위',
};
const SIDE_NORMALS = ['0,0,1', '1,0,0', '0,0,-1', '-1,0,0'];
function topWords(cube: Cube, step: string): string {
  const top = cube.filter((s) => s.position[1] === 1);
  const at = (s: (typeof top)[number]) =>
    [s.position[2], s.position[0]]
      .map((v, i) => (v ? WORD[i ? `${v},0,0` : `0,0,${v}`] : ''))
      .filter(Boolean)
      .join('·');
  if (step === 'oll-edges' || step === 'oll-corners')
    return top
      .filter((s) => s.color === 'yellow')
      .filter(
        (s) =>
          (Math.abs(s.position[0]) + Math.abs(s.position[2]) === 2) ===
          (step === 'oll-corners'),
      )
      .map((s) => `${at(s)}:${WORD[s.normal.join()]}`)
      .sort()
      .join(' ');
  const side = (normal: string) =>
    top.filter((s) => s.normal.join() === normal);
  const cornerColor = (normal: string) =>
    side(normal).find((s) => s.position.filter((v) => v).length === 3)!.color;
  return SIDE_NORMALS.map((normal) => {
    const row = side(normal);
    const corners = row.filter((s) => s.position.filter((v) => v).length === 3);
    if (step === 'pll-corners')
      return corners[0].color === corners[1].color ? WORD[normal] : '';
    const edge = row.find((s) => s.position.filter((v) => v).length === 2)!;
    const match = SIDE_NORMALS.find((n) => cornerColor(n) === edge.color)!;
    return `${WORD[normal]}:${WORD[match]}`;
  })
    .filter(Boolean)
    .sort()
    .join(' ');
}

test('PRACTICE-03: recognition is written for the start as shown (front = the large left face)', () => {
  for (const step of ORDER)
    for (const exercise of samples(step, 60)) {
      const taught = getLastLayerExercise(
        findCase(exercise.initial, step)!.item.id,
      );
      // The taught start's pattern, renamed by the same U, is what is shown.
      const shown = startView(topWords(taught.initial, step), exercise.before)
        .split(' ')
        .sort()
        .join(' ');
      assert.equal(shown, topWords(exercise.initial, step), exercise.caseName);
      assert.equal(
        exercise.recognition,
        startView(taught.case.recognition, exercise.before),
      );
    }
  assert.equal(
    startView(
      '노란 코너 하나가 앞·왼쪽에 있고, 앞·오른쪽 코너의 노랑은 앞을 봅니다.',
      'U',
    ),
    '노란 코너 하나가 앞·오른쪽에 있고, 뒤·오른쪽 코너의 노랑은 오른쪽을 봅니다.',
  );
  assert.equal(
    startView(
      '뒷면 한 줄이 같은 색이고, 앞면 가운데 엣지가 왼쪽 면 코너와 같은 색입니다.',
      'U2',
    ),
    '앞면 한 줄이 같은 색이고, 뒷면 가운데 엣지가 오른쪽 면 코너와 같은 색입니다.',
  );
});

test('PRACTICE-04: a practice start runs through the session like a lesson', () => {
  const run = (session: Session) => {
    while (session.queue.length)
      session = sessionReducer(session, {
        type: 'frame',
        progress: 1,
        command: session.queue[0],
      });
    return session;
  };
  for (const stage of PRACTICE_STAGES.map((s) => s.id)) {
    const exercise = makePractice(stage, seeded(3));
    let session = sessionReducer(createSession(), {
      type: 'practice',
      exercise,
    });
    assert.equal(session.cube, exercise.initial);
    assert.equal(session.lesson?.cursor, 0);
    session = run(sessionReducer(session, { type: 'guide' }));
    assert.equal(session.lesson?.cursor, 1);
    session = run(sessionReducer(session, { type: 'guide', wholeStage: true }));
    assert.equal(session.lesson?.cursor, exercise.solution.length);
    assert.ok(isPracticeComplete(exercise, session.cube));
    // Finished: the demonstration stops; restart brings back the same start.
    assert.equal(sessionReducer(session, { type: 'guide' }), session);
    session = sessionReducer(session, { type: 'restart' });
    assert.equal(session.cube, exercise.initial);
  }
});
