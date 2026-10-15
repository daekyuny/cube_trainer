import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  FACES,
  NORMALS,
  applyMove,
  applyMoves,
  centerColor,
  equal,
  hasFirstTwoLayers,
  hasWhiteCross,
  inverse,
  isSolved,
  makePreset,
  normalizeOrientation,
  notation,
  ROTATIONS,
  SLICES,
  solvedCube,
} from '../src/domain/cube/cube.ts';
import type { Cube, Face, Move, Vec3 } from '../src/domain/cube/cube.ts';

function state(cube: Cube) {
  return cube.map((s) => `${s.position}:${s.normal}:${s.color}`).sort();
}

test('initial colors and opposite centers follow the requested orientation', () => {
  const cube = solvedCube();
  assert.equal(cube.length, 54);
  assert.deepEqual(
    FACES.map((face) => centerColor(cube, face)),
    ['red', 'green', 'yellow', 'white', 'blue', 'orange'],
  );
  assert.ok(isSolved(cube));
});

for (const face of [...FACES, ...SLICES, ...ROTATIONS] as const) {
  test(`${face}: inverse, four turns and half-turn agree without mutating input`, () => {
    const cube = solvedCube();
    const before = JSON.stringify(cube);
    const move = { face, turns: 1 } as const;
    assert.deepEqual(
      state(applyMoves(cube, [move, inverse(move)])),
      state(cube),
    );
    assert.deepEqual(
      state(applyMoves(cube, [move, move, move, move])),
      state(cube),
    );
    assert.deepEqual(
      state(applyMoves(cube, [move, move])),
      state(applyMove(cube, { face, turns: 2 })),
    );
    assert.equal(JSON.stringify(cube), before);
  });
}

test('known clockwise edge destinations on every face match an outside view', () => {
  const cases: [Face, Vec3, Vec3][] = [
    ['F', [0, 1, 1], [1, 0, 1]],
    ['R', [1, 1, 0], [1, 0, -1]],
    ['U', [0, 1, 1], [-1, 1, 0]],
    ['D', [0, -1, 1], [1, -1, 0]],
    ['L', [-1, 1, 0], [-1, 0, 1]],
    ['B', [0, 1, -1], [-1, 0, -1]],
  ];
  for (const [face, from, to] of cases) {
    const cube = solvedCube();
    const source = cube.find(
      (s) => equal(s.position, from) && equal(s.normal, NORMALS[face]),
    )!;
    const after = applyMove(cube, { face, turns: 1 }).find(
      (s) => s.id === source.id,
    )!;
    assert.deepEqual(after.position, to, face);
  }
});

test('horizontal rotation changes the front reference and leaves U/D centers fixed', () => {
  const cube = applyMove(solvedCube(), { face: 'Y', turns: 1 });
  assert.equal(centerColor(cube, 'F'), 'green');
  assert.equal(centerColor(cube, 'R'), 'orange');
  assert.equal(centerColor(cube, 'U'), 'yellow');
  assert.equal(centerColor(cube, 'D'), 'white');
  assert.ok(isSolved(cube));
  const frontTurn = applyMove(cube, { face: 'F', turns: 1 });
  const expected = applyMove(applyMove(solvedCube(), { face: 'R', turns: 1 }), {
    face: 'Y',
    turns: 1,
  });
  assert.deepEqual(state(frontTurn), state(expected));
});

const parse = (text: string): Move[] =>
  text.split(' ').map((token) => ({
    face: token[0] as Move['face'],
    turns: token.endsWith("'") ? -1 : token.endsWith('2') ? 2 : 1,
  }));

test('M/E/S follow L/D/F and x/y/z follow R/U/F, matching the standard identities', () => {
  // Where the front (red) or top (yellow) center goes after one turn.
  const centers: [string, Face, string][] = [
    ['M', 'D', 'red'],
    ['E', 'R', 'red'],
    ['S', 'R', 'yellow'],
    ['X', 'U', 'red'],
    ['Y', 'L', 'red'],
    ['Z', 'R', 'yellow'],
  ];
  for (const [move, face, color] of centers)
    assert.equal(
      centerColor(applyMoves(solvedCube(), parse(move)), face),
      color,
      move,
    );
  // x = R M′ L′, y = U E′ D′, z = F S B′ (same final state).
  for (const [rotationMove, layers] of [
    ['X', "R M' L'"],
    ['Y', "U E' D'"],
    ['Z', "F S B'"],
  ])
    assert.deepEqual(
      state(applyMoves(solvedCube(), parse(rotationMove))),
      state(applyMoves(solvedCube(), parse(layers))),
    );
  assert.deepEqual(
    [
      { face: 'M', turns: -1 },
      { face: 'X', turns: 1 },
      { face: 'Z', turns: -1 },
      { face: 'Y', turns: 1 },
      { face: 'Y', turns: 2 },
    ].map((move) => notation(move as Move)),
    ["M'", 'x', "z'", '→', 'y2'],
  );
});

test('orientation normalization recovers white down / red front from all 24 views', () => {
  const scrambled = applyMoves(solvedCube(), parse("R U2 F' L D B2 M E' S"));
  const reference = normalizeOrientation(scrambled);
  assert.equal(centerColor(reference, 'D'), 'white');
  assert.equal(centerColor(reference, 'F'), 'red');
  const views = new Set<string>();
  for (const first of ['', 'X', 'X2', "X'", 'Z', "Z'"])
    for (const yaw of ['', 'Y', 'Y2', "Y'"]) {
      const moves = parse([first, yaw].filter(Boolean).join(' ') || 'Y2 Y2');
      const viewed = applyMoves(scrambled, moves);
      views.add(`${centerColor(viewed, 'F')}${centerColor(viewed, 'U')}`);
      assert.deepEqual(normalizeOrientation(viewed), reference);
      // Cross / two-layer checks do not depend on how the cube is held.
      const f2l = applyMoves(makePreset('f2l', () => 0.3).cube, moves);
      assert.ok(hasFirstTwoLayers(f2l));
    }
  assert.equal(views.size, 24);
});

let seed = 924123;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
for (const preset of ['random', 'cross', 'f2l'] as const) {
  test(`${preset}: 100 reachable setups preserve required layers and piece integrity`, () => {
    for (let index = 0; index < 100; index++) {
      const { cube, moves } = makePreset(preset, random);
      assert.ok(!isSolved(cube));
      if (preset === 'cross') {
        assert.ok(hasWhiteCross(cube));
        assert.ok(!hasFirstTwoLayers(cube));
      }
      if (preset === 'f2l') assert.ok(hasFirstTwoLayers(cube));
      assert.equal(
        new Set(cube.map((s) => `${s.position}:${s.normal}`)).size,
        54,
      );
      for (const face of FACES)
        assert.equal(
          cube.filter((s) => equal(s.normal, NORMALS[face])).length,
          9,
        );
      assert.deepEqual(
        state(applyMoves(cube, [...moves].reverse().map(inverse))),
        state(solvedCube()),
      );
      assert.deepEqual(state(applyMoves(solvedCube(), moves)), state(cube));
    }
  });
}

test('practice presets remain useful with constant random sources', () => {
  for (const value of [0, 0.5, 0.999999])
    for (const preset of ['cross', 'f2l'] as const) {
      const { cube } = makePreset(preset, () => value);
      assert.ok(!isSolved(cube));
      assert.ok(
        preset === 'cross'
          ? hasWhiteCross(cube) && !hasFirstTwoLayers(cube)
          : hasFirstTwoLayers(cube),
      );
    }
});
