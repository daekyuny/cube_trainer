import {
  applyMove,
  centerColor,
  equal,
  FACES,
  FACE_COLORS,
  normalizeOrientation,
} from '../cube/cube.ts';
import type { Cube, Face, Move } from '../cube/cube.ts';

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

// Centers encode the viewing orientation independently of history (which can
// be cleared): printed algorithms use red front / green right / yellow up.
export function isLessonView(cube: Cube): boolean {
  return (
    centerColor(cube, 'F') === 'red' && centerColor(cube, 'U') === 'yellow'
  );
}

// Only the executed face changes when the learner views the same exercise
// from another side or upside down. Printed algorithms use outer faces only.
export function lessonMove(cube: Cube, move: Move): Move {
  if (!FACES.includes(move.face as Face)) return move;
  const color = FACE_COLORS[move.face as Face];
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
  cube = normalizeOrientation(cube);
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
