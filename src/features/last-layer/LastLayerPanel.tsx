import { useState } from 'react';
import type { Dispatch } from 'react';
import { useLessonTransition } from '../f2l/useLessonTransition';
import {
  getLastLayerExercise,
  LAST_LAYER_STEPS,
  lastLayerCases,
  lastLayerSet,
  lastLayerStatus,
} from '../../domain/last-layer/cases';
import type { LastLayerCaseId } from '../../domain/last-layer/cases';
import type { Action, LastLayerLesson, Session } from '../simulator/session';
import { SolutionSteps } from '../training/SolutionSteps';

export function LastLayerPanel({
  session,
  lesson,
  dispatch,
}: {
  session: Session;
  lesson: LastLayerLesson;
  dispatch: Dispatch<Action>;
}) {
  const [showGuide, setShowGuide] = useState(true);
  const { container: casePickerRef, prepare: prepareTransition } =
    useLessonTransition(`${lesson.id}/${showGuide}`);
  const set = lastLayerSet(lesson.id);
  const exercise = getLastLayerExercise(lesson.id);
  const step = LAST_LAYER_STEPS.find((item) => item.id === exercise.case.step)!;
  const busy = session.queue.length > 0;
  const status = lastLayerStatus(session.cube, step.id);
  const next = exercise.case.next
    ? getLastLayerExercise(exercise.case.next).case
    : null;
  const nextStep =
    next && LAST_LAYER_STEPS.find((item) => item.id === next.step)!;
  const select = (id: LastLayerCaseId) => {
    prepareTransition();
    dispatch({ type: 'last-layer', id });
  };
  const statusText =
    status === 'complete'
      ? step.id === 'pll-edges'
        ? '큐브 완성 · 마지막 층까지 모두 맞췄습니다.'
        : `${step.goal} 완성 · 1·2층도 그대로입니다.`
      : status === 'needs-auf'
        ? '윗층만 U로 돌려 맞추면 완성입니다.'
        : status === 'f2l-open'
          ? '공식 진행 중 · 1·2층이 잠시 열려 있습니다. 공식을 끝까지 이어 가세요.'
          : `목표: ${step.goal} · 1·2층은 유지합니다.`;

  return (
    <section
      className="lesson-panel"
      aria-label={set === 'oll' ? '2-Look OLL 훈련' : '2-Look PLL 훈련'}
    >
      <div className="panel-heading">
        <h2>
          {set === 'oll'
            ? '2-Look OLL · 윗면 노랑'
            : '2-Look PLL · 위치 맞추기'}
        </h2>
        <span>{set === 'oll' ? '3 + 7 CASES' : '2 + 4 CASES'}</span>
      </div>
      <p className="lesson-premise">
        1·2층 완성에서 시작 · 공식을 바로 적용하는 각도로 놓았습니다.
      </p>
      <div
        ref={casePickerRef}
        className="lesson-picker"
        aria-label={`${set === 'oll' ? 'OLL' : 'PLL'} 케이스`}
      >
        {LAST_LAYER_STEPS.filter((item) => item.set === set).map((group) => (
          <div
            key={group.id}
            className="case-group"
            role="group"
            aria-labelledby={`group-${group.id}`}
          >
            <h3 className="case-group-title" id={`group-${group.id}`}>
              {group.title} <span>→ {group.goal}</span>
            </h3>
            {lastLayerCases(set)
              .filter((item) => item.step === group.id)
              .map((item, index) => {
                const active = item.id === lesson.id;
                return (
                  <div
                    className={`lesson-item${active ? ' selected' : ''}`}
                    key={item.id}
                    data-case={item.id}
                  >
                    <div className="lesson-row">
                      <button
                        className="case-select"
                        id={`case-${item.id}`}
                        aria-expanded={active}
                        aria-controls={
                          active ? `solution-${item.id}` : undefined
                        }
                        onClick={() => {
                          if (!active) select(item.id);
                        }}
                      >
                        <span className="case-number">{index + 1}</span>
                        <span>{item.name}</span>
                        <span className="case-chevron" aria-hidden="true">
                          {active ? '▾' : '▸'}
                        </span>
                      </button>
                    </div>
                    {active && (
                      <div
                        className="lesson-expanded"
                        id={`solution-${item.id}`}
                        role="region"
                        aria-labelledby={`case-${item.id}`}
                      >
                        <p className="case-recognition">
                          <strong>인식</strong> {item.recognition}
                        </p>
                        <div className="solution-heading">
                          <strong>
                            공식 <span>· {exercise.tokens.length}수</span>
                          </strong>
                          <button
                            className="text-button"
                            aria-expanded={showGuide}
                            aria-controls="case-guide"
                            onClick={() => {
                              prepareTransition();
                              setShowGuide(!showGuide);
                            }}
                          >
                            {showGuide ? '풀이 숨김' : '풀이 보기'}
                          </button>
                        </div>
                        {showGuide ? (
                          <div
                            className="lesson-guide"
                            id="case-guide"
                            data-testid="case-guide"
                          >
                            <SolutionSteps
                              exercise={exercise}
                              cursor={lesson.cursor}
                              cube={session.cube}
                              busy={busy}
                              dispatch={dispatch}
                              doneLabel="단계 완료"
                            >
                              <details className="lesson-detail">
                                <summary>풀이 설명</summary>
                                <p>{item.hint}</p>
                                <p>
                                  ′는 해당 면을 바라본 반시계 회전입니다. 공식
                                  중에는 1·2층이 잠시 흐트러졌다가 마지막에
                                  복원됩니다.
                                </p>
                              </details>
                            </SolutionSteps>
                          </div>
                        ) : (
                          <p className="hidden-guide-note">
                            풀이를 숨겼습니다. 공식을 떠올리며 직접 돌려 보세요.
                          </p>
                        )}
                        <div
                          className={`lesson-feedback feedback-${status}`}
                          role="status"
                          data-testid="lesson-status"
                          data-status={status}
                        >
                          {busy
                            ? '회전 중 · 윗층의 변화를 따라가 보세요.'
                            : statusText}
                        </div>
                        {status === 'complete' && next && nextStep && (
                          <button
                            className="primary-button next-case-button"
                            disabled={busy}
                            onClick={() => select(next.id)}
                          >
                            이어서 · {nextStep.set.toUpperCase()}{' '}
                            {nextStep.title.split(' · ')[0]} {next.name}
                          </button>
                        )}
                        <div className="lesson-tools">
                          <button
                            className="text-button"
                            onClick={() => dispatch({ type: 'restart' })}
                          >
                            같은 배치 다시
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </section>
  );
}
