import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSession,
  sessionReducer,
} from '../src/features/simulator/session.ts';
import { applyMoves, isSolved } from '../src/domain/cube/cube.ts';
import { getExercise, trainingStatus } from '../src/domain/f2l/lessons.ts';

function drain(session: ReturnType<typeof createSession>) {
  while (session.queue.length)
    session = sessionReducer(session, {
      type: 'frame',
      progress: 1,
      command: session.queue[0],
    });
  return session;
}

test('queued face moves and yaw commit in order, once per animation', () => {
  let session = createSession();
  const moves = [
    { face: 'R', turns: 1 },
    { face: 'Y', turns: 1 },
    { face: 'F', turns: -1 },
  ] as const;
  const expected = applyMoves(session.cube, moves);
  for (const move of moves)
    session = sessionReducer(session, { type: 'move', move });
  while (session.queue.length) {
    const command = session.queue[0];
    session = sessionReducer(session, { type: 'frame', progress: 1, command });
    const completed = session;
    session = sessionReducer(session, { type: 'frame', progress: 1, command });
    assert.equal(session, completed);
  }
  assert.deepEqual(session.cube, expected);
  assert.deepEqual(session.history, moves);
});

test('changing preset cancels stale animation frames and pending moves', () => {
  let session = sessionReducer(createSession(), {
    type: 'move',
    move: { face: 'F', turns: 1 },
  });
  const stale = session.queue[0];
  session = sessionReducer(session, { type: 'preset', preset: 'solved' });
  session = sessionReducer(session, {
    type: 'frame',
    progress: 1,
    command: stale,
  });
  assert.ok(isSolved(session.cube));
  assert.equal(session.queue.length, 0);
  assert.equal(session.history.length, 0);
});

test('undo restores face and orientation changes, and the input queue is bounded', () => {
  let session = createSession();
  for (let i = 0; i < 25; i++)
    session = sessionReducer(session, {
      type: 'move',
      move: { face: 'R', turns: 1 },
    });
  assert.equal(session.queue.length, 20);
  assert.ok(session.message);
  session = createSession();
  const initial = session.cube;
  for (const face of ['R', 'Y'] as const) {
    session = sessionReducer(session, {
      type: 'move',
      move: { face, turns: 1 },
    });
    session = sessionReducer(session, {
      type: 'frame',
      progress: 1,
      command: session.queue[0],
    });
  }
  for (let i = 0; i < 2; i++) {
    session = sessionReducer(session, { type: 'undo' });
    session = sessionReducer(session, {
      type: 'frame',
      progress: 1,
      command: session.queue[0],
    });
  }
  assert.deepEqual(session.cube, initial);
  assert.equal(session.history.length, 0);
});

test('SESSION-03: history reset preserves the committed cube and guidance, cancels pending frames', () => {
  let session = sessionReducer(createSession(), { type: 'lesson', id: 1 });
  session = drain(sessionReducer(session, { type: 'guide' }));
  const cube = session.cube;
  const cursor = session.lesson!.cursor;
  session = sessionReducer(session, { type: 'guide', wholeStage: true });
  const stale = session.queue[0];
  session = sessionReducer(session, {
    type: 'frame',
    command: stale,
    progress: 0.5,
  });
  session = sessionReducer(session, { type: 'clear-history' });
  assert.equal(session.cube, cube);
  assert.equal(session.history.length, 0);
  assert.equal(session.progress, 0);
  assert.equal(session.queue.length, 0);
  assert.equal(session.lesson!.cursor, cursor);
  assert.equal(
    sessionReducer(session, { type: 'frame', progress: 1, command: stale }),
    session,
  );
  assert.equal(sessionReducer(session, { type: 'undo' }), session);
  session = drain(sessionReducer(session, { type: 'guide' }));
  assert.equal(session.history.length, 1);
  assert.equal(session.lesson!.cursor, cursor! + 1);
});

test('SESSION-04: restart restores the exact random/exercise start and cancels old commands', () => {
  for (const initial of [
    createSession('random'),
    sessionReducer(createSession(), { type: 'lesson', id: 5, variant: 1 }),
  ]) {
    let session = drain(
      sessionReducer(initial, { type: 'move', move: { face: 'Y', turns: 1 } }),
    );
    session = sessionReducer(session, {
      type: 'move',
      move: { face: 'R', turns: 1 },
    });
    const stale = session.queue[0];
    session = sessionReducer(session, { type: 'restart' });
    assert.deepEqual(session.cube, initial.cube);
    assert.deepEqual(session.setup, initial.setup);
    assert.equal(session.lesson?.cursor ?? 0, 0);
    assert.deepEqual(session.history, []);
    assert.equal(
      sessionReducer(session, { type: 'frame', progress: 1, command: stale }),
      session,
    );
  }
});

test('F2L-04: demonstration, manual input, reset, undo and lesson switches share one session', () => {
  let session = sessionReducer(createSession(), { type: 'lesson', id: 2 });
  const e = getExercise(2);
  session = sessionReducer(session, { type: 'guide', wholeStage: true });
  assert.equal(
    sessionReducer(session, { type: 'guide', wholeStage: true }),
    session,
  );
  session = drain(session);
  assert.equal(trainingStatus(session.cube), 'paired');
  assert.equal(sessionReducer(session, { type: 'guide' }), session);
  assert.equal(session.lesson!.cursor, e.solution.length);
  session = drain(sessionReducer(session, { type: 'undo' }));
  assert.equal(session.lesson!.cursor, e.solution.length - 1);
  session = sessionReducer(session, { type: 'clear-history' });
  session = sessionReducer(session, { type: 'guide' });
  const stale = session.queue[0];
  session = sessionReducer(session, { type: 'lesson', id: 4 });
  const changed = session;
  session = sessionReducer(session, {
    type: 'frame',
    command: stale,
    progress: 1,
  });
  assert.equal(session, changed);
  assert.equal(session.lesson!.id, 4);
  assert.equal(session.history.length, 0);
});
