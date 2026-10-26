import {
  applyMove,
  centerColor,
  equal,
  FACES,
  normalizeOrientation,
  NORMALS,
  solvedCube,
} from '../cube/cube.ts';
import type { Color, Cube, Face, Move, Vec3 } from '../cube/cube.ts';

// The standard facelet order used by two-phase solvers: U R F D L B, nine
// each, read row by row as each face is seen from outside (U with B at the
// top, D with F at the top, the four sides with U at the top).
export const FACELET_FACES: Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];

function faceletPosition(face: Face, row: number, col: number): Vec3 {
  const a = col - 1;
  const b = 1 - row;
  switch (face) {
    case 'U':
      return [a, 1, row - 1];
    case 'D':
      return [a, -1, 1 - row];
    case 'F':
      return [a, b, 1];
    case 'B':
      return [-a, b, -1];
    case 'R':
      return [1, b, -a];
    case 'L':
      return [-1, b, a];
  }
}

export type Facelet = { face: Face; position: Vec3; normal: Vec3 };
export const FACELETS: Facelet[] = FACELET_FACES.flatMap((face) =>
  [0, 1, 2].flatMap((row) =>
    [0, 1, 2].map((col) => ({
      face,
      position: faceletPosition(face, row, col),
      normal: NORMALS[face],
    })),
  ),
);

export function faceletIndex(position: Vec3, normal: Vec3): number {
  return FACELETS.findIndex(
    (f) => equal(f.position, position) && equal(f.normal, normal),
  );
}

// Colors in facelet order, after turning the cube upright (white down, red
// front) so the letters always mean the standard faces.
export function cubeColors(cube: Cube): Color[] {
  const upright = normalizeOrientation(cube);
  const colors: Color[] = [];
  for (const sticker of upright)
    colors[faceletIndex(sticker.position, sticker.normal)] = sticker.color;
  return colors;
}

// Face letters by center color, e.g. "UUUUUUUUURRR…" for a solved cube.
export function toFaceletString(cube: Cube): string {
  const upright = normalizeOrientation(cube);
  const letter = new Map<Color, Face>(
    FACES.map((face) => [centerColor(upright, face), face]),
  );
  return cubeColors(upright)
    .map((color) => letter.get(color))
    .join('');
}

// Where each facelet's sticker goes under a move, read off the engine itself
// so solvers share its turn directions exactly.
export function faceletPermutation(move: Move): number[] {
  const solved = solvedCube();
  const moved = new Map(applyMove(solved, move).map((s) => [s.id, s]));
  const permutation: number[] = [];
  for (const sticker of solved) {
    const to = moved.get(sticker.id)!;
    permutation[faceletIndex(sticker.position, sticker.normal)] = faceletIndex(
      to.position,
      to.normal,
    );
  }
  return permutation;
}

export const FACE_MOVES: Move[] = FACES.flatMap((face) =>
  ([1, 2, -1] as const).map((turns) => ({ face, turns })),
);
