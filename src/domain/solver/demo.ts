import { applyMoves, isSolved, makePreset } from '../cube/cube.ts';
import type { Cube, Move } from '../cube/cube.ts';
import { guideSteps, moveCount, quarterTurns } from '../training/guide.ts';
import type { GuidedExercise } from '../training/guide.ts';
import type { SolveStage, SolveStageId } from './cfop.ts';

export type SolveMethod = 'cfop' | 'optimal';
// Cursor ranges are quarter-turn indices into the exercise's solution, token
// ranges index its printed tokens; a skipped stage has an empty range.
export type DemoPart = {
  label: string;
  note?: string;
  start: number;
  end: number;
  tokenStart: number;
  tokenEnd: number;
  moves: number;
};
export type DemoStage = Omit<SolveStage, 'parts'> & {
  parts: DemoPart[];
  start: number;
  end: number;
  tokenStart: number;
  tokenEnd: number;
  moves: number;
};
export type SolveExercise = GuidedExercise & {
  method: SolveMethod;
  // How the start was made, e.g. "랜덤 섞기 25수".
  source: string;
  stages: DemoStage[];
  algorithm: string;
  // The start is shown while the solver is still working.
  pending?: boolean;
};

const countTokens = (algorithm: string) =>
  algorithm.split(' ').filter(Boolean).length;

export function buildSolveExercise(
  initial: Cube,
  setup: Move[],
  method: SolveMethod,
  source: string,
  stages: SolveStage[],
): SolveExercise {
  let cursor = 0;
  let token = 0;
  const demoStages = stages.map((stage): DemoStage => {
    const start = cursor;
    const tokenStart = token;
    const parts = stage.parts.map((part): DemoPart => {
      const from = cursor;
      const fromToken = token;
      cursor += quarterTurns(part.algorithm).length;
      token += countTokens(part.algorithm);
      return {
        label: part.label,
        note: part.note,
        start: from,
        end: cursor,
        tokenStart: fromToken,
        tokenEnd: token,
        moves: 0,
      };
    });
    return {
      ...stage,
      parts,
      start,
      end: cursor,
      tokenStart,
      tokenEnd: token,
      moves: 0,
    };
  });
  const algorithm = stages
    .flatMap((stage) => stage.parts.map((part) => part.algorithm))
    .filter(Boolean)
    .join(' ');
  const steps = guideSteps(initial, algorithm);
  // Move counts leave out whole-cube rotations (x in some OLL cases).
  const count = (from: number, to: number) =>
    moveCount(steps.tokens.slice(from, to));
  for (const stage of demoStages) {
    stage.moves = count(stage.tokenStart, stage.tokenEnd);
    for (const part of stage.parts)
      part.moves = count(part.tokenStart, part.tokenEnd);
  }
  return {
    method,
    source,
    stages: demoStages,
    algorithm,
    initial,
    setup,
    ...steps,
  };
}

export function isDemoSolved(exercise: SolveExercise): boolean {
  return isSolved(applyMoves(exercise.initial, exercise.solution));
}

// The stage still to be played at `cursor`: the first with moves left.
export function currentStage(
  exercise: SolveExercise,
  cursor: number,
): DemoStage | undefined {
  return exercise.stages.find((stage) => stage.end > cursor);
}

export function optimalStages(algorithm: string): SolveStage[] {
  const id: SolveStageId = 'optimal';
  return [
    {
      id,
      title: '거의 최적 해법',
      goal: '큐브 완성',
      parts: algorithm
        ? [{ label: '두 단계 탐색 (min2phase)', algorithm }]
        : [],
      ...(algorithm ? {} : { skipped: '이미 완성된 큐브입니다.' }),
    },
  ];
}

export function pendingExercise(
  initial: Cube,
  setup: Move[],
  source: string,
): SolveExercise {
  return {
    ...buildSolveExercise(initial, setup, 'cfop', source, []),
    pending: true,
  };
}

// 25 random face turns, never the same face twice in a row.
export function randomStart(random = Math.random): SolveExercise {
  const { cube, moves } = makePreset('random', random);
  return pendingExercise(cube, moves, `랜덤 섞기 ${moves.length}수`);
}
