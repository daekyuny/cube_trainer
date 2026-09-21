import { applyMove, inverse, makePreset } from '../../domain/cube/cube.ts';
import type { Cube, Move, Preset } from '../../domain/cube/cube.ts';

export type QueuedMove = { move: Move; undo?: boolean };
export type Session = {
  cube: Cube;
  queue: QueuedMove[];
  progress: number;
  history: Move[];
  preset: Preset;
  setup: Move[];
  message: string;
};
export type Action =
  | { type: 'move'; move: Move }
  | { type: 'frame'; progress: number; command: QueuedMove }
  | { type: 'preset'; preset: Preset }
  | { type: 'undo' };

export function createSession(preset: Preset = 'solved'): Session {
  const { cube, moves } = makePreset(preset);
  return {
    cube,
    queue: [],
    progress: 0,
    history: [],
    preset,
    setup: moves,
    message: '',
  };
}

export function sessionReducer(state: Session, action: Action): Session {
  if (action.type === 'preset') return createSession(action.preset);
  if (action.type === 'move') {
    if (state.queue.length >= 20)
      return {
        ...state,
        message: '입력이 많이 쌓였습니다. 잠시 후 다시 눌러 주세요.',
      };
    return {
      ...state,
      queue: [...state.queue, { move: action.move }],
      message: '',
    };
  }
  if (action.type === 'undo') {
    if (state.queue.length || !state.history.length) return state;
    return {
      ...state,
      queue: [{ move: inverse(state.history.at(-1)!), undo: true }],
    };
  }
  if (state.queue[0] !== action.command) return state;
  if (action.progress < 1) return { ...state, progress: action.progress };
  return {
    ...state,
    cube: applyMove(state.cube, action.command.move),
    queue: state.queue.slice(1),
    progress: 0,
    history: action.command.undo
      ? state.history.slice(0, -1)
      : [...state.history, action.command.move],
  };
}
