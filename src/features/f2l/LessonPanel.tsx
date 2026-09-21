import { useState } from 'react';
import type { Dispatch } from 'react';
import { notation } from '../../domain/cube/cube';
import {
  COLOR_LETTERS,
  getExercise,
  LESSONS,
  trainingStatus,
} from '../../domain/f2l/lessons';
import type { LessonId } from '../../domain/f2l/lessons';
import type { Action, Session } from '../simulator/session';

export function LessonPanel({
  session,
  dispatch,
  focus,
  onFocusChange,
}: {
  session: Session;
  dispatch: Dispatch<Action>;
  focus: boolean;
  onFocusChange: (value: boolean) => void;
}) {
  const [showGuide, setShowGuide] = useState(true);
  const lesson = session.lesson!;
  const exercise = getExercise(lesson.id, lesson.variant);
  const definition = LESSONS.find((item) => item.id === lesson.id)!;
  const cursor = lesson.cursor;
  const busy = session.queue.length > 0;
  const status = trainingStatus(session.cube);
  const next =
    cursor === null || status === 'inserted'
      ? undefined
      : exercise.solution[cursor];
  const statusText =
    status === 'inserted'
      ? '삽입 완료 · W 십자가도 유지했습니다.'
      : status === 'paired'
        ? '페어 완성 · 이제 위치를 맞추고 넣어 보세요.'
        : status === 'cross-broken'
          ? 'W 십자가가 변형된 상태입니다. 면을 되돌리면 복원되는지 확인하세요.'
          : 'C 코너와 E 엣지를 같은 색끼리 붙여 보세요.';

  return (
    <section className="lesson-panel" aria-label="F2L 페어링 훈련">
      <div className="panel-heading">
        <h2>F2L · 첫 페어 만들기</h2>
        <span>5 TYPES</span>
      </div>
      <p className="lesson-premise">
        W 십자가와 O·B·R·G 센터 정렬은 완료.
        <br />
        조각 꺼내기와 분리는 끝낸 상태에서 시작합니다.
      </p>
      <div className="lesson-picker" aria-label="다섯 가지 페어링 유형">
        {LESSONS.map((item) => (
          <button
            key={item.id}
            aria-pressed={item.id === lesson.id}
            onClick={() => dispatch({ type: 'lesson', id: item.id })}
          >
            <span>{item.id}</span>
            {item.title}
          </button>
        ))}
      </div>
      <div className="lesson-observation">
        <h3>
          {lesson.id}. {definition.title}
        </h3>
        <p>{definition.explanation}</p>
        <dl>
          <div>
            <dt>시작 코너 C</dt>
            <dd>W·R·G / R·G 슬롯 바로 위</dd>
          </div>
          <div>
            <dt>시작 엣지 E</dt>
            <dd>
              R·G / Y층 {exercise.definition.edge === 'UL' ? '왼쪽' : '뒤쪽'} ·
              위는 {COLOR_LETTERS[exercise.definition.top]}
            </dd>
          </div>
        </dl>
        <label className="focus-control">
          <input
            type="checkbox"
            checked={focus}
            onChange={(event) => onFocusChange(event.target.checked)}
          />{' '}
          대상 조각 강조 · C 코너 / E 엣지
        </label>
        <details className="lesson-detail">
          <summary>색 문자와 시작 조건</summary>
          <p>
            색은 W 흰색 · Y 노랑 · R 빨강 · G 초록 · B 파랑 · O 주황입니다. 색
            문자와 회전 기호는 구분해 읽으세요. 예를 들어 색 R은 빨강, 수순 R은
            오른쪽 면 회전입니다.
          </p>
          <p>
            다섯 유형 모두 W·R·G 코너는 Y층 앞·오른쪽, 자기 슬롯 바로 위입니다.
            W가 어느 면을 보는지만 달라집니다. R·G 엣지는 코너와 붙지 않은 Y층
            왼쪽 또는 뒤쪽입니다.
          </p>
          <p>
            먼저 이 대표 배치로 원리를 익히세요. 같은 유형의 다른 배치는 준비
            동작이 달라질 수 있습니다.
          </p>
          <button
            className="secondary-button"
            onClick={() =>
              dispatch({
                type: 'lesson',
                id: lesson.id,
                variant: (lesson.variant + 1) % exercise.variantCount,
              })
            }
          >
            다른 엣지 배치 ({lesson.variant + 1}/{exercise.variantCount})
          </button>
        </details>
      </div>
      <div className="lesson-mode" aria-label="훈련 안내">
        <button aria-pressed={showGuide} onClick={() => setShowGuide(true)}>
          설명 보며 연습
        </button>
        <button aria-pressed={!showGuide} onClick={() => setShowGuide(false)}>
          혼자 연습
        </button>
      </div>
      <div
        className={`lesson-feedback feedback-${status}`}
        role="status"
        data-testid="lesson-status"
        data-status={status}
      >
        {busy ? '회전 중 · 조각의 움직임을 따라가 보세요.' : statusText}
      </div>
      {showGuide && (
        <div className="lesson-guide">
          <ol className="lesson-stages">
            {exercise.stages.map((stage, index) => {
              const done = cursor !== null && cursor >= stage.end;
              const active =
                cursor !== null && cursor >= stage.start && cursor < stage.end;
              return (
                <li
                  key={stage.id}
                  className={active ? 'active' : done ? 'complete' : ''}
                  aria-current={active ? 'step' : undefined}
                  data-testid={`stage-${stage.id}`}
                >
                  <h4>
                    <span>{done ? '✓' : index + 1}</span>
                    {stage.title}
                  </h4>
                  <p>{stage.hint}</p>
                  <code>
                    {exercise.definition.direct && lesson.id === 1
                      ? `W 오른쪽: ${stage.algorithm}`
                      : stage.algorithm || '추가 회전 없음'}
                  </code>
                  {exercise.definition.direct && (
                    <>
                      <code>
                        {lesson.id === 1
                          ? 'W 왼쪽: L′ U′ L'
                          : '현재 방향 그대로: F′ U′ F'}
                      </code>
                      <p className="mirror-answer">
                        {lesson.id === 1 ? (
                          <>
                            현재 그림은 오른쪽 배치입니다. 왼쪽 공식은 코너가
                            자기 앞·왼쪽 슬롯 위, 엣지가 뒤쪽에 있는 좌우 대칭
                            배치에 적용합니다. 앞색은 앞 센터와 맞춥니다.
                          </>
                        ) : (
                          <>
                            →는 U면 회전이 아니라 전체 큐브 회전입니다. 시연은 →
                            L′ U′ L을 사용합니다. 전체를 돌리지 않을 때는 F′ U′
                            F로 같은 슬롯을 완성합니다.
                          </>
                        )}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="notation-note">
            ′는 반시계, U2는 U 두 번. →는 큐브 전체 오른쪽 90° 회전입니다.
          </p>
          {cursor === null && status !== 'inserted' && (
            <p className="guide-notice">
              예시 수순과 다른 경로입니다. 직접 계속 풀어도 완성을 판정합니다.
              시연을 다시 보려면 한 수 되돌리기 또는 같은 배치 다시를 눌러
              주세요.
            </p>
          )}
          <div className="lesson-actions">
            <button
              className="primary-button"
              disabled={busy || !next}
              onClick={() => dispatch({ type: 'guide' })}
            >
              {next
                ? `다음 한 수 · ${notation(next)}`
                : status === 'inserted' && cursor === null
                  ? '삽입 완료'
                  : cursor === null
                    ? '예시 수순에서 벗어남'
                    : '예시 수순 완료'}
            </button>
            <button
              className="secondary-button"
              disabled={busy || !next}
              onClick={() => dispatch({ type: 'guide', wholeStage: true })}
            >
              이 단계 시연
            </button>
          </div>
        </div>
      )}
      <div className="lesson-actions lesson-retry">
        <button
          className="secondary-button"
          onClick={() => dispatch({ type: 'restart' })}
        >
          같은 배치 다시
        </button>
        <button
          className="secondary-button"
          onClick={() =>
            dispatch({ type: 'lesson', id: ((lesson.id % 5) + 1) as LessonId })
          }
        >
          다음 유형 →
        </button>
      </div>
      <p className="lesson-footnote">
        {exercise.definition.direct
          ? '이 대표 배치는 면 회전 세 수로 페어링과 삽입이 끝납니다. 추가 삽입 공식이 필요하지 않습니다.'
          : '페어링 후 정렬과 삽입을 익히는 연습입니다. 준비된 배치에 맞는 수순을 사용하세요.'}
      </p>
    </section>
  );
}
