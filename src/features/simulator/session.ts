import {
  applyMove,
  inverse,
  isSolved,
  makePreset,
} from '../../domain/cube/cube.ts';
import type { Cube, Move, Preset } from '../../domain/cube/cube.ts';
import { getExercise, trainingStatus } from '../../domain/f2l/lessons.ts';
import type { LessonId, LessonSide } from '../../domain/f2l/lessons.ts';
import {
  getLastLayerExercise,
  lastLayerStatus,
} from '../../domain/last-layer/cases.ts';
import type { LastLayerCaseId } from '../../domain/last-layer/cases.ts';
import { isPracticeComplete } from '../../domain/practice/practice.ts';
import type { PracticeExercise } from '../../domain/practice/practice.ts';
import type { SolveExercise } from '../../domain/solver/demo.ts';
import { guideCursor, lessonMove } from '../../domain/training/guide.ts';
import type { GuidedExercise } from '../../domain/training/guide.ts';

// `from`: a released drag continues animating from the progress it reached.
export type QueuedMove = {
  move: Move;
  undo?: boolean;
  backward?: boolean;
  from?: number;
};
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
  | { kind: 'last-layer'; id: LastLayerCaseId; cursor: number | null }
  // A generated random start: the exercise itself is kept, not an id.
  | { kind: 'practice'; exercise: PracticeExercise; cursor: number | null }
  // A solution demo: a scrambled or photographed start and its solution.
  | { kind: 'solve'; exercise: SolveExercise; cursor: number | null };
export type F2LLesson = Extract<Lesson, { kind: 'f2l' }>;
export type LastLayerLesson = Extract<Lesson, { kind: 'last-layer' }>;
export type PracticeLesson = Extract<Lesson, { kind: 'practice' }>;
export type SolveLesson = Extract<Lesson, { kind: 'solve' }>;
export type Action =
  | { type: 'move'; move: Move; from?: number }
  | { type: 'frame'; progress: number; command: QueuedMove }
  | { type: 'preset'; preset: Preset }
  | { type: 'lesson'; id: LessonId; variant?: number; side?: LessonSide }
  | { type: 'last-layer'; id: LastLayerCaseId }
  // Generated outside the reducer so the reducer stays pure.
  | { type: 'practice'; exercise: PracticeExercise }
  | { type: 'solve'; exercise: SolveExercise }
  | { type: 'seek'; cursor: number }
  // `to`: play on up to that cursor (a demo stage's end).
  | { type: 'guide'; wholeStage?: boolean; to?: number }
  // Demo only: put the cube at a cursor's checkpoint at once.
  | { type: 'jump'; cursor: number }
  // Let the turn in progress finish and drop the rest of the queue.
  | { type: 'pause' }
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
    : lesson.kind === 'practice' || lesson.kind === 'solve'
      ? lesson.exercise
      : getLastLayerExercise(lesson.id);
}

export function isLessonComplete(lesson: Lesson, cube: Cube): boolean {
  if (lesson.kind === 'practice')
    return isPracticeComplete(lesson.exercise, cube);
  if (lesson.kind === 'solve') return isSolved(cube);
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
  if (action.type === 'practice')
    return startLesson(
      action.exercise,
      action.exercise.stage === 'f2l' ? 'cross' : 'f2l',
      { kind: 'practice', exercise: action.exercise, cursor: 0 },
    );
  if (action.type === 'solve')
    return startLesson(action.exercise, 'random', {
      kind: 'solve',
      exercise: action.exercise,
      cursor: 0,
    });
  if (action.type === 'pause')
    return state.queue.length > 1
      ? { ...state, queue: state.queue.slice(0, 1) }
      : state;
  if (action.type === 'jump') {
    if (state.queue.length || state.lesson?.kind !== 'solve') return state;
    const { checkpoints } = state.lesson.exercise;
    if (
      !Number.isInteger(action.cursor) ||
      action.cursor < 0 ||
      action.cursor >= checkpoints.length
    )
      return state;
    // A jump is not a turn: the history starts over from the new position.
    return {
      ...state,
      cube: checkpoints[action.cursor],
      history: [],
      progress: 0,
      message: '',
      lesson: { ...state.lesson, cursor: action.cursor },
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
    // One viewing frame maps the whole run: queued moves keep it unchanged.
    const reference = exercise.checkpoints[from];
    const queue =
      to > from
        ? exercise.solution
            .slice(from, to)
            .map((move) => ({ move: lessonMove(state.cube, move, reference) }))
        : exercise.solution
            .slice(to, from)
            .reverse()
            .map((move) => ({
              move: lessonMove(state.cube, inverse(move), reference),
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
    // Lessons guide a single stage: the whole printed algorithm. A demo
    // plays one of its stages with `to`.
    const end = Math.min(
      exercise.solution.length,
      action.to ?? (action.wholeStage ? exercise.solution.length : cursor + 1),
    );
    if (end <= cursor) return state;
    return {
      ...state,
      queue: exercise.solution.slice(cursor, end).map((move) => ({
        move: lessonMove(state.cube, move, exercise.checkpoints[cursor]),
      })),
      message: '',
    };
  }
  if (action.type === 'move') {
    if (state.queue.length >= 20)
      return {
        ...state,
        message: '입력이 많이 쌓였습니다. 잠시 후 다시 눌러 주세요.',
      };
    const from =
      action.from !== undefined && !state.queue.length
        ? Math.min(1, Math.max(0, action.from))
        : undefined;
    return {
      ...state,
      queue: [
        ...state.queue,
        from === undefined
          ? { move: action.move }
          : { move: action.move, from },
      ],
      progress: state.queue.length ? state.progress : (from ?? 0),
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
            state.cube,
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
