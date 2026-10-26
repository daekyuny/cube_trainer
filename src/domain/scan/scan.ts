import {
  applyMoves,
  centerColor,
  COLOR_NAMES,
  FACE_COLORS,
  FACES,
  solvedCube,
} from '../cube/cube.ts';
import type { Color, Face, Move } from '../cube/cube.ts';
import { FACELET_FACES, FACELETS, faceletIndex } from '../solver/facelets.ts';
import { homeFacelet } from '../solver/pieces.ts';
import { classifyStickers, distance, REFERENCE, rgbToLab } from './colors.ts';
import type { Lab, Rgb } from './colors.ts';

// The 24 ways to hold the cube, as whole-cube turns from the standard one.
const ORIENTATIONS: Move[][] = (
  [
    [],
    [{ face: 'X', turns: 1 }],
    [{ face: 'X', turns: 2 }],
    [{ face: 'X', turns: -1 }],
    [{ face: 'Z', turns: 1 }],
    [{ face: 'Z', turns: -1 }],
  ] as Move[][]
).flatMap((prefix) =>
  [0, 1, 2, 3].map((turns): Move[] => [
    ...prefix,
    ...Array.from({ length: turns }, (): Move => ({ face: 'Y', turns: 1 })),
  ]),
);
const HELD: Face[] = ['U', 'F', 'R'];
const CENTER = (face: Face) => FACELET_FACES.indexOf(face) * 9 + 4;

// Each way of holding: the colors its U/F/R centers show, and the standard
// facelet behind each facelet seen as held.
const HOLDS = ORIENTATIONS.map((turns) => {
  const held = applyMoves(solvedCube(), turns);
  return {
    centers: HELD.map((face) => centerColor(held, face)).join(),
    map: new Map(
      held.map((s) => [faceletIndex(s.position, s.normal), homeFacelet(s.id)]),
    ),
  };
});
const heldMapping = (colors: readonly Color[]) =>
  HOLDS.find((hold) => hold.centers === colors.join())?.map ?? null;

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [items.slice()];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
      (rest) => [item, ...rest],
    ),
  );
}

// The photo samples: for each photo, colors by facelet index as held (the
// 27 facelets of U, R and F).
export type PhotoSamples = ReadonlyMap<number, Rgb>;
export type ScanProblem = { message: string; facelets: number[] };
export type ScanResult =
  | {
      ok: true;
      // In standard facelet order (U R F D L B), yellow up / red front.
      colors: Color[];
      // Stickers read close to another color.
      unclear: boolean[];
      // Faces whose reading is unclear or breaks a cube rule.
      unsure: Face[];
      unsureFacelets: number[];
      problems: ScanProblem[];
    }
  | { ok: false; message: string };

// A sticker is unclear when it sits nearly as close to another color.
export const UNSURE_AMBIGUITY = 0.6;
// Distinct sticker colors stay well apart even under different light.
const SAME_CENTER = 15;

export function readCube(
  photos: readonly [PhotoSamples, PhotoSamples],
): ScanResult {
  const labs = photos.map(
    (photo) => new Map([...photo].map(([f, rgb]) => [f, rgbToLab(rgb)])),
  );
  // Name the six centers together: each photo must be a way of holding the
  // cube, and the two must show opposite corners (all six faces).
  const seen = photos.flatMap((_, p) =>
    HELD.map((face) => labs[p].get(CENTER(face))!),
  );
  // Six faces need six clearly different centers; a near repeat means the
  // same face was photographed twice.
  const repeat = seen.some((a, i) =>
    seen.some((b, j) => j > i && distance(a, b) < SAME_CENTER),
  );
  if (repeat)
    return {
      ok: false,
      message:
        '두 사진에 같은 면이 찍힌 것 같습니다. 두 번째는 반대쪽 꼭짓점을 찍어 주세요.',
    };
  let best: { cost: number; maps: Map<number, number>[] } | null = null;
  for (const colors of permutations(Object.values(FACE_COLORS))) {
    const maps = [
      heldMapping(colors.slice(0, 3)),
      heldMapping(colors.slice(3)),
    ];
    if (!maps[0] || !maps[1]) continue;
    const faces = (maps as Map<number, number>[]).flatMap((map) =>
      HELD.map((face) => FACELETS[map.get(CENTER(face))!].face),
    );
    if (new Set(faces).size !== 6) continue;
    const cost = colors.reduce(
      (sum, color, i) => sum + distance(seen[i], REFERENCE[color]),
      0,
    );
    if (!best || cost < best.cost)
      best = { cost, maps: maps as Map<number, number>[] };
  }
  if (!best)
    return {
      ok: false,
      message: '두 사진의 센터 색으로 큐브 방향을 알 수 없습니다.',
    };
  const samples: Lab[] = [];
  photos.forEach((_, p) => {
    for (const [held, lab] of labs[p]) samples[best!.maps[p].get(held)!] = lab;
  });
  if (samples.filter(Boolean).length !== 54)
    return {
      ok: false,
      message: '두 사진이 서로 반대쪽 세 면을 보여야 합니다.',
    };
  const centers = new Map(
    FACES.map((face) => [CENTER(face), FACE_COLORS[face]] as const),
  );
  const { colors, ambiguity } = classifyStickers(samples, centers);
  return review(
    colors,
    ambiguity.map((value) => value > UNSURE_AMBIGUITY),
  );
}

// Faces to show for confirmation: unclear stickers and broken cube rules.
export function review(colors: Color[], unclear: boolean[]): ScanResult {
  const problems = checkCube(colors);
  const unsureFacelets = [
    ...new Set([
      ...unclear.flatMap((flag, index) => (flag ? [index] : [])),
      ...problems.flatMap((problem) => problem.facelets),
    ]),
  ].sort((a, b) => a - b);
  const unsure = FACELET_FACES.filter((face) =>
    unsureFacelets.some((index) => FACELETS[index].face === face),
  );
  return { ok: true, colors, unclear, unsure, unsureFacelets, problems };
}

// Facelets of each corner and edge, by place; and the pieces' color sets.
const key = (p: readonly number[]) => p.join();
const PLACES = [...new Set(FACELETS.map((f) => key(f.position)))]
  .map((place) =>
    FACELETS.map((_, index) => index).filter(
      (index) => key(FACELETS[index].position) === place,
    ),
  )
  .filter((group) => group.length > 1);
const SOLVED = FACELETS.map((f) => FACE_COLORS[f.face]);
const pieceName = (colors: readonly Color[]) => [...colors].sort().join('+');
const PIECES = PLACES.map((group) => pieceName(group.map((i) => SOLVED[i])));
const isUpDown = (color: Color) => color === 'yellow' || color === 'white';
const isFrontBack = (color: Color) => color === 'red' || color === 'orange';

function parity(permutation: number[]): number {
  const seen = new Set<number>();
  let swaps = 0;
  for (let start = 0; start < permutation.length; start++) {
    let length = 0;
    for (let i = start; !seen.has(i); i = permutation[i]) {
      seen.add(i);
      length++;
    }
    if (length) swaps += length - 1;
  }
  return swaps % 2;
}

// The rules every real cube keeps: nine of each color, each corner and edge
// once with real colors, corner twists and edge flips that add up, and the
// same permutation parity for corners and edges.
export function checkCube(colors: readonly Color[]): ScanProblem[] {
  const problems: ScanProblem[] = [];
  for (const color of Object.values(FACE_COLORS)) {
    const count = colors.filter((c) => c === color).length;
    if (count !== 9)
      problems.push({
        message: `${COLOR_NAMES[color]} 칸이 ${count}개입니다(9개여야 합니다).`,
        facelets: [],
      });
  }
  const names = PLACES.map((group) => pieceName(group.map((i) => colors[i])));
  const pieces = names.map((name) => PIECES.indexOf(name));
  PLACES.forEach((group, place) => {
    if (pieces[place] < 0)
      problems.push({
        message:
          group.length === 3
            ? '없는 색 조합의 코너가 있습니다.'
            : '없는 색 조합의 엣지가 있습니다.',
        facelets: group,
      });
    else if (pieces.indexOf(pieces[place]) !== place)
      problems.push({
        message: '같은 조각이 두 번 읽혔습니다.',
        facelets: [...group, ...PLACES[pieces.indexOf(pieces[place])]],
      });
  });
  if (problems.length) return problems;
  // Twist: where each corner's yellow/white sticker sits, counted from its
  // U/D facelet in one fixed turning direction around every corner.
  // Flip: whether each edge's U/D (else F/B) color is on the U/D (else F/B)
  // facelet of its place.
  let twist = 0;
  let flip = 0;
  const corners: number[] = [];
  const edges: number[] = [];
  const normal = (i: number) => FACELETS[i].normal;
  PLACES.forEach((group, place) => {
    const upDown = group.find((i) => normal(i)[1] !== 0);
    if (group.length === 3) {
      const n = normal(upDown!);
      const p = FACELETS[upDown!].position;
      const turn = (i: number) => {
        const m = normal(i);
        return (
          (n[1] * m[2] - n[2] * m[1]) * p[0] +
          (n[2] * m[0] - n[0] * m[2]) * p[1] +
          (n[0] * m[1] - n[1] * m[0]) * p[2]
        );
      };
      const order = [
        upDown!,
        ...group.filter((i) => i !== upDown).sort((a, b) => turn(b) - turn(a)),
      ];
      twist += order.findIndex((i) => isUpDown(colors[i]));
      corners.push(pieces[place]);
    } else {
      const reference = upDown ?? group.find((i) => normal(i)[2] !== 0)!;
      const good = group.some((i) => isUpDown(colors[i]))
        ? isUpDown(colors[reference])
        : isFrontBack(colors[reference]);
      if (!good) flip++;
      edges.push(pieces[place]);
    }
  });
  if (twist % 3)
    problems.push({
      message:
        '코너 하나가 비틀린 것처럼 읽혔습니다. 코너 칸의 색을 확인하세요.',
      facelets: [],
    });
  if (flip % 2)
    problems.push({
      message:
        '엣지 하나가 뒤집힌 것처럼 읽혔습니다. 엣지 칸의 색을 확인하세요.',
      facelets: [],
    });
  // Pieces by rank among their kind, place by place.
  const rank = (list: number[]) => {
    const sorted = [...list].sort((a, b) => a - b);
    return list.map((piece) => sorted.indexOf(piece));
  };
  if (parity(rank(corners)) !== parity(rank(edges)))
    problems.push({
      message: '두 조각의 자리가 서로 바뀐 것처럼 읽혔습니다. 색을 확인하세요.',
      facelets: [],
    });
  return problems;
}
