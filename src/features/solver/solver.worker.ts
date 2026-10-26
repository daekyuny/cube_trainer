import type { Color, Cube } from '../../domain/cube/cube';
import { solveCfop } from '../../domain/solver/cfop';
import type { SolveStage } from '../../domain/solver/cfop';
import {
  cubeFromColors,
  setupText,
  solveNearOptimal,
} from '../../domain/solver/optimal';

// Solve a cube, or (from a photo) first rebuild one from its 54 colors.
export type SolveRequest =
  { id: number; cube: Cube } | { id: number; colors: Color[] };
// CFOP takes milliseconds and arrives first; the two-phase search follows.
export type SolveResponse =
  | { id: number; kind: 'cfop'; stages: SolveStage[] }
  | { id: number; kind: 'optimal'; algorithm: string }
  | { id: number; kind: 'start'; setup: string }
  | { id: number; kind: 'error'; message: string };

const scope = self as unknown as Worker;
const reply = (response: SolveResponse) => scope.postMessage(response);

scope.onmessage = (event: MessageEvent<SolveRequest>) => {
  const { id } = event.data;
  try {
    if ('colors' in event.data) {
      const { setup } = cubeFromColors(event.data.colors);
      reply({ id, kind: 'start', setup: setupText(setup) });
      return;
    }
    const { cube } = event.data;
    reply({ id, kind: 'cfop', stages: solveCfop(cube) });
    reply({ id, kind: 'optimal', algorithm: solveNearOptimal(cube) });
  } catch (error) {
    reply({ id, kind: 'error', message: String(error) });
  }
};
