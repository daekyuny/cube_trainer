import type { Face, Vec3 } from '../cube/cube.ts';
import { FACELETS } from '../solver/facelets.ts';

export type Point = readonly [number, number];
// A corner view of the cube: `center` is the near corner where the three
// faces meet; `outer` runs clockwise from the top vertex (top, upper right,
// lower right, bottom, lower left, upper left).
export type Hexagon = { center: Point; outer: readonly Point[] };

// The outline of a cube filling most of the photo's shorter side.
export function defaultHexagon(width: number, height: number): Hexagon {
  const radius = Math.min(width, height) / 2.6;
  const [cx, cy] = [width / 2, height / 2];
  return {
    center: [cx, cy],
    outer: [-90, -30, 30, 90, 150, 210].map((degrees): Point => {
      const angle = (degrees * Math.PI) / 180;
      return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
    }),
  };
}

// The projective map taking four points to four points (perspective-correct
// inside a face photographed at an angle).
export function homography(
  from: readonly Point[],
  to: readonly Point[],
): (point: Point) => Point {
  // Solve the 8 unknowns h0..h7 (h8 = 1) by Gaussian elimination.
  const rows: number[][] = [];
  from.forEach(([x, y], index) => {
    const [u, v] = to[index];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++)
      if (Math.abs(rows[row][col]) > Math.abs(rows[pivot][col])) pivot = row;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const factor = rows[row][col] / rows[col][col];
      for (let k = col; k < 9; k++) rows[row][k] -= factor * rows[col][k];
    }
  }
  const h = rows.map((row, index) => row[8] / row[index]);
  return ([x, y]) => {
    const w = h[6] * x + h[7] * y + 1;
    return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
  };
}

// The three faces seen from the near corner, as held: U on top, F on the
// left, R on the right. Each lists its cube corners (as signs) in the order of
// the matching hexagon points: the near corner first.
const S = 1.5;
type FaceQuad = { face: Face; corners: Vec3[]; hexagon: number[] };
const QUADS: FaceQuad[] = [
  {
    face: 'U',
    corners: [
      [S, S, S],
      [-S, S, S],
      [-S, S, -S],
      [S, S, -S],
    ],
    hexagon: [-1, 5, 0, 1],
  },
  {
    face: 'F',
    corners: [
      [S, S, S],
      [-S, S, S],
      [-S, -S, S],
      [S, -S, S],
    ],
    hexagon: [-1, 5, 4, 3],
  },
  {
    face: 'R',
    corners: [
      [S, S, S],
      [S, S, -S],
      [S, -S, -S],
      [S, -S, S],
    ],
    hexagon: [-1, 1, 2, 3],
  },
];

// Face-plane coordinates (the two axes other than the face's) of a point.
function planeOf(quad: FaceQuad) {
  const axis = quad.corners[0].findIndex((_, i) =>
    quad.corners.every((c) => c[i] === quad.corners[0][i]),
  );
  const [a, b] = [0, 1, 2].filter((i) => i !== axis);
  return (p: Vec3): Point => [p[a], p[b]];
}

function faceMap(quad: FaceQuad, hexagon: Hexagon) {
  const vertex = (index: number) =>
    index < 0 ? hexagon.center : hexagon.outer[index];
  return homography(quad.corners.map(planeOf(quad)), quad.hexagon.map(vertex));
}

export type SamplePoint = { facelet: number; point: Point; radius: number };

// Where to read the 27 visible stickers in the photo, by facelet index (as
// held). The radius stays well inside the sticker, clear of the dark gaps.
export function samplePoints(hexagon: Hexagon): SamplePoint[] {
  return QUADS.flatMap((quad) => {
    const plane = planeOf(quad);
    const map = faceMap(quad, hexagon);
    return FACELETS.flatMap((facelet, index) => {
      if (facelet.face !== quad.face) return [];
      const [a, b] = plane(facelet.position);
      const point = map([a, b]);
      const step = (p: Point) => Math.hypot(p[0] - point[0], p[1] - point[1]);
      const radius =
        0.4 * Math.min(step(map([a + 0.5, b])), step(map([a, b + 0.5])));
      return [{ facelet: index, point, radius }];
    });
  });
}

// The three faces' 3×3 grids, for drawing over the photo.
export function gridLines(hexagon: Hexagon): [Point, Point][] {
  return QUADS.flatMap((quad) => {
    const map = faceMap(quad, hexagon);
    return [-S, -0.5, 0.5, S].flatMap((t): [Point, Point][] => [
      [map([t, -S]), map([t, S])],
      [map([-S, t]), map([S, t])],
    ]);
  });
}
