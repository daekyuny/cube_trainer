import type { Dispatch, ReactNode } from 'react';
import { notation } from '../../domain/cube/cube';
import type { Cube } from '../../domain/cube/cube';
import { lessonMove, lessonViewTurns } from '../../domain/training/guide';
import type { GuidedExercise } from '../../domain/training/guide';
import type { Action } from '../simulator/session';

// Shared token navigation: each letter seeks to "just after that move" with
// real forward / inverse turns through the common input queue.
export function SolutionSteps({
  exercise,
  cursor,
  cube,
  busy,
  dispatch,
  doneLabel,
  children,
}: {
  exercise: GuidedExercise;
  cursor: number | null;
  cube: Cube;
  busy: boolean;
  dispatch: Dispatch<Action>;
  doneLabel: string;
  children?: ReactNode;
}) {
  const rotated = lessonViewTurns(cube) !== 0;
  const next =
    cursor === null
      ? undefined
      : exercise.tokens.find((token) => token.end > cursor);
  const nextScreenMove =
    next && cursor !== null
      ? lessonMove(cube, {
          ...exercise.solution[cursor],
          turns: next.end - cursor === 2 ? 2 : exercise.solution[cursor].turns,
        })
      : undefined;
  const previous =
    cursor === null
      ? undefined
      : [0, ...exercise.tokens.map((token) => token.end)]
          .filter((end) => end < cursor)
          .at(-1);
  const seek = (to: number | undefined) => {
    if (to !== undefined) dispatch({ type: 'seek', cursor: to });
  };

  return (
    <>
      <div
        className="solution-moves"
        aria-label="수순 이동"
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          event.preventDefault();
          event.stopPropagation();
          if (
            !event.repeat &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
          )
            seek(event.key === 'ArrowLeft' ? previous : next?.end);
        }}
      >
        <button
          className="solution-start"
          aria-disabled={busy || cursor === null || cursor === 0}
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
              cursor !== null && cursor > token.start && cursor <= token.end
                ? 'step'
                : undefined
            }
            data-partial={
              cursor !== null && cursor > token.start && cursor < token.end
            }
            onClick={() => seek(token.end)}
          >
            {token.label}
          </button>
        ))}
      </div>
      <p className="notation-note solution-reference">
        수순·설명은 빨강 앞 · 초록 오른쪽 기준입니다.
        {rotated &&
          next &&
          nextScreenMove &&
          ` 다음 ${next.label} → 현재 화면 ${notation(nextScreenMove)}`}
      </p>
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
              : doneLabel}
        </button>
        <button
          className="secondary-button"
          disabled={busy || !next}
          onClick={() => dispatch({ type: 'guide', wholeStage: true })}
        >
          전체 시연
        </button>
      </div>
      {cursor === null && (
        <p className="guide-notice">
          예시 수순과 다른 경로입니다. 직접 풀거나, 한 수 되돌리기 / 같은 배치
          다시로 안내를 이어 가세요.
        </p>
      )}
      {children}
    </>
  );
}
