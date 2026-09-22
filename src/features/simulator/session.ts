import { applyMove, inverse, makePreset } from '../../domain/cube/cube.ts';
import type { Cube, Move, Preset } from '../../domain/cube/cube.ts';
import {
  getExercise,
  guideCursor,
  lessonMove,
  trainingStatus,
} from '../../domain/f2l/lessons.ts';
import type { LessonId, LessonSide } from '../../domain/f2l/lessons.ts';

export type QueuedMove = { move: Move; undo?: boolean; backward?: boolean };
export type Session = {
  cube: Cube;
  queue: QueuedMove[];
  progress: number;
  history: Move[];
  preset: Preset;
  setup: Move[];
  message: string;
  initial: Cube;
  lesson: {
    side: LessonSide;
    id: LessonId;
    variant: number;
    cursor: number | null;
  } | null;
};
export type Action =
  | { type: 'move'; move: Move }
  | { type: 'frame'; progress: number; command: QueuedMove }
  | { type: 'preset'; preset: Preset }
  | { type: 'lesson'; id: LessonId; variant?: number; side?: LessonSide }
  | { type: 'seek'; cursor: number }
  | { type: 'guide'; wholeStage?: boolean }
  | { type: 'clear-history' }
  | { type: 'restart' }
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
    initial: cube,
    lesson: null,
  };
}

export function sessionReducer(state: Session, action: Action): Session {
  if (action.type === 'preset') return createSession(action.preset);
  if (action.type === 'lesson') {
    const exercise = getExercise(
      action.id,
      action.variant ?? 0,
      action.side ?? 'right',
    );
    return {
      cube: exercise.initial,
      initial: exercise.initial,
      setup: exercise.setup,
      preset: 'cross',
      queue: [],
      progress: 0,
      history: [],
      message: '',
      lesson: {
        side: exercise.side,
        id: action.id,
        variant: exercise.variant,
        cursor: 0,
      },
    };
  }
  if (action.type === 'clear-history') {
    return {
      ...state,
      history: [],
      queue: [],
      progress: 0,
      message:
        '수순을 비웠습니다. 큐브는 마지막으로 완료된 회전 상태를 유지합니다.',
    };
  }
  if (action.type === 'restart') {
    return {
      ...state,
      cube: state.initial,
      queue: [],
      history: [],
      progress: 0,
      message: '',
      lesson: state.lesson ? { ...state.lesson, cursor: 0 } : null,
    };
  }
  if (action.type === 'seek') {
    if (state.queue.length || !state.lesson || state.lesson.cursor === null)
      return state;
    const exercise = getExercise(
      state.lesson.id,
      state.lesson.variant,
      state.lesson.side,
    );
    const from = state.lesson.cursor;
    const to = action.cursor;
    if (
      !Number.isInteger(to) ||
      to < 0 ||
      to > exercise.solution.length ||
      to === from
    )
      return state;
    // Record actual inverse turns too: seeking must work even after history reset.
    const queue =
      to > from
        ? exercise.solution
            .slice(from, to)
            .map((move) => ({ move: lessonMove(state.cube, move) }))
        : exercise.solution
            .slice(to, from)
            .reverse()
            .map((move) => ({
              move: lessonMove(state.cube, inverse(move)),
              backward: true,
            }));
    return { ...state, queue, message: '' };
  }
  if (action.type === 'guide') {
    if (
      state.queue.length ||
      !state.lesson ||
      state.lesson.cursor === null ||
      trainingStatus(state.cube, state.lesson.side) === 'paired'
    )
      return state;
    const exercise = getExercise(
      state.lesson.id,
      state.lesson.variant,
      state.lesson.side,
    );
    const cursor = state.lesson.cursor;
    const end = action.wholeStage
      ? (exercise.stages.find((stage) => stage.end > cursor)?.end ?? cursor)
      : cursor + 1;
    return {
      ...state,
      queue: exercise.solution
        .slice(cursor, end)
        .map((move) => ({ move: lessonMove(state.cube, move) })),
      message: '',
    };
  }
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
  const cube = applyMove(state.cube, action.command.move);
  return {
    ...state,
    cube,
    lesson: state.lesson
      ? {
          ...state.lesson,
          cursor: guideCursor(
            getExercise(
              state.lesson.id,
              state.lesson.variant,
              state.lesson.side,
            ),
            cube,
            state.lesson.cursor,
            action.command.undo || action.command.backward,
          ),
        }
      : null,
    queue: state.queue.slice(1),
    progress: 0,
    history: action.command.undo
      ? state.history.slice(0, -1)
      : [...state.history, action.command.move],
  };
}
