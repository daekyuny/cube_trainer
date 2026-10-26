import { applyMove, applyMoves, isSolved, notation } from '../cube/cube.ts';
import type { Cube, Move } from '../cube/cube.ts';
import { LAST_LAYER_STEPS, lastLayerStatus } from '../last-layer/cases.ts';
import type { LastLayerStep } from '../last-layer/cases.ts';
import { aroundTurns, findCase, startView } from '../practice/practice.ts';
import { parseAlgorithm } from '../training/guide.ts';
import { solveCross } from './cross.ts';
import { solveF2L } from './f2l.ts';
import type { SlotId } from './pieces.ts';

export type SolveStageId = 'cross' | 'f2l' | LastLayerStep | 'optimal';
// One named piece of a stage: a pair, a case, or the whole stage.
export type SolvePart = { label: string; algorithm: string; note?: string };
export type SolveStage = {
  id: SolveStageId;
  title: string;
  goal: string;
  parts: SolvePart[];
  // Shown when the stage needs no moves.
  skipped?: string;
};

const text = (moves: Move[]) => moves.map(notation).join(' ');

const PAIRS: Record<SlotId, string> = {
  FR: 'R·G 페어 · 앞·오른쪽 슬롯',
  FL: 'R·B 페어 · 앞·왼쪽 슬롯',
  BL: 'O·B 페어 · 뒤·왼쪽 슬롯',
  BR: 'O·G 페어 · 뒤·오른쪽 슬롯',
};

function lastLayerStage(cube: Cube, step: LastLayerStep): SolveStage {
  const info = LAST_LAYER_STEPS.find((item) => item.id === step)!;
  const stage = {
    id: step,
    title: `${info.set.toUpperCase()} ${info.title.split(' · ')[0]}`,
    goal: info.goal,
  };
  const status = lastLayerStatus(cube, step);
  if (status === 'complete')
    return { ...stage, parts: [], skipped: '이미 완성되어 건너뜁니다.' };
  if (status === 'needs-auf') {
    let turned = cube;
    let turns = 0;
    while (!isSolved(turned)) {
      turned = applyMove(turned, { face: 'U', turns: 1 });
      turns++;
    }
    const auf = turns === 2 ? 'U2' : turns === 1 ? 'U' : "U'";
    return {
      ...stage,
      parts: [
        {
          label: 'U 맞추기',
          algorithm: auf,
          note: '윗층만 돌리면 완성입니다.',
        },
      ],
    };
  }
  const found = findCase(cube, step)!;
  return {
    ...stage,
    parts: [
      {
        label: found.item.name,
        algorithm: aroundTurns(found.before, found.item.algorithm, found.after),
        note: startView(found.item.recognition, found.before),
      },
    ],
  };
}

// The beginner CFOP route in six stages: white cross, the four F2L pairs,
// then 2-Look OLL and PLL with the taught algorithms.
export function solveCfop(cube: Cube): SolveStage[] {
  const stages: SolveStage[] = [];
  const cross = solveCross(cube);
  stages.push({
    id: 'cross',
    title: '십자',
    goal: '흰색 십자',
    parts: cross.length
      ? [{ label: '흰 엣지 네 개', algorithm: text(cross) }]
      : [],
    ...(cross.length ? {} : { skipped: '이미 완성되어 건너뜁니다.' }),
  });
  cube = applyMoves(cube, cross);
  const pairs = solveF2L(cube);
  stages.push({
    id: 'f2l',
    title: 'F2L',
    goal: '1·2층 완성',
    parts: pairs.map((pair) => ({
      label: PAIRS[pair.slot.id],
      algorithm: text(pair.moves),
    })),
    ...(pairs.length ? {} : { skipped: '이미 완성되어 건너뜁니다.' }),
  });
  for (const pair of pairs) cube = applyMoves(cube, pair.moves);
  for (const { id } of LAST_LAYER_STEPS) {
    const stage = lastLayerStage(cube, id);
    stages.push(stage);
    for (const part of stage.parts)
      cube = applyMoves(cube, parseAlgorithm(part.algorithm));
  }
  return stages;
}
