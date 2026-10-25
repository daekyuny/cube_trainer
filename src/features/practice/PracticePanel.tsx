import { useState } from 'react';
import type { Dispatch } from 'react';
import { trainingStatus } from '../../domain/f2l/lessons';
import { lastLayerStatus } from '../../domain/last-layer/cases';
import { makePractice, PRACTICE_STAGES } from '../../domain/practice/practice';
import type {
  PracticeExercise,
  PracticeStage,
} from '../../domain/practice/practice';
import { moveCount } from '../../domain/training/guide';
import type { Cube } from '../../domain/cube/cube';
import type { Action, PracticeLesson, Session } from '../simulator/session';
import { SolutionSteps } from '../training/SolutionSteps';

function stageStatus(
  exercise: PracticeExercise,
  cube: Cube,
): { status: string; text: string } {
  const goal = PRACTICE_STAGES.find((s) => s.id === exercise.stage)!.goal;
  if (exercise.stage === 'f2l') {
    const color = exercise.side === 'left' ? 'B' : 'G';
    const status = trainingStatus(cube, exercise.side);
    return {
      status: status === 'paired' ? 'complete' : status,
      text:
        status === 'paired'
          ? '페어 완성 · W 십자가와 다른 세 슬롯도 유지했습니다. 새 배치로 계속해 보세요.'
          : status === 'pair-cross-broken'
            ? '페어 연결 · W 십자가와 다른 세 슬롯을 복원하세요.'
            : status === 'cross-broken'
              ? '페어링 중 · 열어 둔 면을 되돌려 W 십자가를 복원하세요.'
              : status === 'slots-disturbed'
                ? '다른 코너·엣지가 흐트러져 있습니다. 다른 세 슬롯까지 복원해야 완료입니다.'
                : `R·${color}·W 코너와 R·${color} 엣지를 Y층에서 붙여 보세요.`,
    };
  }
  const status = lastLayerStatus(cube, exercise.stage);
  return {
    status,
    text:
      status === 'complete'
        ? `${exercise.stage === 'pll-edges' ? '큐브' : goal} 완성 · 새 배치로 계속해 보세요.`
        : status === 'needs-auf'
          ? '윗층만 U로 돌려 맞추면 완성입니다.'
          : status === 'f2l-open'
            ? '공식 진행 중 · 1·2층이 잠시 열려 있습니다. 공식을 끝까지 이어 가세요.'
            : `목표: ${goal} · 1·2층은 유지합니다.`,
  };
}

// Random starts for the five taught stages. The answer stays hidden until
// asked for, and hides again for each new start.
export function PracticePanel({
  session,
  lesson,
  dispatch,
}: {
  session: Session;
  lesson: PracticeLesson | null;
  dispatch: Dispatch<Action>;
}) {
  const [revealed, setRevealed] = useState<PracticeExercise | null>(null);
  const exercise = lesson?.exercise;
  const showGuide = Boolean(exercise) && revealed === exercise;
  const busy = session.queue.length > 0;
  const start = (stage: PracticeStage) =>
    dispatch({ type: 'practice', exercise: makePractice(stage) });
  const feedback = exercise && stageStatus(exercise, session.cube);

  return (
    <section className="lesson-panel" aria-label="단계별 랜덤 연습">
      <div className="panel-heading">
        <h2>단계별 연습 · 랜덤 배치</h2>
        <span>5 STAGES</span>
      </div>
      <p className="lesson-premise">
        단계를 고르면 앞 단계까지 맞춘 상태에서 그 단계의 케이스를 무작위 배치로
        냅니다.
      </p>
      <div className="practice-stages" role="group" aria-label="연습 단계">
        {PRACTICE_STAGES.map((stage) => (
          <button
            key={stage.id}
            aria-pressed={exercise?.stage === stage.id}
            onClick={() => start(stage.id)}
          >
            <strong>{stage.title}</strong>
            <span>{stage.goal}</span>
          </button>
        ))}
      </div>
      {exercise && feedback ? (
        <div className="practice-body" data-stage={exercise.stage}>
          <div
            className={`lesson-feedback feedback-${feedback.status}`}
            role="status"
            data-testid="lesson-status"
            data-status={feedback.status}
          >
            {busy ? '회전 중 · 조각의 움직임을 따라가 보세요.' : feedback.text}
          </div>
          <div className="lesson-actions">
            <button
              className="primary-button"
              onClick={() => start(exercise.stage)}
            >
              새 배치
            </button>
            <button
              className="secondary-button"
              onClick={() => dispatch({ type: 'restart' })}
            >
              같은 배치 다시
            </button>
          </div>
          <div className="solution-heading">
            <strong>
              풀이
              {showGuide && <span> · {moveCount(exercise.tokens)}수</span>}
            </strong>
            <button
              className="text-button"
              aria-expanded={showGuide}
              aria-controls="practice-guide"
              onClick={() => setRevealed(showGuide ? null : exercise)}
            >
              {showGuide ? '풀이 숨김' : '풀이 보기'}
            </button>
          </div>
          {showGuide ? (
            <div
              className="lesson-guide"
              id="practice-guide"
              data-testid="practice-guide"
            >
              <p className="case-recognition">
                <strong>케이스</strong> {exercise.caseName}
              </p>
              <p className="case-recognition">
                <strong>인식</strong> {exercise.recognition}{' '}
                <small className="recognition-frame">
                  (시작 배치 기준 · 앞 = 크게 보이는 왼쪽 면)
                </small>
              </p>
              {exercise.turnNote && (
                <p className="notation-note" data-testid="practice-auf">
                  {exercise.turnNote}
                </p>
              )}
              <SolutionSteps
                exercise={exercise}
                cursor={lesson!.cursor}
                cube={session.cube}
                busy={busy}
                dispatch={dispatch}
                doneLabel="단계 완료"
              >
                <details className="lesson-detail">
                  <summary>풀이 설명</summary>
                  <p>{exercise.hint}</p>
                </details>
              </SolutionSteps>
            </div>
          ) : (
            <p className="hidden-guide-note">
              케이스를 알아보고 직접 풀어 보세요. 막히면 풀이 보기를 누릅니다.
            </p>
          )}
        </div>
      ) : (
        <p className="hidden-guide-note">
          연습할 단계를 고르세요. 큐브는 자유롭게 돌려 볼 수 있습니다.
        </p>
      )}
    </section>
  );
}
