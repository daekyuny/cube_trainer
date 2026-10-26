import { equal, normalizeOrientation, solvedCube } from '../cube/cube.ts';
import type { Cube, Face, Move, Vec3 } from '../cube/cube.ts';
import { FACE_MOVES, faceletIndex, faceletPermutation } from './facelets.ts';

// Fast search state: each tracked sticker (by its id) is just the facelet it
// sits on, and a move is a 54-entry permutation of facelets.
export const MOVE_PERMUTATIONS: number[][] = FACE_MOVES.map(faceletPermutation);
export const ROTATE_Y = faceletPermutation({ face: 'Y', turns: 1 });

const SOLVED = solvedCube();
const HOME = new Map(
  SOLVED.map((s) => [s.id, faceletIndex(s.position, s.normal)]),
);
export const homeFacelet = (id: string): number => HOME.get(id)!;

// The id of the sticker on face `normal` of the piece whose home is `position`.
export function stickerAt(position: Vec3, normal: Vec3): string {
  return SOLVED.find(
    (s) => equal(s.position, position) && equal(s.normal, normal),
  )!.id;
}

// Facelet of every sticker, read with the cube turned upright.
export function stickerFacelets(cube: Cube): Map<string, number> {
  return new Map(
    normalizeOrientation(cube).map((s) => [
      s.id,
      faceletIndex(s.position, s.normal),
    ]),
  );
}

export function applyPermutation(
  facelets: readonly number[],
  permutation: readonly number[],
): number[] {
  return facelets.map((f) => permutation[f]);
}

const D: Vec3 = [0, -1, 0];
// The four white cross edges, by their white sticker.
export const CROSS_STICKERS: string[] = (
  [
    [0, -1, 1],
    [1, -1, 0],
    [0, -1, -1],
    [-1, -1, 0],
  ] as Vec3[]
).map((position) => stickerAt(position, D));

export type SlotId = 'FR' | 'FL' | 'BL' | 'BR';
export type Slot = {
  id: SlotId;
  // Corner by its white sticker; edge by the sticker that the y turns carry
  // to the front face, so every slot reads like FR's front sticker.
  corner: string;
  edge: string;
  // y quarter turns that carry this slot to FR.
  toFrontRight: number;
};
function slot(
  id: SlotId,
  x: number,
  z: number,
  edgeNormal: Vec3,
  toFrontRight: number,
): Slot {
  return {
    id,
    corner: stickerAt([x, -1, z], D),
    edge: stickerAt([x, 0, z], edgeNormal),
    toFrontRight,
  };
}
// y turns the front face to the left: FR → FL → BL → BR → FR.
export const SLOTS: Slot[] = [
  slot('FR', 1, 1, [0, 0, 1], 0),
  slot('FL', -1, 1, [-1, 0, 0], 3),
  slot('BL', -1, -1, [0, 0, -1], 2),
  slot('BR', 1, -1, [1, 0, 0], 1),
];

export function rotateY(facelet: number, quarters: number): number {
  for (let i = 0; i < quarters; i++) facelet = ROTATE_Y[facelet];
  return facelet;
}

// A move written for the slot seen at FR, as the same turn of the real cube:
// the face that the y turns bring to the written face's place.
const SIDE_ORDER: Face[] = ['F', 'L', 'B', 'R'];
export function fromFrontRight(move: Move, quarters: number): Move {
  const index = SIDE_ORDER.indexOf(move.face as Face);
  if (index < 0) return move;
  return { ...move, face: SIDE_ORDER[(index + 4 - quarters) % 4] };
}
