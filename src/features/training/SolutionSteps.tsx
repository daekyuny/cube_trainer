import type { Dispatch, ReactNode } from 'react';
import { notation } from '../../domain/cube/cube';
import type { Cube } from '../../domain/cube/cube';
import {
  isLessonView,
  lessonMove,
  triggerName,
} from '../../domain/training/guide';
import type {
  GuidedExercise,
  SolutionToken,
} from '../../domain/training/guide';
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
  range,
  breaks = [],
  playLabel = '전체 시연',
  children,
}: {
  exercise: GuidedExercise;
  cursor: number | null;
  cube: Cube;
  busy: boolean;
  dispatch: Dispatch<Action>;
  doneLabel: string;
  // A demo stage: only its tokens, and play stops at its end.
  range?: { start: number; end: number; tokenStart: number; tokenEnd: number };
  // Token indices that start a new line (e.g. each F2L pair).
  breaks?: number[];
  playLabel?: string;
  children?: ReactNode;
}) {
  const first = range?.start ?? 0;
  const tokens = exercise.tokens.slice(
    range?.tokenStart ?? 0,
    range?.tokenEnd ?? exercise.tokens.length,
  );
  const reference = cursor === null ? null : exercise.checkpoints[cursor];
  const rotated = reference !== null && !isLessonView(cube, reference);
  const next =
    cursor === null ? undefined : tokens.find((token) => token.end > cursor);
  const nextScreenMove =
    next && cursor !== null && reference
      ? lessonMove(
          cube,
          {
            ...exercise.solution[cursor],
            turns:
              next.end - cursor === 2 ? 2 : exercise.solution[cursor].turns,
          },
          reference,
        )
      : undefined;
  const previous =
    cursor === null
      ? undefined
      : [first, ...tokens.map((token) => token.end)]
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
          aria-disabled={busy || cursor === null || cursor === first}
          aria-current={cursor === first ? 'step' : undefined}
          onClick={() => seek(first)}
        >
          시작
        </button>
        {segments(exercise.tokens, range?.tokenStart ?? 0, tokens.length).map(
          ({ tokens, group }) => {
            const lineBreak = breaks.includes(tokens[0].index) && (
              <span
                key={`break-${tokens[0].index}`}
                className="solution-break"
                aria-hidden="true"
              />
            );
            const buttons = tokens.map(({ token, index }) => (
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
            ));
            if (group === undefined) return [lineBreak, ...buttons];
            const name = triggerName(tokens.map(({ token }) => token));
            return [
              lineBreak,
              <span
                key={`group-${group}`}
                className="solution-group"
                data-trigger={name}
              >
                <span className="solution-group-moves">{buttons}</span>
                {name && <small aria-hidden="true">{name}</small>}
              </span>,
            ];
          },
        )}
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
          onClick={() =>
            dispatch(
              range
                ? { type: 'guide', to: range.end }
                : { type: 'guide', wholeStage: true },
            )
          }
        >
          {playLabel}
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

// Consecutive tokens of one parenthesized group render inside one bracket.
// `from` / `count` pick a stage's tokens; indices stay those of the whole.
function segments(all: SolutionToken[], from = 0, count = all.length) {
  const result: {
    group?: number;
    tokens: { token: SolutionToken; index: number }[];
  }[] = [];
  all.slice(from, from + count).forEach((token, offset) => {
    const index = from + offset;
    const last = result.at(-1);
    if (last && token.group !== undefined && last.group === token.group)
      last.tokens.push({ token, index });
    else result.push({ group: token.group, tokens: [{ token, index }] });
  });
  return result;
}
