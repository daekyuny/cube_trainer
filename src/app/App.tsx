import { useEffect, useReducer, useState } from 'react';
import {
  COLORS,
  COLOR_NAMES,
  FACES,
  ROTATIONS,
  SLICES,
  centerColor,
  hasFirstTwoLayers,
  hasWhiteCross,
  isCubeRotation,
  isSolved,
  notation,
} from '../domain/cube/cube';
import type { Face, Move } from '../domain/cube/cube';
import { CircleView } from '../features/simulator/CircleView';
import { CubeView } from '../features/simulator/CubeView';
import { createSession, sessionReducer } from '../features/simulator/session';
import { useCubeDrag } from '../features/simulator/useCubeDrag';
import { LessonPanel } from '../features/f2l/LessonPanel';
import { LastLayerPanel } from '../features/last-layer/LastLayerPanel';
import { PracticePanel } from '../features/practice/PracticePanel';
import { PRACTICE_STAGES } from '../domain/practice/practice';
import { targetIds, trainingStatus } from '../domain/f2l/lessons';
import {
  getLastLayerExercise,
  LAST_LAYER_STEPS,
  lastLayerSet,
  lastLayerStatus,
} from '../domain/last-layer/cases';
import type { LastLayerCaseId } from '../domain/last-layer/cases';

type Mode = 'practice' | 'f2l' | 'oll' | 'pll';
const modes: { id: Mode; title: string; note: string }[] = [
  {
    id: 'practice',
    title: '단계별 연습',
    note: '다섯 단계를 무작위 배치로',
  },
  {
    id: 'f2l',
    title: 'F2L 페어링',
    note: 'W 십자가 다음, 두 조각을 한 페어로',
  },
  { id: 'oll', title: '2-Look OLL', note: '1·2층 다음, 윗면을 두 번에 노랗게' },
  { id: 'pll', title: '2-Look PLL', note: '윗면 노랑 다음, 위치를 두 번에' },
];
const firstCase: Record<'oll' | 'pll', LastLayerCaseId> = {
  oll: 'oll-line',
  pll: 'pll-t',
};
// Middle layers, wide turns and whole-cube turns, beside the six face buttons.
const extraMoves: { face: Move['face']; label: string; name: string }[] = [
  { face: 'M', label: 'M', name: '세로 중간 · L 방향' },
  { face: 'E', label: 'E', name: '가로 중간 · D 방향' },
  { face: 'S', label: 'S', name: '앞뒤 중간 · F 방향' },
  { face: 'X', label: 'x', name: '전체 · R 방향' },
  { face: 'Y', label: 'y', name: '전체 · U 방향' },
  { face: 'Z', label: 'z', name: '전체 · F 방향' },
  { face: 'f', label: 'f', name: '앞 두 줄 · F 방향' },
  { face: 'r', label: 'r', name: '오른쪽 두 줄 · R 방향' },
  { face: 'u', label: 'u', name: '위 두 줄 · U 방향' },
];
const keyMoves: Move['face'][] = [...FACES, ...SLICES, ...ROTATIONS];
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
  const drag = useCubeDrag({ busy: Boolean(command), slow, dispatch });
  // A queued command always wins; otherwise show the live drag preview.
  const shownMove = command?.move ?? drag.preview?.move;
  const shownProgress = command
    ? session.progress
    : (drag.preview?.progress ?? 0);

  useEffect(() => {
    if (!command) return;
    let frame: number;
    let start: number | undefined;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    // A released drag resumes from its angle and only animates the remainder.
    const from = command.from ?? 0;
    const duration = (reduced ? 0 : slow ? 650 : 260) * (1 - from);
    const tick = (time: number) => {
      start ??= time;
      const progress = duration
        ? from + (1 - from) * Math.min(1, (time - start) / duration)
        : 1;
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
      const face = event.key.toUpperCase() as Move['face'];
      if (keyMoves.includes(face)) {
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
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        // ↑ tips the front face up (x), ↓ tips it down (x′).
        event.preventDefault();
        dispatch({
          type: 'move',
          move: { face: 'X', turns: event.key === 'ArrowUp' ? 1 : -1 },
        });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const turnFace = (face: Move['face'], shift: boolean) =>
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
  const lesson = session.lesson;
  const mode: Mode =
    !lesson || lesson.kind === 'practice'
      ? 'practice'
      : lesson.kind === 'f2l'
        ? 'f2l'
        : lastLayerSet(lesson.id);
  const activeMode = modes.find((item) => item.id === mode)!;
  const practice = lesson?.kind === 'practice' ? lesson.exercise : null;
  // Which F2L pair or last-layer step the current lesson or practice is on.
  const f2lSide =
    lesson?.kind === 'f2l'
      ? lesson.side
      : practice?.stage === 'f2l'
        ? practice.side!
        : null;
  const lastLayerCase =
    lesson?.kind === 'last-layer' ? getLastLayerExercise(lesson.id).case : null;
  const lastLayerStep =
    lastLayerCase?.step ??
    (practice && practice.stage !== 'f2l' ? practice.stage : null);
  const pairStatus = f2lSide ? trainingStatus(session.cube, f2lSide) : null;
  const caseStatus = lastLayerStep
    ? lastLayerStatus(session.cube, lastLayerStep)
    : null;
  const stageStatus =
    pairStatus === 'paired'
      ? '페어 완성 · 십자·세 슬롯 유지'
      : pairStatus === 'pair-cross-broken'
        ? '페어 연결 · W 십자 복원 중'
        : pairStatus === 'slots-disturbed'
          ? '다른 세 슬롯 복원 필요'
          : caseStatus === 'complete' && lastLayerStep !== 'pll-edges'
            ? `${LAST_LAYER_STEPS.find((step) => step.id === lastLayerStep)!.goal} 완성`
            : caseStatus === 'needs-auf'
              ? 'U 맞추기만 남음'
              : caseStatus === 'f2l-open'
                ? '공식 진행 중 · 1·2층 복원 전'
                : cubeStatus;
  // Practice always marks its pair: the side is random.
  const highlightIds =
    f2lSide && (focus || practice) ? targetIds(f2lSide) : undefined;
  const selectMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'practice') dispatch({ type: 'preset', preset: 'solved' });
    else if (next === 'f2l') dispatch({ type: 'lesson', id: 1 });
    else dispatch({ type: 'last-layer', id: firstCase[next] });
  };
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
          3 × 3 <span> / </span> {activeMode.title}
        </span>
      </header>
      <main id="main">
        <div className="page-heading">
          <div>
            <p className="eyebrow">돌려 보고, 이해하고, 다시 한 번.</p>
            <h1>한 수씩, 큐브 연습</h1>
          </div>
          <span className="orientation-note">
            <i /> {COLOR_NAMES[centerColor(session.cube, 'U')]} 위 ·{' '}
            {COLOR_NAMES[centerColor(session.cube, 'D')]} 아래
          </span>
        </div>
        <nav className="practice-modes" aria-label="연습 모드">
          {modes.map((item) => (
            <button
              key={item.id}
              aria-pressed={item.id === mode}
              onClick={() => selectMode(item.id)}
            >
              {item.title}
            </button>
          ))}
          <span>{activeMode.note}</span>
        </nav>
        <div className="workspace is-training">
          <section className="simulator" aria-label="큐브 연습 공간">
            <div className="stage-toolbar">
              <span className="live-badge">
                <i /> {stageStatus}
              </span>
              <span className="move-count">
                {session.history.filter((move) => !isCubeRotation(move)).length}{' '}
                moves
              </span>
            </div>
            <div
              className="cube-stage"
              data-testid="cube-stage"
              data-busy={Boolean(command)}
              data-dragging={Boolean(drag.preview)}
            >
              <figure className="primary-cube" {...drag.handlers}>
                <figcaption>
                  <span className="view-number">01</span> 기준 큐브{' '}
                  <span className="view-hint">앞 · 오른쪽 · 위</span>
                </figcaption>
                <CubeView
                  cube={session.cube}
                  move={shownMove}
                  progress={shownProgress}
                  highlightIds={highlightIds}
                />
                <div className="face-legend">
                  {facesLegend(['F', 'R', 'U'])}
                </div>
              </figure>
              <figure className="secondary-cube">
                <figcaption>
                  <span className="view-number">02</span> 원 그래프{' '}
                  <span className="view-hint">층마다 원 하나</span>
                </figcaption>
                <CircleView
                  cube={session.cube}
                  move={shownMove}
                  progress={shownProgress}
                  lastMove={session.history.at(-1)}
                  highlightIds={highlightIds}
                />
              </figure>
            </div>
            <div className="stage-caption">
              {f2lSide
                ? `R·${f2lSide === 'left' ? 'B' : 'G'}·W 코너 · R·${f2lSide === 'left' ? 'B' : 'G'} 엣지 / 두 그림은 같은 큐브입니다.`
                : lastLayerStep
                  ? `${lastLayerStep.startsWith('oll') ? '윗면의 노란 스티커' : '윗층 옆면의 색'}로 케이스를 찾아보세요 / 두 그림은 같은 큐브입니다.`
                  : '연습할 단계를 고르세요 / 두 그림은 같은 큐브입니다.'}
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
                      className={isCubeRotation(move) ? 'yaw-move' : ''}
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
            {lesson?.kind === 'f2l' && (
              <LessonPanel
                session={session}
                lesson={lesson}
                dispatch={dispatch}
                focus={focus}
                onFocusChange={setFocus}
              />
            )}
            {mode === 'practice' && (
              <PracticePanel
                session={session}
                lesson={lesson?.kind === 'practice' ? lesson : null}
                dispatch={dispatch}
              />
            )}
            {lesson?.kind === 'last-layer' && (
              <LastLayerPanel
                session={session}
                lesson={lesson}
                dispatch={dispatch}
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
              <div
                className="extra-moves"
                aria-label="중간층·큐브 전체·두 줄 회전"
              >
                {extraMoves.map((item) => (
                  <button
                    key={item.face}
                    className="extra-move"
                    onClick={(event) => turnFace(item.face, event.shiftKey)}
                    aria-label={`${item.label} ${item.name} ${counterclockwise ? '반시계' : '시계'} 방향 회전`}
                  >
                    <strong>
                      {item.label}
                      {counterclockwise ? '′' : ''}
                    </strong>
                    <span>{item.name}</span>
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
                <kbd>M</kbd>
                <kbd>E</kbd>
                <kbd>S</kbd>
                <kbd>X</kbd>
                <kbd>Y</kbd>
                <kbd>Z</kbd>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                <span>
                  <kbd>Shift</kbd> + 문자 키는 반시계 방향 · ← → 전체 수평 · ↑ ↓
                  전체 위아래
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
          </aside>
        </div>
        <details className="help-panel">
          <summary>사용 방법과 현재 시작 상태</summary>
          <div>
            <p>
              <strong>
                {lesson?.kind === 'f2l'
                  ? `F2L ${lesson.id}번 유형`
                  : lastLayerCase
                    ? `${mode.toUpperCase()} ${lastLayerCase.name} 케이스`
                    : practice
                      ? `단계별 연습 · ${PRACTICE_STAGES.find((stage) => stage.id === practice.stage)!.title} 랜덤 배치`
                      : '맞춘 큐브'}
              </strong>
              에서 시작했습니다. 큐브 그림과 오른쪽 원 그래프는 언제나 같은
              큐브를 보여 줍니다. 원 그래프는 여섯 면의 스티커를 점으로 펼친
              것으로, 안쪽 세 묶음이 보이는 U/F/R, 바깥 세 묶음이 B/L/D입니다.
              한 층을 돌리면 그 층의 원이 굵게 표시되고 점들이 원을 따라
              움직입니다. 조작은 큐브 그림에서 합니다.
            </p>
            <p>
              수순 리셋은 현재 큐브를 유지하고 기록과 대기 입력만 비웁니다. 시작
              상태로 되돌리기와 같은 배치 다시는 큐브도 처음 배치로 복원합니다.
            </p>
            {lesson?.kind === 'last-layer' && (
              <p>
                2-Look OLL은 엣지 방향(노란 십자) → 코너 방향(윗면 노랑), 2-Look
                PLL은 코너 위치(헤드라이트) → 엣지 위치(완성) 순서로 연습합니다.
                공식은 해피 큐빙 초급 CFOP 강의 방식을 따라 반복 동작을 괄호로
                묶고(트위스트 R U R′ U′, 슬레지해머 R′ F R F′), 앞 두
                줄(f)·가운데 줄(M)·큐브 전체(x) 회전으로 외울 양을 줄였습니다.
                각 케이스는 공식을 바로 적용하는 각도로 시작하며, 단계를 마치면
                이어지는 다음 단계 케이스로 넘어갈 수 있습니다.
              </p>
            )}
            {mode === 'practice' && (
              <p>
                단계별 연습은 F2L 페어링, OLL 1·2단계, PLL 1·2단계 중 하나를
                골라 그 단계를 무작위 배치로 연습합니다. 앞 단계까지는 맞춘
                상태이고, 윗층은 2-Look 공식을 무작위로 섞어 실제 회전으로
                만듭니다. F2L은 배운 다섯 유형과 좌우 대칭 중에서 나옵니다.
                풀이는 처음에 숨겨져 있고, 풀이 보기를 누르면 케이스 이름과 U
                맞추기를 포함한 공식·시연이 나타납니다.
              </p>
            )}
            {lesson?.kind === 'f2l' && (
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
              노랑·흰색 스티커는 다른 면으로 움직일 수 있습니다. 중간층(M·E·S)과
              두 줄(f·r·u) 회전은 버튼으로, 중간층은 키보드로도 돌릴 수
              있습니다.
            </p>
            <p>
              문자 키는 시계 방향, Shift + 문자 키는 반시계 방향입니다. 화면의
              방향 선택은 화면 버튼에 적용됩니다.
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
