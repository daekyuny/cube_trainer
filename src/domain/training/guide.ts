import {
  applyMove,
  centerColor,
  equal,
  FACES,
  FACE_COLORS,
} from '../cube/cube.ts';
import type { Cube, Move } from '../cube/cube.ts';

export type SolutionToken = { label: string; start: number; end: number };
// A fixed start position and one printed algorithm, tracked per quarter turn.
export type GuidedExercise = {
  initial: Cube;
  setup: Move[];
  solution: Move[];
  checkpoints: Cube[];
  tokens: SolutionToken[];
};

// Half turns stay one move; used for setup sequences and printed notation.
export function parseAlgorithm(text: string): Move[] {
  return text
    .split(' ')
    .filter(Boolean)
    .map((token) => ({
      face: token[0] as Move['face'],
      turns: token.endsWith('2') ? 2 : token.endsWith("'") ? -1 : 1,
    }));
}

// Quarter-turn checkpoints let two keyboard U presses follow an indicated U2.
export function quarterTurns(text: string): Move[] {
  return parseAlgorithm(text).flatMap((move): Move[] =>
    move.turns === 2
      ? [
          { ...move, turns: 1 },
          { ...move, turns: 1 },
        ]
      : [move],
  );
}

export function guideSteps(
  initial: Cube,
  algorithm: string,
): Pick<GuidedExercise, 'solution' | 'checkpoints' | 'tokens'> {
  const solution = quarterTurns(algorithm);
  const checkpoints: Cube[] = [initial];
  for (const move of solution)
    checkpoints.push(applyMove(checkpoints.at(-1)!, move));
  let offset = 0;
  const tokens = algorithm.split(' ').map((label) => {
    const start = offset;
    offset += label.endsWith('2') ? 2 : 1;
    return { label, start, end: offset };
  });
  return { solution, checkpoints, tokens };
}

function sameCube(a: Cube, b: Cube): boolean {
  return a.every(
    (sticker, index) =>
      sticker.id === b[index].id &&
      equal(sticker.position, b[index].position) &&
      equal(sticker.normal, b[index].normal),
  );
}

// Centers encode the viewing yaw independently of history (which can be cleared).
export function lessonViewTurns(cube: Cube): number {
  return (['F', 'L', 'B', 'R'] as const).findIndex(
    (face) => centerColor(cube, face) === 'red',
  );
}

// Printed algorithms always use red-front / green-right coordinates. Only the
// executed face changes when the learner views the same exercise from another side.
export function lessonMove(cube: Cube, move: Move): Move {
  if (move.face === 'Y') return move;
  const color = FACE_COLORS[move.face];
  return {
    ...move,
    face: FACES.find((face) => centerColor(cube, face) === color)!,
  };
}

export function guideCursor(
  exercise: Pick<GuidedExercise, 'checkpoints'>,
  cube: Cube,
  previous: number | null,
  undo = false,
): number | null {
  for (let turn = lessonViewTurns(cube); turn > 0; turn--)
    cube = applyMove(cube, { face: 'Y', turns: -1 });
  const preferred = previous === null ? -1 : previous + (undo ? -1 : 1);
  if (
    exercise.checkpoints[preferred] &&
    sameCube(cube, exercise.checkpoints[preferred])
  )
    return preferred;
  if (previous !== null && sameCube(cube, exercise.checkpoints[previous]))
    return previous;
  const found = exercise.checkpoints.findIndex((checkpoint) =>
    sameCube(cube, checkpoint),
  );
  return found < 0 ? null : found;
}
