import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import {
  applyMoves,
  isSolved,
  notation,
  solvedCube,
} from '../../domain/cube/cube';
import type { Color, Cube, Move } from '../../domain/cube/cube';
import type { SolveStage } from '../../domain/solver/cfop';
import {
  buildSolveExercise,
  currentStage,
  optimalStages,
  pendingExercise,
  randomStart,
} from '../../domain/solver/demo';
import { parseAlgorithm } from '../../domain/training/guide';
import { PhotoScan } from '../scan/PhotoScan';
import type { SolveExercise, SolveMethod } from '../../domain/solver/demo';
import type { Action, Session, SolveLesson } from '../simulator/session';
import { SolutionSteps } from '../training/SolutionSteps';
import { PLAYBACK_SPEEDS } from './playback';
import type { PlaybackSpeed } from './playback';
import { useSolver } from './useSolver';

type Start = { initial: Cube; setup: Move[]; source: string };
type Results = {
  id: number;
  start: Start;
  cfop?: SolveStage[];
  optimal?: string;
  error?: string;
};

function exerciseFor(
  results: Results,
  method: SolveMethod,
): SolveExercise | null {
  const stages =
    method === 'cfop'
      ? results.cfop
      : results.optimal === undefined
        ? undefined
        : optimalStages(results.optimal);
  if (!stages) return null;
  const { initial, setup, source } = results.start;
  return buildSolveExercise(initial, setup, method, source, stages);
}

// Scramble (or photograph) a cube, then watch it solved: CFOP in six stages,
// or the nearly optimal two-phase answer, at a chosen playback speed.
export function SolverPanel({
  session,
  lesson,
  dispatch,
  speed,
  onSpeedChange,
}: {
  session: Session;
  lesson: SolveLesson | null;
  dispatch: Dispatch<Action>;
  speed: PlaybackSpeed;
  onSpeedChange: (speed: PlaybackSpeed) => void;
}) {
  const exercise = lesson?.exercise ?? null;
  const cursor = lesson?.cursor ?? null;
  const busy = session.queue.length > 0;
  const [method, setMethod] = useState<SolveMethod>('cfop');
  const [results, setResults] = useState<Results | null>(null);
  const starts = useRef(new Map<number, Start>());
  // Photo input: open, rebuilding the cube from its colors, or failed.
  const [scanning, setScanning] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoRequest = useRef<number | null>(null);

  const request = useSolver((response) => {
    if (response.id === photoRequest.current) {
      photoRequest.current = null;
      setPhotoBusy(false);
      if (response.kind !== 'start') {
        setPhotoError(
          '이 색 배치로는 큐브를 만들 수 없습니다. 색을 다시 확인해 주세요.',
        );
        return;
      }
      const setup = parseAlgorithm(response.setup);
      setScanning(false);
      dispatch({
        type: 'solve',
        exercise: pendingExercise(
          applyMoves(solvedCube(), setup),
          setup,
          '사진 입력',
        ),
      });
      return;
    }
    const start = starts.current.get(response.id);
    if (!start || response.kind === 'start') return;
    const merged: Results = {
      ...(results?.id === response.id ? results : { id: response.id, start }),
      ...(response.kind === 'cfop'
        ? { cfop: response.stages }
        : response.kind === 'optimal'
          ? { optimal: response.algorithm }
          : { error: response.message }),
    };
    setResults(merged);
    // Show the answer the panel is waiting for as soon as it arrives.
    if (response.kind === method && exercise?.initial === start.initial) {
      const ready = exerciseFor(merged, method);
      if (ready) dispatch({ type: 'solve', exercise: ready });
    }
  });

  // Each new start (a scramble, or entering the mode) is solved once.
  const requested = useRef<Cube | null>(null);
  useEffect(() => {
    if (!exercise?.pending || requested.current === exercise.initial) return;
    requested.current = exercise.initial;
    const id = request({ cube: exercise.initial });
    starts.current = new Map([
      [
        id,
        {
          initial: exercise.initial,
          setup: exercise.setup,
          source: exercise.source,
        },
      ],
    ]);
    // An unmount (or React's development double run) drops the worker, so
    // the same start is asked again on the next run.
    return () => {
      requested.current = null;
    };
  }, [exercise, request]);

  const fromPhoto = (colors: Color[]) => {
    setPhotoError(null);
    setPhotoBusy(true);
    photoRequest.current = request({ colors });
  };

  const current = results?.start.initial === exercise?.initial ? results : null;
  const built = useMemo(
    () => ({
      cfop: current && exerciseFor(current, 'cfop'),
      optimal: current && exerciseFor(current, 'optimal'),
    }),
    [current],
  );
  const chooseMethod = (next: SolveMethod) => {
    setMethod(next);
    const ready = built[next];
    if (ready && (exercise?.pending || exercise?.method !== next))
      dispatch({ type: 'solve', exercise: ready });
  };
  const totalMoves = (item: SolveExercise | null) =>
    item?.stages.reduce((sum, stage) => sum + stage.moves, 0);
  const waiting = !exercise || exercise.pending || exercise.method !== method;
  const stage =
    exercise && !waiting && cursor !== null
      ? currentStage(exercise, cursor)
      : undefined;
  const solved = isSolved(session.cube);
  const cfopTotal = totalMoves(built.cfop);
  const optimalTotal = totalMoves(built.optimal);

  const status = current?.error
    ? `해법을 찾지 못했습니다 · ${current.error}`
    : waiting
      ? method === 'optimal'
        ? '거의 최적 해법 계산 중… 휴대폰에서는 몇 초 걸릴 수 있습니다.'
        : '해법 계산 중…'
      : busy
        ? '재생 중 · 멈춤으로 언제든 멈출 수 있습니다.'
        : solved
          ? `완성 · ${totalMoves(exercise)}수로 맞췄습니다. 새로 섞어 다시 보세요.`
          : cursor === null
            ? '예시 수순 밖입니다. 단계를 눌러 그 단계 시작으로 옮기거나 처음으로 돌아가세요.'
            : stage
              ? `${exercise!.method === 'cfop' ? `${exercise!.stages.indexOf(stage) + 1}/6 · ` : ''}${stage.title} → ${stage.goal}`
              : '';

  return (
    <section className="lesson-panel solver-panel" aria-label="풀이 데모">
      <div className="panel-heading">
        <h2>풀이 데모 · 섞고 맞추기</h2>
        <span>SOLVER</span>
      </div>
      <p className="lesson-premise">
        섞인 큐브를 CFOP 여섯 단계(십자 → F2L → OLL 1·2 → PLL 1·2) 또는 거의
        최적 해법으로 맞추는 과정을 보여 줍니다.
      </p>
      <div className="solver-sources" role="group" aria-label="섞을 방법">
        <button
          className="primary-button"
          aria-pressed={!scanning}
          onClick={() => {
            setScanning(false);
            dispatch({ type: 'solve', exercise: randomStart() });
          }}
        >
          랜덤 섞기
        </button>
        <button
          className="secondary-button"
          aria-pressed={scanning}
          onClick={() => {
            setPhotoError(null);
            setScanning(true);
          }}
        >
          사진으로 입력
        </button>
      </div>
      {scanning && (
        <PhotoScan
          busy={photoBusy}
          error={photoError}
          onColors={fromPhoto}
          onCancel={() => setScanning(false)}
        />
      )}
      {!scanning && exercise && (
        <details className="lesson-detail scramble-detail">
          <summary>
            {exercise.source === '사진 입력'
              ? '사진 입력 · 이 배치를 만드는 수순'
              : `섞은 상태 · ${exercise.source}`}
          </summary>
          <p data-testid="scramble-moves">
            {exercise.setup.map(notation).join(' ')}
          </p>
        </details>
      )}
      {!scanning && (
        <>
          <div className="solver-methods" role="group" aria-label="풀이 방법">
            <button
              aria-pressed={method === 'cfop'}
              onClick={() => chooseMethod('cfop')}
            >
              <strong>CFOP 6단계</strong>
              <span>
                {cfopTotal === undefined ? '계산 중' : `${cfopTotal}수`}
              </span>
            </button>
            <button
              aria-pressed={method === 'optimal'}
              onClick={() => chooseMethod('optimal')}
            >
              <strong>거의 최적</strong>
              <span>
                {optimalTotal === undefined ? '계산 중' : `${optimalTotal}수`}
              </span>
            </button>
          </div>
          <div
            className={`lesson-feedback feedback-${solved && !waiting ? 'complete' : 'working'}`}
            role="status"
            data-testid="solver-status"
            data-status={waiting ? 'pending' : solved ? 'complete' : 'ready'}
          >
            {status}
          </div>
          <div className="solver-playback">
            <div className="lesson-actions">
              {busy ? (
                <button
                  className="primary-button"
                  onClick={() => dispatch({ type: 'pause' })}
                >
                  ❚❚ 멈춤
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={waiting || solved || cursor === null}
                  onClick={() => dispatch({ type: 'guide', wholeStage: true })}
                >
                  ▶ 전체 재생
                </button>
              )}
              <button
                className="secondary-button"
                disabled={waiting || busy || cursor === 0}
                onClick={() => dispatch({ type: 'jump', cursor: 0 })}
              >
                처음으로
              </button>
            </div>
            <div className="speed-control" role="group" aria-label="재생 속도">
              <span>속도</span>
              {PLAYBACK_SPEEDS.map((value) => (
                <button
                  key={value}
                  aria-pressed={speed === value}
                  onClick={() => onSpeedChange(value)}
                >
                  {value}×
                </button>
              ))}
            </div>
          </div>
          {exercise && !waiting && (
            <ol className="solver-stages" aria-label="풀이 단계">
              {exercise.stages.map((item, index) => {
                const state =
                  item.start === item.end
                    ? 'skipped'
                    : cursor !== null && cursor >= item.end
                      ? 'done'
                      : item === stage
                        ? 'current'
                        : 'todo';
                return (
                  <li key={item.id} data-stage={item.id} data-state={state}>
                    <button
                      className="stage-row"
                      aria-current={state === 'current' ? 'step' : undefined}
                      disabled={busy || state === 'skipped'}
                      onClick={() =>
                        dispatch({ type: 'jump', cursor: item.start })
                      }
                      title="이 단계 시작으로 이동"
                    >
                      <span className="stage-number">
                        {state === 'done' ? '✓' : index + 1}
                      </span>
                      <strong>{item.title}</strong>
                      <span className="stage-goal">{item.goal}</span>
                      <span className="stage-moves">
                        {state === 'skipped' ? '건너뜀' : `${item.moves}수`}
                      </span>
                    </button>
                    {item.skipped && state === 'skipped' && (
                      <p className="stage-note">{item.skipped}</p>
                    )}
                    {state === 'current' && cursor !== null && (
                      <div className="stage-body" data-testid="stage-body">
                        <ul className="stage-parts">
                          {item.parts.map((part) => (
                            <li
                              key={part.start}
                              data-current={
                                cursor >= part.start && cursor < part.end
                              }
                            >
                              <strong>{part.label}</strong> · {part.moves}수
                              {part.note && <small>{part.note}</small>}
                            </li>
                          ))}
                        </ul>
                        <SolutionSteps
                          exercise={exercise}
                          cursor={cursor}
                          cube={session.cube}
                          busy={busy}
                          dispatch={dispatch}
                          doneLabel="단계 완료"
                          range={item}
                          breaks={item.parts
                            .slice(1)
                            .map((part) => part.tokenStart)}
                          playLabel="이 단계 재생"
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
