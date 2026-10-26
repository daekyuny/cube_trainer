import type { Cube, Move } from '../cube/cube.ts';
import { FACE_MOVES, FACELETS } from './facelets.ts';
import {
  CROSS_STICKERS,
  homeFacelet,
  MOVE_PERMUTATIONS,
  stickerFacelets,
} from './pieces.ts';

// Edge facelets (two per edge piece) numbered 0..23.
const EDGE_FACELETS = FACELETS.map((_, index) => index).filter(
  (index) => FACELETS[index].position.filter((v) => v !== 0).length === 2,
);
const RANK = new Map(EDGE_FACELETS.map((f, rank) => [f, rank]));
const encode = (facelets: readonly number[]) =>
  facelets.reduce((index, f) => index * 24 + RANK.get(f)!, 0);
const decode = (index: number) =>
  [0, 0, 0, 0]
    .map(() => {
      const f = EDGE_FACELETS[index % 24];
      index = Math.floor(index / 24);
      return f;
    })
    .reverse();

// Exact distance (face turns) from every cross-edge state to the solved
// cross; built once by breadth-first search, under 0.2 s.
let distances: Uint8Array | null = null;
function crossDistances(): Uint8Array {
  if (distances) return distances;
  const table = new Uint8Array(24 ** 4).fill(255);
  let frontier = [encode(CROSS_STICKERS.map(homeFacelet))];
  table[frontier[0]] = 0;
  for (let depth = 0; frontier.length; depth++) {
    const next: number[] = [];
    for (const index of frontier) {
      const state = decode(index);
      for (const permutation of MOVE_PERMUTATIONS) {
        const to = encode(state.map((f) => permutation[f]));
        if (table[to] === 255) {
          table[to] = depth + 1;
          next.push(to);
        }
      }
    }
    frontier = next;
  }
  return (distances = table);
}

// A shortest white cross: each step takes a move one closer to solved.
export function solveCross(cube: Cube): Move[] {
  const table = crossDistances();
  const where = stickerFacelets(cube);
  let state = CROSS_STICKERS.map((id) => where.get(id)!);
  const moves: Move[] = [];
  while (table[encode(state)] > 0) {
    const distance = table[encode(state)];
    const index = MOVE_PERMUTATIONS.findIndex(
      (permutation) =>
        table[encode(state.map((f) => permutation[f]))] === distance - 1,
    );
    moves.push(FACE_MOVES[index]);
    state = state.map((f) => MOVE_PERMUTATIONS[index][f]);
  }
  return moves;
}
