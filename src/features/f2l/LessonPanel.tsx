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
    cursor === null || status === 'paired'
      ? undefined
      : exercise.solution[cursor];
  const statusText =
    status === 'paired'
      ? '페어 완성 · Y층에서 멈춥니다. W 십자가도 유지했습니다.'
      : status === 'pair-cross-broken'
        ? '두 조각은 붙었습니다. W 십자가를 복원하면 이번 연습이 끝납니다.'
        : status === 'cross-broken'
          ? '페어링 중 · 열어 둔 면을 되돌려 W 십자가를 복원하세요.'
          : 'R·G·W 코너와 R·G 엣지를 Y층에서 붙여 보세요.';

  return (
    <section className="lesson-panel" aria-label="F2L 페어링 훈련">
      <div className="panel-heading">
        <h2>F2L · 첫 페어 만들기</h2>
        <span>5 TYPES</span>
      </div>
      <p className="lesson-premise">
        W 십자가와 O·B·R·G 센터 정렬은 완료.
        <br />
        코너는 앞·오른쪽 위, 엣지는 O면 쪽 뒤·위에 고정합니다.
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
        {showGuide && <p>{definition.explanation}</p>}
        <dl>
          <div>
            <dt>시작 코너</dt>
            <dd>
              W·R·G / R·G 슬롯 바로 위 · W는{' '}
              {{ R: '오른쪽', F: '앞', U: '위' }[exercise.definition.whiteFace]}
            </dd>
          </div>
          <div>
            <dt>시작 엣지</dt>
            <dd>
              R·G / Y층 뒤쪽 · O 센터 위 · 위는{' '}
              {COLOR_LETTERS[exercise.definition.top]}
            </dd>
          </div>
        </dl>
        <label className="focus-control">
          <input
            type="checkbox"
            checked={focus}
            onChange={(event) => onFocusChange(event.target.checked)}
          />{' '}
          대상 조각 강조
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
            뒤쪽 O 센터 위입니다.
          </p>
          <p>
            목표는 Y층 페어링까지입니다. 슬롯 정렬과 삽입은 다음에 연습합니다.
          </p>
          {lesson.id === 5 && (
            <button
              className="secondary-button"
              onClick={() =>
                dispatch({
                  type: 'lesson',
                  id: 5,
                  variant: (lesson.variant + 1) % exercise.variantCount,
                })
              }
            >
              엣지 윗색 바꾸기 · 현재 {COLOR_LETTERS[exercise.definition.top]}
            </button>
          )}
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
                  <code>{stage.algorithm}</code>
                  <p className="notation-note">
                    {stage.algorithm.split(' ').length}수 · 180° 회전도 한 수로
                    셉니다.
                  </p>
                </li>
              );
            })}
          </ol>
          <p className="notation-note">
            수순의 R은 오른쪽, F는 앞, L은 왼쪽, B는 뒤, U는 윗면입니다. ′는
            반시계, U2는 윗면 180° 회전입니다. 큐브에 적힌 문자는 색을
            나타냅니다.
          </p>
          {cursor === null && status !== 'paired' && (
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
                : status === 'paired'
                  ? '페어링 완료'
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
        W 십자가를 복원하며 Y층에 페어를 만드는 최소 수순입니다. 첫 페어
        연습이므로 다른 슬롯의 보존은 다루지 않습니다. 페어를 슬롯에 넣는 단계는
        포함하지 않습니다.
      </p>
    </section>
  );
}
