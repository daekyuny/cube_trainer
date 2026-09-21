import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSession,
  sessionReducer,
} from '../src/features/simulator/session.ts';
import { applyMoves, isSolved } from '../src/domain/cube/cube.ts';

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
