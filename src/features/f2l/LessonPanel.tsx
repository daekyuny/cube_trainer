import { useState } from 'react';
import type { Dispatch } from 'react';
import {
  COLOR_LETTERS,
  getExercise,
  LESSONS,
  trainingStatus,
} from '../../domain/f2l/lessons';
import type { LessonId, LessonSide } from '../../domain/f2l/lessons';
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
  const [sides, setSides] = useState<Partial<Record<LessonId, LessonSide>>>({});
  const lesson = session.lesson!;
  const exercise = getExercise(lesson.id, lesson.variant, lesson.side);
  const cursor = lesson.cursor;
  const busy = session.queue.length > 0;
  const status = trainingStatus(session.cube, lesson.side);
  const color = lesson.side === 'left' ? 'B' : 'G';
  const direction = lesson.side === 'left' ? '왼쪽' : '오른쪽';
  const next =
    cursor === null
      ? undefined
      : exercise.tokens.find((token) => token.end > cursor);
  const previous =
    cursor === null
      ? undefined
      : [0, ...exercise.tokens.map((token) => token.end)]
          .filter((end) => end < cursor)
          .at(-1);
  const select = (id: LessonId, side = sides[id] ?? 'right') => {
    setSides((old) => ({ ...old, [id]: side }));
    dispatch({ type: 'lesson', id, side });
  };
  const seek = (to: number | undefined) => {
    if (to !== undefined) dispatch({ type: 'seek', cursor: to });
  };
  const statusText =
    status === 'paired'
      ? '페어 완성 · W 십자가와 다른 세 슬롯도 유지했습니다.'
      : status === 'pair-cross-broken'
        ? '페어 연결 · W 십자가와 다른 세 슬롯을 복원하세요.'
        : status === 'cross-broken'
          ? '페어링 중 · 열어 둔 면을 되돌려 W 십자가를 복원하세요.'
          : status === 'slots-disturbed'
            ? '다른 코너·엣지가 흐트러져 있습니다. 다른 세 슬롯까지 복원해야 완료입니다.'
            : `R·${color}·W 코너와 R·${color} 엣지를 Y층에서 붙여 보세요.`;

  return (
    <section className="lesson-panel" aria-label="F2L 페어링 훈련">
      <div className="panel-heading">
        <h2>F2L · 첫 페어 만들기</h2>
        <span>5 TYPES</span>
      </div>
      <p className="lesson-premise">
        W 십자가·다른 세 슬롯 완성에서 시작 · ⇄ 좌우 대칭
      </p>
      <div className="lesson-picker" aria-label="다섯 가지 페어링 유형">
        {LESSONS.map((item) => {
          const active = item.id === lesson.id;
          const side = active ? lesson.side : (sides[item.id] ?? 'right');
          const title =
            side === 'left' ? item.title.replace('오른쪽', '왼쪽') : item.title;
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
                  aria-controls={active ? `solution-${item.id}` : undefined}
                  onClick={() => {
                    if (!active) select(item.id, side);
                  }}
                >
                  <span className="case-number">{item.id}</span>
                  <span>{title}</span>
                  <span className="case-chevron" aria-hidden="true">
                    {active ? '▾' : '▸'}
                  </span>
                </button>
                <button
                  className="mirror-button"
                  aria-label={`${item.id}번 좌우 대칭 · ${side === 'right' ? 'RB' : 'RG'}로 전환`}
                  aria-pressed={side === 'left'}
                  title={`현재 ${side === 'right' ? 'RG · 오른쪽' : 'RB · 왼쪽'}`}
                  onClick={() =>
                    select(item.id, side === 'right' ? 'left' : 'right')
                  }
                >
                  <span aria-hidden="true">⇄</span>{' '}
                  {side === 'right' ? 'RG' : 'RB'}
                </button>
              </div>
              {active && (
                <div
                  className="lesson-expanded"
                  id={`solution-${item.id}`}
                  role="region"
                  aria-labelledby={`case-${item.id}`}
                >
                  <div className="solution-heading">
                    <strong>
                      Y층 페어링 <span>· R{color}</span>
                    </strong>
                    <button
                      className="text-button"
                      aria-expanded={showGuide}
                      aria-controls="pair-guide"
                      onClick={() => setShowGuide(!showGuide)}
                    >
                      {showGuide ? '풀이 숨김' : '풀이 보기'}
                    </button>
                  </div>
                  {showGuide ? (
                    <div
                      className="lesson-guide"
                      id="pair-guide"
                      data-testid="stage-pair"
                    >
                      <div
                        className="solution-moves"
                        aria-label="수순 이동"
                        onKeyDown={(event) => {
                          if (
                            event.key !== 'ArrowLeft' &&
                            event.key !== 'ArrowRight'
                          )
                            return;
                          event.preventDefault();
                          event.stopPropagation();
                          if (
                            !event.repeat &&
                            !event.altKey &&
                            !event.ctrlKey &&
                            !event.metaKey
                          )
                            seek(
                              event.key === 'ArrowLeft' ? previous : next?.end,
                            );
                        }}
                      >
                        <button
                          className="solution-start"
                          aria-disabled={
                            busy || cursor === null || cursor === 0
                          }
                          aria-current={cursor === 0 ? 'step' : undefined}
                          onClick={() => seek(0)}
                        >
                          시작
                        </button>
                        {exercise.tokens.map((token, index) => (
                          <button
                            key={index}
                            aria-disabled={busy || cursor === null}
                            className={`solution-token${cursor !== null && cursor >= token.end ? ' visited' : ''}`}
                            aria-label={`${index + 1}수 ${token.label}까지 이동`}
                            aria-current={
                              cursor !== null &&
                              cursor > token.start &&
                              cursor <= token.end
                                ? 'step'
                                : undefined
                            }
                            data-partial={
                              cursor !== null &&
                              cursor > token.start &&
                              cursor < token.end
                            }
                            onClick={() => seek(token.end)}
                          >
                            {token.label}
                          </button>
                        ))}
                      </div>
                      <p className="notation-note">
                        문자를 누르면 그 수까지 · ← →로 이동 · U2는 180°
                      </p>
                      <div className="lesson-actions solution-navigation">
                        <button
                          className="secondary-button"
                          disabled={busy || previous === undefined}
                          onClick={() => seek(previous)}
                        >
                          ← 이전
                        </button>
                        <button
                          className="primary-button"
                          disabled={busy || !next}
                          onClick={() => seek(next?.end)}
                        >
                          {next
                            ? `다음 · ${next.label}`
                            : cursor === null
                              ? '수순 밖'
                              : '페어링 완료'}
                        </button>
                        <button
                          className="secondary-button"
                          disabled={busy || !next}
                          onClick={() =>
                            dispatch({ type: 'guide', wholeStage: true })
                          }
                        >
                          전체 시연
                        </button>
                      </div>
                      {cursor === null && (
                        <p className="guide-notice">
                          예시 수순과 다른 경로입니다. 직접 풀거나, 한 수
                          되돌리기 / 같은 배치 다시로 안내를 이어 가세요.
                        </p>
                      )}
                      <details className="lesson-detail">
                        <summary>
                          풀이 설명 · {exercise.tokens.length}수
                        </summary>
                        <p>{exercise.definition.hint}</p>
                        <p>
                          ′는 해당 면을 바라본 반시계 회전입니다. 마지막에
                          십자가와 다른 세 슬롯을 모두 복원하며 페어는 Y층에
                          둡니다.
                        </p>
                      </details>
                    </div>
                  ) : (
                    <p className="hidden-guide-note">
                      풀이를 숨겼습니다. 직접 돌리며 연습하세요.
                    </p>
                  )}
                  <div
                    className={`lesson-feedback feedback-${status}`}
                    role="status"
                    data-testid="lesson-status"
                    data-status={status}
                  >
                    {busy
                      ? '회전 중 · 조각의 움직임을 따라가 보세요.'
                      : statusText}
                  </div>
                  <div className="lesson-observation">
                    <p>
                      W·R·{color} / R·{color} 슬롯 바로 위 · 앞·{direction} 위
                      <br />
                      R·{color} 엣지 / Y층 뒤쪽 · O 센터 위 · 위는{' '}
                      {COLOR_LETTERS[exercise.definition.top]}
                    </p>
                  </div>
                  {lesson.id === 5 && (
                    <button
                      className="secondary-button variant-button"
                      onClick={() =>
                        dispatch({
                          type: 'lesson',
                          id: 5,
                          side: lesson.side,
                          variant: (lesson.variant + 1) % exercise.variantCount,
                        })
                      }
                    >
                      엣지 윗색 바꾸기 · 현재{' '}
                      {COLOR_LETTERS[exercise.definition.top]}
                    </button>
                  )}
                  <div className="lesson-tools">
                    <label className="focus-control">
                      <input
                        type="checkbox"
                        checked={focus}
                        onChange={(event) =>
                          onFocusChange(event.target.checked)
                        }
                      />
                      대상 조각 강조
                    </label>
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
    </section>
  );
}
