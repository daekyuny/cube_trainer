import { applyMoves } from '../cube/cube.ts';
import type { Cube, Move } from '../cube/cube.ts';
import { parseAlgorithm } from '../training/guide.ts';
import { F2L_TABLE } from './f2lTable.ts';
import {
  fromFrontRight,
  homeFacelet,
  rotateY,
  SLOTS,
  stickerFacelets,
} from './pieces.ts';
import type { Slot } from './pieces.ts';

export type PairStep = { slot: Slot; moves: Move[] };

export function isSlotSolved(cube: Cube, slot: Slot): boolean {
  const where = stickerFacelets(cube);
  return (
    where.get(slot.corner) === homeFacelet(slot.corner) &&
    where.get(slot.edge) === homeFacelet(slot.edge)
  );
}

// The table answer for one slot, seen from FR and turned back to the slot.
export function pairMoves(cube: Cube, slot: Slot): Move[] {
  const where = stickerFacelets(cube);
  const q = slot.toFrontRight;
  const corner = rotateY(where.get(slot.corner)!, q);
  const edge = rotateY(where.get(slot.edge)!, q);
  if (isSlotSolved(cube, slot)) return [];
  const answer = F2L_TABLE[`${corner}:${edge}`];
  if (answer === undefined) throw new Error('F2L needs a solved white cross');
  return parseAlgorithm(answer).map((move) => fromFrontRight(move, q));
}

// With the cross solved, take the slot with the shortest pair solution each
// time; every answer keeps the cross and the slots already finished.
export function solveF2L(cube: Cube): PairStep[] {
  const steps: PairStep[] = [];
  for (;;) {
    const open = SLOTS.filter((slot) => !isSlotSolved(cube, slot));
    if (!open.length) return steps;
    const options = open.map((slot) => ({
      slot,
      moves: pairMoves(cube, slot),
    }));
    const best = options.reduce((a, b) =>
      b.moves.length < a.moves.length ? b : a,
    );
    steps.push(best);
    cube = applyMoves(cube, best.moves);
  }
}
