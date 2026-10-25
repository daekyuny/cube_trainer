import { applyMoves, solvedCube } from '../cube/cube.ts';
import type { Cube, Move } from '../cube/cube.ts';
import { getExercise, LESSONS, trainingStatus } from '../f2l/lessons.ts';
import type { LessonId, LessonSide } from '../f2l/lessons.ts';
import {
  LAST_LAYER_CASES,
  LAST_LAYER_STEPS,
  lastLayerStatus,
} from '../last-layer/cases.ts';
import type { LastLayerCase, LastLayerStep } from '../last-layer/cases.ts';
import { guideSteps, parseAlgorithm } from '../training/guide.ts';
import type { GuidedExercise } from '../training/guide.ts';

export type PracticeStage = 'f2l' | LastLayerStep;
export const PRACTICE_STAGES: {
  id: PracticeStage;
  title: string;
  goal: string;
}[] = [
  { id: 'f2l', title: 'F2L 페어링', goal: 'Y층에서 페어 만들기' },
  ...LAST_LAYER_STEPS.map((step) => ({
    id: step.id,
    title: `${step.set.toUpperCase()} ${step.title.split(' · ')[0]}`,
    goal: step.goal,
  })),
];

// A random start for one stage and the taught answer to it: the U turn that
// sets the case to its printed angle, the case's algorithm, and for the last
// step the U turn that lines the layer up afterwards.
export type PracticeExercise = GuidedExercise & {
  stage: PracticeStage;
  algorithm: string;
  caseName: string;
  recognition: string;
  hint: string;
  before: string;
  after: string;
  // How the U adjustments fit in; empty when none is needed.
  turnNote: string;
  // F2L only: which pair (RG or RB) is the target.
  side?: LessonSide;
};
type Random = () => number;

const AUF = ['', 'U', "U'", 'U2'] as const;
const QUARTERS: Record<string, number> = { '': 0, U: 1, U2: 2, "U'": 3 };
const turnBy = (quarters: number) =>
  AUF.find((turn) => QUARTERS[turn] === (quarters + 4) % 4)!;
const pick = <T>(items: readonly T[], random: Random): T =>
  items[Math.min(items.length - 1, Math.floor(random() * items.length))];

// Every 2-Look algorithm keeps the first two layers and the centers, so random
// algorithms between random U turns give a legal, well-mixed last layer.
function scrambleLastLayer(random: Random): Move[] {
  return Array.from({ length: 12 }, () => [
    ...parseAlgorithm(pick(AUF, random)),
    ...parseAlgorithm(pick(LAST_LAYER_CASES, random).algorithm),
  ]).flat();
}

const join = (...parts: string[]) => parts.filter(Boolean).join(' ');

// The taught case for this cube, with the fewest U adjustments around it.
export function findCase(
  cube: Cube,
  step: LastLayerStep,
): { item: LastLayerCase; before: string; after: string } | null {
  const cases = LAST_LAYER_CASES.filter((item) => item.step === step);
  const afters = step === 'pll-edges' ? AUF : ([''] as const);
  for (const before of AUF)
    for (const after of afters)
      for (const item of cases) {
        const end = applyMoves(
          cube,
          parseAlgorithm(join(before, item.algorithm, after)),
        );
        if (lastLayerStatus(end, step) === 'complete')
          return { item, before, after };
      }
  return null;
}

function isStageStart(cube: Cube, step: LastLayerStep): boolean {
  const status = lastLayerStatus(cube, step);
  return status !== 'complete' && status !== 'needs-auf';
}

function lastLayerPractice(
  step: LastLayerStep,
  random: Random,
): PracticeExercise {
  const order = LAST_LAYER_STEPS.map((item) => item.id);
  for (;;) {
    const setup = scrambleLastLayer(random);
    // Finish the earlier steps with their own algorithms.
    for (const earlier of order.slice(0, order.indexOf(step))) {
      const cube = applyMoves(solvedCube(), setup);
      if (lastLayerStatus(cube, earlier) === 'complete') continue;
      const found = findCase(cube, earlier)!;
      setup.push(
        ...parseAlgorithm(
          join(found.before, found.item.algorithm, found.after),
        ),
      );
    }
    const initial = applyMoves(solvedCube(), setup);
    if (!isStageStart(initial, step)) continue;
    const found = findCase(initial, step)!;
    const algorithm = aroundTurns(
      found.before,
      found.item.algorithm,
      found.after,
    );
    return {
      stage: step,
      algorithm,
      caseName: found.item.name,
      recognition: found.item.recognition,
      hint: found.item.hint,
      before: found.before,
      after: found.after,
      turnNote: join(
        found.before && `먼저 ${found.before}로 케이스를 공식 각도에 놓습니다.`,
        found.after && `공식 뒤 ${found.after}로 윗층을 맞춥니다.`,
        (found.before || found.after) && '아래 수순에 포함되어 있습니다.',
      ),
      initial,
      setup,
      ...guideSteps(initial, algorithm),
    };
  }
}

// U adjustments merge into the algorithm's own first / last U turn.
function aroundTurns(before: string, algorithm: string, after: string) {
  const tokens = algorithm.split(' ');
  if (tokens[0] in QUARTERS) {
    before = turnBy(QUARTERS[before] + QUARTERS[tokens[0]]);
    tokens.shift();
  }
  if (tokens.at(-1)! in QUARTERS) {
    after = turnBy(QUARTERS[tokens.at(-1)!] + QUARTERS[after]);
    tokens.pop();
  }
  return join(before, ...tokens, after);
}

const F2L_CASES: { id: LessonId; variant: number }[] = LESSONS.flatMap(
  (lesson) =>
    (lesson.id === 5 ? [0, 1] : [0]).map((variant) => ({
      id: lesson.id,
      variant,
    })),
);

function f2lPractice(random: Random): PracticeExercise {
  const id = pick(LESSONS, random).id;
  const variant = pick(
    F2L_CASES.filter((item) => item.id === id),
    random,
  ).variant;
  const side = pick(['right', 'left'] as const, random);
  const lesson = getExercise(id, variant, side);
  const turn = pick(AUF, random);
  const undo = turnBy(-QUARTERS[turn]);
  // The lesson setup only moves F2L pieces into place, so the mixed last
  // layer stays mixed around the target pair.
  const setup = [
    ...scrambleLastLayer(random),
    ...lesson.setup,
    ...parseAlgorithm(turn),
  ];
  const initial = applyMoves(solvedCube(), setup);
  const algorithm = aroundTurns(undo, lesson.definition.pair, '');
  const title = LESSONS.find((item) => item.id === id)!.title.replace(
    '오른쪽',
    side === 'left' ? '왼쪽' : '오른쪽',
  );
  return {
    stage: 'f2l',
    algorithm,
    caseName: `${id}번 · ${title}`,
    recognition: `대상: R·${side === 'left' ? 'B' : 'G'}·W 코너와 R·${side === 'left' ? 'B' : 'G'} 엣지${id === 5 ? ` · 엣지 윗색 ${lesson.definition.top === 'red' ? 'R' : side === 'left' ? 'B' : 'G'}` : ''}`,
    hint: lesson.definition.hint,
    before: undo,
    after: '',
    turnNote: undo
      ? `윗층을 ${undo}로 돌리면 기본 배치(코너 앞·${side === 'left' ? '왼쪽' : '오른쪽'} 위, 엣지 뒤·O 센터 위)가 됩니다. 아래 수순에 이 U 맞추기가 포함되어 있습니다.`
      : '',
    side,
    initial,
    setup,
    ...guideSteps(initial, algorithm),
  };
}

export function makePractice(
  stage: PracticeStage,
  random: Random = Math.random,
): PracticeExercise {
  return stage === 'f2l'
    ? f2lPractice(random)
    : lastLayerPractice(stage, random);
}

export function isPracticeComplete(
  exercise: PracticeExercise,
  cube: Cube,
): boolean {
  return exercise.stage === 'f2l'
    ? trainingStatus(cube, exercise.side) === 'paired'
    : lastLayerStatus(cube, exercise.stage) === 'complete';
}
