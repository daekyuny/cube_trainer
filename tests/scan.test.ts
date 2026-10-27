import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  applyMoves,
  centerColor,
  COLORS,
  FACE_COLORS,
  makePreset,
  solvedCube,
} from '../src/domain/cube/cube.ts';
import type { Color, Cube } from '../src/domain/cube/cube.ts';
import { distance } from '../src/domain/scan/colors.ts';
import type { Rgb } from '../src/domain/scan/colors.ts';
import {
  defaultHexagon,
  gridLines,
  homography,
  samplePoints,
} from '../src/domain/scan/geometry.ts';
import {
  calibrateFromSolved,
  checkCube,
  readCube,
} from '../src/domain/scan/scan.ts';
import type { PhotoSamples } from '../src/domain/scan/scan.ts';
import { cubeColors, FACELETS } from '../src/domain/solver/facelets.ts';
import { parseAlgorithm } from '../src/domain/training/guide.ts';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (color: Color): Rgb => {
  const value = parseInt(COLORS[color].slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
};
// What a photo of the cube held this way shows on its U, R and F faces,
// under its own light (a brightness and color cast) with sensor noise.
function photo(
  cube: Cube,
  held: string,
  light: Rgb,
  noise: number,
  random: () => number,
): PhotoSamples {
  const colors = cubeColorsHeld(applyMoves(cube, parseAlgorithm(held)));
  const samples = new Map<number, Rgb>();
  colors.forEach((color, facelet) => {
    if (!['U', 'R', 'F'].includes(FACELETS[facelet].face)) return;
    const shade = (c: number, k: number) =>
      Math.max(
        0,
        Math.min(255, c * (light[k] / 255) + (random() - 0.5) * 2 * noise),
      );
    const [r, g, b] = hex(color);
    samples.set(facelet, [shade(r, 0), shade(g, 1), shade(b, 2)]);
  });
  return samples;
}
// Facelet colors as the cube is held, without turning it upright.
function cubeColorsHeld(cube: Cube): Color[] {
  const colors: Color[] = [];
  for (const s of cube)
    colors[
      FACELETS.findIndex(
        (f) =>
          f.position.every((v, i) => v === s.position[i]) &&
          f.normal.every((v, i) => v === s.normal[i]),
      )
    ] = s.color;
  return colors;
}

// The 24 ways to hold a cube, and which faces each shows on U, F and R.
const HOLDS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((prefix) =>
  ['', 'y', 'y2', "y'"].map((turn) => [prefix, turn].join(' ').trim()),
);
const shown = (held: string) => {
  const turned = applyMoves(solvedCube(), parseAlgorithm(held));
  return ['U', 'F', 'R'].map((face) =>
    centerColor(turned, face as 'U' | 'F' | 'R'),
  );
};

test('SCAN-01: two corner photos read back the cube, whichever way each is held', () => {
  const random = seeded(4);
  for (const [index, first] of HOLDS.entries()) {
    const seenFirst = shown(first);
    const opposite = HOLDS.filter((held) =>
      shown(held).every((color) => !seenFirst.includes(color)),
    );
    assert.equal(opposite.length, 3);
    const second = opposite[index % 3];
    const { cube } = makePreset('random', random);
    const result = readCube([
      photo(cube, first, [255, 240, 225], 10, random),
      photo(cube, second, [210, 215, 235], 10, random),
    ]);
    assert.ok(result.ok, `${first} / ${second}`);
    if (!result.ok) continue;
    assert.deepEqual(result.colors, cubeColors(cube));
    assert.deepEqual(result.problems, []);
  }
});

test('SCAN-02: the same corner photographed twice is refused', () => {
  const random = seeded(9);
  const { cube } = makePreset('random', random);
  for (const second of ['', 'y'])
    assert.equal(
      readCube([
        photo(cube, '', [255, 255, 255], 4, random),
        photo(cube, second, [245, 245, 250], 4, random),
      ]).ok,
      false,
    );
});

test('SCAN-03: unclear stickers mark their faces for confirmation', () => {
  const random = seeded(12);
  const { cube } = makePreset('random', random);
  const first = new Map(photo(cube, '', [255, 255, 255], 3, random));
  // One front sticker (not the center) photographed halfway between red and
  // orange: the reading flags it and its face.
  const facelet = FACELETS.findIndex(
    (f, index) => f.face === 'F' && index % 9 !== 4,
  );
  first.set(facelet, [244, 92, 76]);
  const result = readCube([
    first,
    photo(cube, 'z2 y', [255, 255, 255], 3, random),
  ]);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.ok(result.unsureFacelets.includes(facelet));
  assert.ok(result.unsure.includes('F'));
});

test('SCAN-04: cube rules catch impossible readings', () => {
  const solved = cubeColors(solvedCube());
  assert.deepEqual(checkCube(solved), []);
  for (const { cube } of Array.from({ length: 20 }, () =>
    makePreset('random', seeded(20)),
  ))
    assert.deepEqual(checkCube(cubeColors(cube)), []);
  const at = (face: string, row: number, col: number) =>
    FACELETS.findIndex(
      (f, index) => f.face === face && index % 9 === row * 3 + col,
    );
  const swap = (colors: Color[], pairs: [number, number][]) => {
    const next = [...colors];
    for (const [a, b] of pairs) [next[a], next[b]] = [next[b], next[a]];
    return next;
  };
  // Twisted UFR corner: U → R → F → U.
  const ufr = [at('U', 2, 2), at('R', 0, 0), at('F', 0, 2)];
  const twisted = [...solved];
  [twisted[ufr[0]], twisted[ufr[1]], twisted[ufr[2]]] = [
    solved[ufr[2]],
    solved[ufr[0]],
    solved[ufr[1]],
  ];
  assert.match(checkCube(twisted)[0].message, /비틀/);
  // Flipped UF edge.
  const flipped = swap(solved, [[at('U', 2, 1), at('F', 0, 1)]]);
  assert.match(checkCube(flipped)[0].message, /뒤집/);
  // Two edges exchanged (UF and UR) without a corner swap.
  const exchanged = swap(solved, [
    [at('U', 2, 1), at('U', 1, 2)],
    [at('F', 0, 1), at('R', 0, 1)],
  ]);
  assert.match(checkCube(exchanged)[0].message, /자리/);
  // A sticker painted the wrong color: an impossible piece and a count.
  const wrong = [...solved];
  wrong[at('F', 0, 1)] = 'green';
  const problems = checkCube(wrong);
  assert.ok(problems.some((p) => p.facelets.includes(at('F', 0, 1))));
  assert.equal(FACE_COLORS.F, 'red');
});

test('SCAN-05: sample points sit inside the fitted faces, a perspective map keeps corners', () => {
  const map = homography(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    [
      [10, 10],
      [50, 12],
      [60, 70],
      [5, 60],
    ],
  );
  assert.deepEqual(map([1, 1]).map(Math.round), [60, 70]);
  const hexagon = defaultHexagon(600, 600);
  const points = samplePoints(hexagon);
  assert.equal(points.length, 27);
  // The three centers are the middle of each face's rhombus.
  const center = points.find(
    (p) => FACELETS[p.facelet].face === 'U' && p.facelet % 9 === 4,
  )!;
  const [cx, cy] = hexagon.center;
  const [tx, ty] = hexagon.outer[0];
  assert.ok(Math.abs(center.point[0] - (cx + tx) / 2) < 1);
  assert.ok(Math.abs(center.point[1] - (cy + ty) / 2) < 1);
  assert.ok(points.every((p) => p.radius > 5 && p.radius < 40));
  assert.equal(gridLines(hexagon).length, 24);
});

// Real readings of a stickerless GAN cube in daylight (see the fixture note).
const REAL = JSON.parse(
  readFileSync(
    new URL('./fixtures/real-cube-colors.json', import.meta.url),
    'utf8',
  ),
) as {
  faces: Record<Color, Rgb[]>;
  corners: { yellowUp: [number, Rgb][]; whiteUp: [number, Rgb][] };
};
const realCorners = (): [PhotoSamples, PhotoSamples] => [
  new Map(REAL.corners.yellowUp),
  new Map(REAL.corners.whiteUp),
];

test('SCAN-06: real corner photos of a solved cube read back exactly, logo on the white center included', () => {
  const [first, second] = realCorners();
  // The white center reads blue (its logo); orientation still holds.
  const result = readCube([first, second]);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(result.colors, cubeColors(solvedCube()));
});

// A scrambled cube as those two photos would show it: every sticker takes a
// real reading of its color (centers their own, logo too) dimmed by how lit
// its face was in the real corner photos, then varied per sticker.
const FACE_LIGHT: Record<string, number> = {
  '0U': 0.905,
  '0F': 1,
  '0R': 0.54,
  '1U': 0.88,
  '1F': 0.96,
  '1R': 0.77,
};
function realPhoto(
  cube: Cube,
  held: string,
  index: 0 | 1,
  spread: number,
  noise: number,
  random: () => number,
): PhotoSamples {
  const colors = cubeColorsHeld(applyMoves(cube, parseAlgorithm(held)));
  const samples = new Map<number, Rgb>();
  colors.forEach((color, facelet) => {
    const face = FACELETS[facelet].face;
    if (!['U', 'R', 'F'].includes(face)) return;
    const cells = REAL.faces[color];
    const base =
      facelet % 9 === 4
        ? cells[4]
        : cells.filter((_, i) => i !== 4)[Math.floor(random() * 8)];
    const k =
      FACE_LIGHT[`${index}${face}`] * (1 - spread / 2 + spread * random());
    samples.set(
      facelet,
      base.map((v) =>
        Math.max(0, Math.min(255, v * k + (random() - 0.5) * noise)),
      ) as unknown as Rgb,
    );
  });
  return samples;
}

test('SCAN-07: scrambled cubes in real colors and face light read correctly; misreads are never silent', () => {
  const random = seeded(77);
  let wrong = 0;
  for (let i = 0; i < 60; i++) {
    const { cube } = makePreset('random', random);
    const result = readCube([
      realPhoto(cube, '', 0, 0.4, 30, random),
      realPhoto(cube, 'z2 y', 1, 0.4, 30, random),
    ]);
    assert.ok(result.ok);
    if (!result.ok) continue;
    wrong += result.colors.filter((c, k) => c !== cubeColors(cube)[k]).length;
  }
  assert.equal(wrong, 0);
  // Much harsher light: a few stickers may be misread, but each such cube
  // asks for confirmation or breaks a cube rule.
  for (let i = 0; i < 60; i++) {
    const { cube } = makePreset('random', random);
    const result = readCube([
      realPhoto(cube, '', 0, 0.7, 45, random),
      realPhoto(cube, 'z2 y', 1, 0.7, 45, random),
    ]);
    if (!result.ok) continue;
    const misread = result.colors.some((c, k) => c !== cubeColors(cube)[k]);
    if (misread)
      assert.ok(result.unsureFacelets.length || result.problems.length);
  }
});

test('SCAN-08: a solved cube calibrates the palette; a scrambled one is refused', () => {
  const calibration = calibrateFromSolved(realCorners());
  assert.ok(calibration.ok);
  if (!calibration.ok) return;
  // Calibrated red and orange sit where this cube shows them, still apart.
  assert.ok(
    distance(calibration.palette.red, calibration.palette.orange) > 0.25,
  );
  const random = seeded(5);
  const { cube } = makePreset('random', random);
  const shots: [PhotoSamples, PhotoSamples] = [
    realPhoto(cube, '', 0, 0.3, 20, random),
    realPhoto(cube, 'z2 y', 1, 0.3, 20, random),
  ];
  const result = readCube(shots, calibration.palette);
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.colors, cubeColors(cube));
  assert.equal(calibrateFromSolved(shots).ok, false);
});
