import { applyMove, inverse, makePreset } from '../../domain/cube/cube.ts';
import type { Cube, Move, Preset } from '../../domain/cube/cube.ts';
import { getExercise, trainingStatus } from '../../domain/f2l/lessons.ts';
import type { LessonId, LessonSide } from '../../domain/f2l/lessons.ts';
import {
  getLastLayerExercise,
  lastLayerStatus,
} from '../../domain/last-layer/cases.ts';
import type { LastLayerCaseId } from '../../domain/last-layer/cases.ts';
import { guideCursor, lessonMove } from '../../domain/training/guide.ts';
import type { GuidedExercise } from '../../domain/training/guide.ts';

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
  lesson: Lesson | null;
};
export type Lesson =
  | {
      kind: 'f2l';
      side: LessonSide;
      id: LessonId;
      variant: number;
      cursor: number | null;
    }
  | { kind: 'last-layer'; id: LastLayerCaseId; cursor: number | null };
export type F2LLesson = Extract<Lesson, { kind: 'f2l' }>;
export type LastLayerLesson = Extract<Lesson, { kind: 'last-layer' }>;
export type Action =
  | { type: 'move'; move: Move }
  | { type: 'frame'; progress: number; command: QueuedMove }
  | { type: 'preset'; preset: Preset }
  | { type: 'lesson'; id: LessonId; variant?: number; side?: LessonSide }
  | { type: 'last-layer'; id: LastLayerCaseId }
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

export function lessonExercise(lesson: Lesson): GuidedExercise {
  return lesson.kind === 'f2l'
    ? getExercise(lesson.id, lesson.variant, lesson.side)
    : getLastLayerExercise(lesson.id);
}

export function isLessonComplete(lesson: Lesson, cube: Cube): boolean {
  return lesson.kind === 'f2l'
    ? trainingStatus(cube, lesson.side) === 'paired'
    : lastLayerStatus(cube, getLastLayerExercise(lesson.id).case.step) ===
        'complete';
}

function startLesson(
  exercise: GuidedExercise,
  preset: Preset,
  lesson: Lesson,
): Session {
  return {
    cube: exercise.initial,
    initial: exercise.initial,
    setup: exercise.setup,
    preset,
    queue: [],
    progress: 0,
    history: [],
    message: '',
    lesson,
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
    return startLesson(exercise, 'cross', {
      kind: 'f2l',
      side: exercise.side,
      id: action.id,
      variant: exercise.variant,
      cursor: 0,
    });
  }
  if (action.type === 'last-layer')
    return startLesson(getLastLayerExercise(action.id), 'f2l', {
      kind: 'last-layer',
      id: action.id,
      cursor: 0,
    });
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
    const exercise = lessonExercise(state.lesson);
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
      isLessonComplete(state.lesson, state.cube)
    )
      return state;
    const exercise = lessonExercise(state.lesson);
    const cursor = state.lesson.cursor;
    // Every lesson guides a single stage: the whole printed algorithm.
    const end = action.wholeStage ? exercise.solution.length : cursor + 1;
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
            lessonExercise(state.lesson),
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
