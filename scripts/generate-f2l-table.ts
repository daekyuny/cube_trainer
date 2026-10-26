// Builds src/domain/solver/f2lTable.ts: for the front-right slot, a shortest
// face-turn sequence (no D turns) for every place of its corner and edge that
// solves the pair, keeps the white cross, and keeps every other slot that does
// not hold one of the two pieces. Run: node scripts/generate-f2l-table.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { FACE_MOVES, FACELETS } from '../src/domain/solver/facelets.ts';
import {
  CROSS_STICKERS,
  homeFacelet,
  MOVE_PERMUTATIONS,
  SLOTS,
} from '../src/domain/solver/pieces.ts';
import { notation } from '../src/domain/cube/cube.ts';

const MOVES = FACE_MOVES.map((move, index) => ({ move, index })).filter(
  ({ move }) => move.face !== 'D',
);
const AXIS: Record<string, number> = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
const COST: Record<string, number> = { U: 0, R: 0, F: 1, L: 2, B: 3 };
const BACKWARD_DEPTH = 5;
const FORWARD_LIMIT = 8;

const [target, ...others] = SLOTS;
const isCorner = (f: number) =>
  FACELETS[f].position.every((value) => value !== 0);
const isEdge = (f: number) =>
  FACELETS[f].position.filter((value) => value !== 0).length === 2;
const slotAt = (f: number) =>
  others.find((slot) => {
    const home = (id: string) => FACELETS[homeFacelet(id)].position;
    const p = FACELETS[f].position;
    const same = (q: readonly number[]) => q.every((v, i) => v === p[i]);
    return same(home(slot.corner)) || same(home(slot.edge));
  });

// Moves after `last` worth trying: never the same face twice, and opposite
// faces only in one order.
function allowed(last: number) {
  if (last < 0) return MOVES;
  const face = FACE_MOVES[last].face;
  return MOVES.filter(
    ({ move }) =>
      move.face !== face &&
      !(AXIS[move.face] === AXIS[face] && move.face < face),
  );
}
const key = (state: number[]) => String.fromCharCode(...state);
const step = (state: number[], index: number) =>
  state.map((f) => MOVE_PERMUTATIONS[index][f]);
const inverseIndex = (index: number) => {
  const { face, turns } = FACE_MOVES[index];
  return FACE_MOVES.findIndex(
    (m) => m.face === face && m.turns === (turns === 2 ? 2 : -turns),
  );
};

type Backward = Map<string, number[]>;
function backwardTable(goal: number[]): Backward {
  const table: Backward = new Map([[key(goal), []]]);
  let frontier: { state: number[]; path: number[] }[] = [
    { state: goal, path: [] },
  ];
  for (let depth = 0; depth < BACKWARD_DEPTH; depth++) {
    const next: typeof frontier = [];
    for (const { state, path } of frontier)
      for (const { index } of allowed(path.at(-1) ?? -1)) {
        const to = step(state, index);
        const k = key(to);
        if (table.has(k)) continue;
        const toPath = [...path, index];
        table.set(k, toPath);
        next.push({ state: to, path: toPath });
      }
    frontier = next;
  }
  return table;
}

const cost = (path: number[]) =>
  path.reduce((sum, index) => sum + COST[FACE_MOVES[index].face], 0);

function solve(start: number[], table: Backward): number[] {
  let best: number[] | null = null;
  const path: number[] = [];
  const visit = (state: number[], depth: number) => {
    if (depth === 0) {
      const back = table.get(key(state));
      if (!back) return;
      // Undo the goal-side path: reverse order, inverse turns.
      const full = [...path, ...[...back].reverse().map(inverseIndex)];
      if (
        !best ||
        full.length < best.length ||
        (full.length === best.length && cost(full) < cost(best))
      )
        best = full;
      return;
    }
    for (const { index } of allowed(path.at(-1) ?? -1)) {
      path.push(index);
      visit(step(state, index), depth - 1);
      path.pop();
    }
  };
  for (let forward = 0; forward <= FORWARD_LIMIT; forward++) {
    visit(start, forward);
    // Any shorter answer would have met the table at an earlier depth.
    if (best && (best as number[]).length <= forward + BACKWARD_DEPTH)
      return best;
  }
  throw new Error('no solution within the search limit');
}

const tables = new Map<string, Backward>();
const entries: [string, string][] = [];
const started = Date.now();
const corners = FACELETS.map((_, f) => f).filter(isCorner);
const edges = FACELETS.map((_, f) => f).filter(
  (f) => isEdge(f) && FACELETS[f].position[1] !== -1,
);
for (const corner of corners)
  for (const edge of edges) {
    if (
      corner === homeFacelet(target.corner) &&
      edge === homeFacelet(target.edge)
    )
      continue;
    const freed = new Set([slotAt(corner), slotAt(edge)].filter(Boolean));
    const kept = others.filter((slot) => !freed.has(slot));
    const ids = [
      ...CROSS_STICKERS,
      ...kept.flatMap((slot) => [slot.corner, slot.edge]),
    ];
    const goal = [
      ...ids.map(homeFacelet),
      homeFacelet(target.corner),
      homeFacelet(target.edge),
    ];
    const name = kept.map((slot) => slot.id).join();
    if (!tables.has(name)) tables.set(name, backwardTable(goal));
    const start = [...ids.map(homeFacelet), corner, edge];
    const answer = solve(start, tables.get(name)!);
    entries.push([
      `${corner}:${edge}`,
      answer.map((index) => notation(FACE_MOVES[index])).join(' '),
    ]);
    process.stderr.write(
      `${entries.length} ${corner}:${edge} ${answer.length} (${((Date.now() - started) / 1000).toFixed(0)}s)\n`,
    );
  }

const file = fileURLToPath(
  new URL('../src/domain/solver/f2lTable.ts', import.meta.url),
);
const source = `// Generated by scripts/generate-f2l-table.ts — do not edit by hand.
// Front-right slot: "corner facelet:edge facelet" (white corner sticker,
// front-face edge sticker) → shortest pair solution keeping the cross and
// every other slot that holds neither piece.
export const F2L_TABLE: Record<string, string> = {
${entries.map(([k, v]) => `  '${k}': "${v}",`).join('\n')}
};
`;
writeFileSync(
  file,
  await format(source, { ...(await resolveConfig(file)), filepath: file }),
);
