import {
  alongFace,
  applyMove,
  centerColor,
  equal,
  FACES,
  normalizeOrientation,
  referenceFace,
} from '../cube/cube.ts';
import type { Cube, Face, Move } from '../cube/cube.ts';

// `group`: index of the parenthesized group the move belongs to, if any.
export type SolutionToken = {
  label: string;
  start: number;
  end: number;
  group?: number;
};
// A fixed start position and one printed algorithm, tracked per quarter turn.
export type GuidedExercise = {
  initial: Cube;
  setup: Move[];
  solution: Move[];
  checkpoints: Cube[];
  tokens: SolutionToken[];
};

// Printed tokens without the grouping parentheses, e.g. "F (R U R' U') F'".
function algorithmTokens(text: string): string[] {
  return text.replace(/[()]/g, ' ').split(' ').filter(Boolean);
}

// Half turns stay one move; used for setup sequences and printed notation.
// x / y / z map to the upper-case rotation faces; f / r … stay wide turns.
export function parseAlgorithm(text: string): Move[] {
  return algorithmTokens(text).map((token) => ({
    face: (/[xyz]/.test(token[0])
      ? token[0].toUpperCase()
      : token[0]) as Move['face'],
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
  let group = -1;
  let open = false;
  const tokens = algorithm
    .split(' ')
    .filter(Boolean)
    .map((raw): SolutionToken => {
      if (raw.startsWith('(')) {
        group++;
        open = true;
      }
      const label = raw.replace(/[()]/g, '');
      const start = offset;
      offset += label.endsWith('2') ? 2 : 1;
      const token = open
        ? { label, start, end: offset, group }
        : { label, start, end: offset };
      if (raw.endsWith(')')) open = false;
      return token;
    });
  return { solution, checkpoints, tokens };
}

// Named repeated triggers, so a group reads as one remembered motion.
const TRIGGERS: Record<string, string> = {
  "R U R' U'": '트위스트',
  "R' F R F'": '슬레지해머',
};
export function triggerName(tokens: SolutionToken[]): string | undefined {
  return TRIGGERS[tokens.map((token) => token.label).join(' ')];
}

// Turned moves only; whole-cube rotations change the view, not the pieces.
export function moveCount(tokens: SolutionToken[]): number {
  return tokens.filter((token) => !/^[xyz]/.test(token.label)).length;
}

function sameCube(a: Cube, b: Cube): boolean {
  return a.every(
    (sticker, index) =>
      sticker.id === b[index].id &&
      equal(sticker.position, b[index].position) &&
      equal(sticker.normal, b[index].normal),
  );
}

// Printed moves are written for the checkpoint they start from (`reference`).
// The learner may hold the same position turned or upside down; centers form
// a rigid frame, so the face showing the same center color is the one to turn.
function viewFace(cube: Cube, reference: Cube, face: Face): Face {
  return FACES.find(
    (candidate) =>
      centerColor(cube, candidate) === centerColor(reference, face),
  )!;
}

export function isLessonView(cube: Cube, reference: Cube): boolean {
  return (['F', 'U'] as const).every(
    (face) => viewFace(cube, reference, face) === face,
  );
}

// Faces, wide turns, slices and rotations all map through their reference face.
export function lessonMove(cube: Cube, move: Move, reference: Cube): Move {
  const face = referenceFace(move);
  const shown = viewFace(cube, reference, face);
  return shown === face ? move : alongFace(move, shown);
}

// How the learner holds the cube relative to a checkpoint's printed frame.
function heldView(cube: Cube, reference: Cube): string {
  return (['F', 'U'] as const)
    .map((face) => viewFace(cube, reference, face))
    .join('');
}

// `before`: the cube before the last move. A printed x / y / z step leaves
// the pieces unchanged, so it only counts when the held view is kept; a
// viewing turn of the learner's own stays at the same step.
export function guideCursor(
  exercise: Pick<GuidedExercise, 'checkpoints'>,
  cube: Cube,
  previous: number | null,
  undo = false,
  before?: Cube,
): number | null {
  // Slices and x / z move centers, so both sides compare upright.
  const upright = normalizeOrientation(cube);
  const matches = (index: number) =>
    index >= 0 &&
    index < exercise.checkpoints.length &&
    sameCube(upright, normalizeOrientation(exercise.checkpoints[index]));
  const preferred = previous === null ? -1 : previous + (undo ? -1 : 1);
  const held =
    before && previous !== null
      ? heldView(before, exercise.checkpoints[previous])
      : null;
  if (
    matches(preferred) &&
    (held === null || heldView(cube, exercise.checkpoints[preferred]) === held)
  )
    return preferred;
  if (previous !== null && matches(previous)) return previous;
  if (matches(preferred)) return preferred;
  const found = exercise.checkpoints.findIndex((_, index) => matches(index));
  return found < 0 ? null : found;
}
