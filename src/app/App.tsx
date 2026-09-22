import { useEffect, useReducer, useState } from 'react';
import {
  COLORS,
  COLOR_NAMES,
  FACES,
  centerColor,
  hasFirstTwoLayers,
  hasWhiteCross,
  isSolved,
  notation,
} from '../domain/cube/cube';
import type { Face, Preset } from '../domain/cube/cube';
import { CubeView } from '../features/simulator/CubeView';
import { createSession, sessionReducer } from '../features/simulator/session';
import { LessonPanel } from '../features/f2l/LessonPanel';
import { targetIds, trainingStatus } from '../domain/f2l/lessons';

const presets: { id: Preset; title: string; subtitle: string }[] = [
  { id: 'solved', title: '맞춘 큐브', subtitle: '여섯 면이 모두 완성된 상태' },
  {
    id: 'random',
    title: '랜덤 섞기',
    subtitle: '실제 회전 25수로 골고루 섞기',
  },
  {
    id: 'cross',
    title: '흰색 십자가',
    subtitle: '흰색 엣지와 옆면 센터까지 정렬',
  },
  {
    id: 'f2l',
    title: '1·2층 완성',
    subtitle: '흰색 아래 기준, 마지막 층부터 연습',
  },
];
const faceNames: Record<Face, string> = {
  F: '앞',
  R: '오른쪽',
  U: '위',
  D: '아래',
  L: '왼쪽',
  B: '뒤',
};

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () =>
    createSession(),
  );
  const [counterclockwise, setCounterclockwise] = useState(false);
  const [slow, setSlow] = useState(false);
  const [focus, setFocus] = useState(true);
  const command = session.queue[0];

  useEffect(() => {
    if (!command) return;
    let frame: number;
    let start: number | undefined;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const duration = reduced ? 0 : slow ? 650 : 260;
    const tick = (time: number) => {
      start ??= time;
      const progress = duration ? Math.min(1, (time - start) / duration) : 1;
      dispatch({ type: 'frame', progress, command });
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [command, slow]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat ||
        event.isComposing ||
        (target instanceof HTMLElement &&
          target.closest(
            'input:not([type="checkbox"]), textarea, select, [contenteditable="true"], [role="textbox"]',
          ))
      )
        return;
      const face = event.key.toUpperCase() as Face;
      if (FACES.includes(face)) {
        event.preventDefault();
        dispatch({
          type: 'move',
          move: { face, turns: event.shiftKey ? -1 : 1 },
        });
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        dispatch({
          type: 'move',
          move: { face: 'Y', turns: event.key === 'ArrowRight' ? 1 : -1 },
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const turnFace = (face: Face, shift: boolean) =>
    dispatch({
      type: 'move',
      move: { face, turns: counterclockwise || shift ? -1 : 1 },
    });
  const cubeStatus = isSolved(session.cube)
    ? '여섯 면 완성'
    : hasFirstTwoLayers(session.cube)
      ? '1·2층 완성'
      : hasWhiteCross(session.cube)
        ? '흰색 십자가 완성'
        : '자유롭게 연습 중';
  const activePreset = presets.find((preset) => preset.id === session.preset)!;
  const pairStatus = session.lesson
    ? trainingStatus(session.cube, session.lesson.side)
    : null;
  const stageStatus =
    pairStatus === 'paired'
      ? '페어 완성 · 십자·세 슬롯 유지'
      : pairStatus === 'pair-cross-broken'
        ? '페어 연결 · W 십자 복원 중'
        : pairStatus === 'slots-disturbed'
          ? '다른 세 슬롯 복원 필요'
          : cubeStatus;
  const facesLegend = (faces: Face[]) =>
    faces.map((face) => (
      <span key={face}>
        <i style={{ background: COLORS[centerColor(session.cube, face)] }} />{' '}
        <b>{face}</b> {COLOR_NAMES[centerColor(session.cube, face)]}
      </span>
    ));

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        본문으로 건너뛰기
      </a>
      <header className="site-header">
        <a className="wordmark" href="#main">
          <span className="brand-mark" aria-hidden="true">
            ▦
          </span>{' '}
          Cube Trainer
        </a>
        <span className="header-tag">
          3 × 3 <span> / </span> {session.lesson ? 'F2L 페어링' : '자유 연습'}
        </span>
      </header>
      <main id="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">돌려 보고, 이해하고, 다시 한 번.</p>
            <h1>한 수씩, 큐브 연습</h1>
          </div>
          <span className="orientation-note">
            <i /> 노랑 위 · 흰색 아래
          </span>
        </div>
        <nav className="practice-modes" aria-label="연습 모드">
          <button
            aria-pressed={!session.lesson}
            onClick={() => {
              if (session.lesson)
                dispatch({ type: 'preset', preset: 'solved' });
            }}
          >
            자유 연습
          </button>
          <button
            aria-pressed={Boolean(session.lesson)}
            onClick={() => {
              if (!session.lesson) dispatch({ type: 'lesson', id: 1 });
            }}
          >
            F2L 페어링
          </button>
          <span>W 십자가 다음, 두 조각을 한 페어로</span>
        </nav>
        <div className={`workspace${session.lesson ? ' is-training' : ''}`}>
          <section className="simulator" aria-label="큐브 연습 공간">
            <div className="stage-toolbar">
              <span className="live-badge">
                <i /> {stageStatus}
              </span>
              <span className="move-count">
                {session.history.filter((move) => move.face !== 'Y').length}{' '}
                moves
              </span>
            </div>
            <div
              className="cube-stage"
              data-testid="cube-stage"
              data-busy={Boolean(command)}
            >
              <figure className="primary-cube">
                <figcaption>
                  <span className="view-number">01</span> 기준 큐브{' '}
                  <span className="view-hint">앞 · 오른쪽 · 위</span>
                </figcaption>
                <CubeView
                  cube={session.cube}
                  move={command?.move}
                  progress={session.progress}
                  highlightIds={
                    session.lesson && focus
                      ? targetIds(session.lesson.side)
                      : undefined
                  }
                />
                <div className="face-legend">
                  {facesLegend(['F', 'R', 'U'])}
                </div>
              </figure>
              <figure className="secondary-cube">
                <figcaption>
                  <span className="view-number">02</span> 뒤집어 보기{' '}
                  <span className="view-hint">뒤 · 왼쪽 · 아래</span>
                </figcaption>
                <CubeView
                  cube={session.cube}
                  reverse
                  move={command?.move}
                  progress={session.progress}
                  highlightIds={
                    session.lesson && focus
                      ? targetIds(session.lesson.side)
                      : undefined
                  }
                />
                <div className="face-legend">
                  {facesLegend(['B', 'L', 'D'])}
                </div>
              </figure>
            </div>
            <div className="stage-caption">
              {session.lesson
                ? `R·${session.lesson.side === 'left' ? 'B' : 'G'}·W 코너 · R·${session.lesson.side === 'left' ? 'B' : 'G'} 엣지 / 두 그림은 같은 큐브입니다.`
                : '같은 큐브의 여섯 면을 함께 보고 있어요.'}
            </div>
            <div className="yaw-controls">
              <button
                onClick={() =>
                  dispatch({ type: 'move', move: { face: 'Y', turns: -1 } })
                }
                aria-label="큐브 전체 왼쪽으로 90도 회전"
                title="윗면에서 내려다본 반시계 방향 · ←"
              >
                <span aria-hidden="true">↶</span>{' '}
                <span className="yaw-button-text">90°</span>
              </button>
              <div>
                <strong>큐브 전체 돌리기</strong>
                <span>윗면 기준 ← 반시계 · → 시계</span>
              </div>
              <button
                onClick={() =>
                  dispatch({ type: 'move', move: { face: 'Y', turns: 1 } })
                }
                aria-label="큐브 전체 오른쪽으로 90도 회전"
                title="윗면에서 내려다본 시계 방향 · →"
              >
                <span aria-hidden="true">↷</span>{' '}
                <span className="yaw-button-text">90°</span>
              </button>
            </div>
            <div className="history-panel">
              <div className="history-heading">
                <h2>돌린 수순</h2>
                <div className="history-actions">
                  <button
                    className="text-button"
                    disabled={!session.history.length && !command}
                    onClick={() => dispatch({ type: 'clear-history' })}
                    title="큐브는 유지하고 이력과 대기 입력만 비웁니다"
                  >
                    수순 리셋
                  </button>
                  <button
                    className="text-button"
                    disabled={Boolean(command) || !session.history.length}
                    onClick={() => dispatch({ type: 'undo' })}
                  >
                    ↶ 한 수 되돌리기
                  </button>
                </div>
              </div>
              <div className="move-history" aria-label="회전 이력">
                {session.history.length ? (
                  session.history.slice(-36).map((move, index) => (
                    <span
                      key={index}
                      className={move.face === 'Y' ? 'yaw-move' : ''}
                    >
                      {notation(move)}
                    </span>
                  ))
                ) : (
                  <p>첫 회전을 해 보세요. 수순이 여기에 기록됩니다.</p>
                )}
                {command && (
                  <span className="pending-move">{notation(command.move)}</span>
                )}
              </div>
              {session.history.length > 36 && (
                <p className="history-note">
                  최근 36개만 표시 · 되돌리기는 전체 이력에 적용됩니다.
                </p>
              )}
            </div>
          </section>
          <aside className="control-panel" aria-label="연습 컨트롤">
            {session.lesson && (
              <LessonPanel
                session={session}
                dispatch={dispatch}
                focus={focus}
                onFocusChange={setFocus}
              />
            )}
            <section className="turn-panel">
              <div className="panel-heading">
                <h2>면 돌리기</h2>
                <span>FACE CONTROL</span>
              </div>
              <p className="panel-description">
                각 면을 정면에서 바라본 방향입니다.
              </p>
              <div className="direction-switch" aria-label="회전 방향">
                <button
                  aria-pressed={!counterclockwise}
                  onClick={() => setCounterclockwise(false)}
                >
                  ↻ 시계 방향
                </button>
                <button
                  aria-pressed={counterclockwise}
                  onClick={() => setCounterclockwise(true)}
                >
                  ↺ 반시계 방향
                </button>
              </div>
              <div className="cross-controller">
                {FACES.map((face) => (
                  <button
                    key={face}
                    className={`face-button face-${face}`}
                    style={
                      {
                        '--face-color': COLORS[centerColor(session.cube, face)],
                      } as React.CSSProperties
                    }
                    onClick={(event) => turnFace(face, event.shiftKey)}
                    aria-label={`${face} ${faceNames[face]} 면 ${counterclockwise ? '반시계' : '시계'} 방향 회전`}
                  >
                    <strong>
                      {face}
                      {counterclockwise ? '′' : ''}
                    </strong>
                    <span>{faceNames[face]}</span>
                  </button>
                ))}
              </div>
              <p className="keyboard-hint">
                <kbd>F</kbd>
                <kbd>R</kbd>
                <kbd>U</kbd>
                <kbd>D</kbd>
                <kbd>L</kbd>
                <kbd>B</kbd>
                <span>
                  <kbd>Shift</kbd> + 문자 키는 반시계 방향
                </span>
              </p>
              <label className="slow-control">
                <input
                  type="checkbox"
                  checked={slow}
                  onChange={(event) => setSlow(event.target.checked)}
                />{' '}
                천천히 돌려 보기
              </label>
              <p className="queue-status" role="status">
                {session.message ||
                  (session.queue.length > 1
                    ? `${session.queue.length - 1}수 대기 중`
                    : '\u00a0')}
              </p>
            </section>
            {!session.lesson && (
              <section className="preset-panel">
                <div className="panel-heading">
                  <h2>어디서 시작할까요?</h2>
                  <span>PRESETS</span>
                </div>
                <div className="preset-list">
                  {presets.map((preset, index) => (
                    <button
                      key={preset.id}
                      className={`preset-button ${session.preset === preset.id ? 'selected' : ''}`}
                      onClick={() =>
                        dispatch({ type: 'preset', preset: preset.id })
                      }
                      aria-label={`${preset.title} 프리셋 적용`}
                    >
                      <span className="preset-index">0{index + 1}</span>
                      <span>
                        <strong>{preset.title}</strong>
                        <small>{preset.subtitle}</small>
                      </span>
                      <span className="preset-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  ))}
                </div>
                <p className="preset-note">
                  누르면 해당 상태로 새로 시작하고 수순을 비웁니다.
                </p>
                <button
                  className="secondary-button"
                  onClick={() => dispatch({ type: 'restart' })}
                >
                  현재 시작 상태로 되돌리기
                </button>
              </section>
            )}
          </aside>
        </div>
        <details className="help-panel">
          <summary>사용 방법과 현재 시작 상태</summary>
          <div>
            <p>
              <strong>
                {session.lesson
                  ? `F2L ${session.lesson.id}번 유형`
                  : activePreset.title}
              </strong>
              에서 시작했습니다. 큰 그림의 F/R/U와 작은 그림의 B/L/D는 언제나
              같은 큐브를 보여 줍니다. 작은 그림은 뒤집어 본 모습이므로 D(흰색
              센터)가 위에 보입니다.
            </p>
            <p>
              수순 리셋은 현재 큐브를 유지하고 기록과 대기 입력만 비웁니다. 시작
              상태로 되돌리기와 같은 배치 다시는 큐브도 처음 배치로 복원합니다.
            </p>
            {session.lesson && (
              <p>
                초보 1·2·3층 풀이와 십자가 만들기는 건너뜁니다. F2L은 준비된 두
                조각의 페어링부터 연습합니다.{' '}
                <a
                  href="https://jperm.net/3x3/cfop/f2l"
                  target="_blank"
                  rel="noreferrer"
                >
                  직관적 F2L 참고: J Perm
                </a>
              </p>
            )}
            <p>
              좌우 화살표 또는 돌림 버튼은 전체 큐브를 수평으로 90° 회전합니다.
              노란 윗면에서 내려다볼 때 오른쪽은 시계 방향, 왼쪽은 반시계
              방향입니다. 오른쪽 회전 후에는 기존 오른쪽 면이 새 앞면이 됩니다.
              위·아래 센터는 유지되고 앞·옆·뒤의 기준이 바뀝니다. 면 회전 중
              노랑·흰색 스티커는 다른 면으로 움직일 수 있습니다. 중간층 회전은
              지원하지 않습니다.
            </p>
            <p>
              문자 키는 시계 방향, Shift + 문자 키는 반시계 방향입니다. 화면의
              방향 선택은 화면 버튼에 적용됩니다. 랜덤 섞기는 합법적인 회전으로
              생성하며 대회용 무작위 상태 생성기는 아닙니다.
            </p>
            {session.setup.length > 0 && (
              <p className="setup-sequence">
                <strong>시작 상태를 만든 수순</strong>
                <br />
                {session.setup.map(notation).join(' ')}
              </p>
            )}
          </div>
        </details>
      </main>
      <footer>
        <span>Cube Trainer</span> 한 번의 회전, 하나의 발견.
      </footer>
    </div>
  );
}
