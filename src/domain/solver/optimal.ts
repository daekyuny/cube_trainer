import min2phase from 'min2phase.js';
import {
  applyMoves,
  FACE_COLORS,
  FACES,
  inverse,
  notation,
  solvedCube,
} from '../cube/cube.ts';
import type { Color, Cube, Move } from '../cube/cube.ts';
import { parseAlgorithm } from '../training/guide.ts';
import { cubeColors, toFaceletString } from './facelets.ts';

// "Nearly optimal": the true shortest solution (Korf's search) needs tables
// too large for a phone, so the two-phase search (min2phase) keeps improving
// its answer for a fixed number of phase-2 probes. 10,000 probes give about
// 18.7 moves on average in about 0.5 s on a laptop (all answers ≤ 21 moves).
export const OPTIMAL_PROBES = 1e4;

export function solveNearOptimal(cube: Cube, probes = OPTIMAL_PROBES): string {
  const solution = new min2phase.Search().solution(
    toFaceletString(cube),
    21,
    1e9,
    probes,
    0,
  );
  if (solution.startsWith('Error')) throw new Error(`min2phase ${solution}`);
  return solution.trim().split(/\s+/).filter(Boolean).join(' ');
}

// A cube known only by its colors (a photo): any answer from the two-phase
// search, undone from solved, rebuilds it with real pieces and turns.
export function cubeFromColors(colors: readonly Color[]): {
  cube: Cube;
  setup: Move[];
} {
  const letter = new Map(FACES.map((face) => [FACE_COLORS[face], face]));
  const facelets = colors.map((color) => letter.get(color)).join('');
  const answer = new min2phase.Search().solution(facelets, 21, 1e9, 0, 0);
  if (answer.startsWith('Error')) throw new Error(`min2phase ${answer}`);
  const setup = parseAlgorithm(answer.trim().split(/\s+/).join(' '))
    .reverse()
    .map(inverse);
  const cube = applyMoves(solvedCube(), setup);
  if (cubeColors(cube).some((color, index) => color !== colors[index]))
    throw new Error('rebuilt cube differs from the colors read');
  return { cube, setup };
}
export const setupText = (setup: Move[]) => setup.map(notation).join(' ');
