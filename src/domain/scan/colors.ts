import type { Color } from '../cube/cube.ts';

export type Rgb = readonly [number, number, number];
// A sticker color as its chroma vector (saturation × hue direction) and its
// brightness. Shade and exposure change brightness but keep hue, so red and
// orange stay apart on a shaded face; white sits near the middle.
export type Feature = readonly [number, number, number];

export const SCAN_COLORS: Color[] = [
  'white',
  'yellow',
  'red',
  'orange',
  'blue',
  'green',
];

export function hsv([r, g, b]: Rgb): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let hue = 0;
  if (delta)
    hue =
      max === r
        ? ((g - b) / delta + 6) % 6
        : max === g
          ? (b - r) / delta + 2
          : (r - g) / delta + 4;
  return [hue * 60, max ? delta / max : 0, max / 255];
}

export function feature(rgb: Rgb): Feature {
  const [hue, saturation, value] = hsv(rgb);
  const angle = (hue * Math.PI) / 180;
  return [saturation * Math.cos(angle), saturation * Math.sin(angle), value];
}

// Brightness counts a little: it only separates a dim, washed-out color
// from white a bit better.
export function distance(a: Feature, b: Feature): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], (a[2] - b[2]) * 0.25);
}

export type Palette = Record<Color, Feature>;
const tone = (hue: number, saturation = 1, value = 0.9): Feature => {
  const angle = (hue * Math.PI) / 180;
  return [saturation * Math.cos(angle), saturation * Math.sin(angle), value];
};
// Measured from a stickerless cube in daylight (iPhone, straight-on faces):
// red 349–354°, orange 16–19°, yellow 62°, green 120°, blue 206°, white
// saturation ≤ 0.03. A calibration with the learner's own cube replaces it.
export const DEFAULT_PALETTE: Palette = {
  white: [0, 0, 0.88],
  yellow: tone(62),
  red: tone(352),
  orange: tone(17),
  blue: tone(206),
  green: tone(120),
};

export type Classified = {
  colors: Color[];
  // How clearly each sticker belongs to its color: its distance to the
  // color's mean over the distance to the next nearest mean (0 = clear).
  ambiguity: number[];
};

// Nine stickers per color: start from the palette, then alternate a
// capacity-limited assignment with updating each color's mean from its
// stickers, so the means settle on this cube under this light. Centers are
// known and fixed; they never seed a mean (a center may carry a logo).
export function classifyStickers(
  samples: readonly Feature[],
  centers: ReadonlyMap<number, Color>,
  palette: Palette = DEFAULT_PALETTE,
): Classified {
  const means = new Map<Color, Feature>(
    SCAN_COLORS.map((color) => [color, palette[color]]),
  );
  let colors: Color[] = [];
  for (let round = 0; round < 8; round++) {
    const next = assign(samples, means, centers);
    const stable = next.every((color, index) => color === colors[index]);
    colors = next;
    for (const color of SCAN_COLORS) {
      const members = samples.filter(
        (_, index) => colors[index] === color && !centers.has(index),
      );
      if (members.length)
        means.set(
          color,
          [0, 1, 2].map(
            (k) =>
              members.reduce((sum, value) => sum + value[k], 0) /
              members.length,
          ) as unknown as Feature,
        );
    }
    if (stable) break;
  }
  const ambiguity = samples.map((value, index) => {
    if (centers.has(index)) return 0;
    const own = distance(value, means.get(colors[index])!);
    const other = Math.min(
      ...SCAN_COLORS.filter((color) => color !== colors[index]).map((color) =>
        distance(value, means.get(color)!),
      ),
    );
    return own / Math.max(other, 1e-6);
  });
  return { colors, ambiguity };
}

// Cheapest pairs first while each color has room, then swap pairs of
// stickers whenever that lowers the total distance.
function assign(
  samples: readonly Feature[],
  means: ReadonlyMap<Color, Feature>,
  fixed: ReadonlyMap<number, Color>,
): Color[] {
  const cost = (index: number, color: Color) =>
    fixed.has(index)
      ? fixed.get(index) === color
        ? -1e9
        : 1e9
      : distance(samples[index], means.get(color)!) ** 2;
  const pairs = samples
    .flatMap((_, index) => SCAN_COLORS.map((color) => ({ index, color })))
    .sort((a, b) => cost(a.index, a.color) - cost(b.index, b.color));
  const room = new Map(SCAN_COLORS.map((color) => [color, 9]));
  const colors: Color[] = [];
  for (const { index, color } of pairs) {
    if (colors[index] || !room.get(color)) continue;
    colors[index] = color;
    room.set(color, room.get(color)! - 1);
  }
  for (let improved = true; improved;) {
    improved = false;
    for (let i = 0; i < samples.length; i++)
      for (let j = i + 1; j < samples.length; j++) {
        const [a, b] = [colors[i], colors[j]];
        if (a === b) continue;
        if (cost(i, b) + cost(j, a) < cost(i, a) + cost(j, b) - 1e-9) {
          colors[i] = b;
          colors[j] = a;
          improved = true;
        }
      }
  }
  return colors;
}

// A palette from a solved cube's samples: each color's mean, leaving out
// the centers (a logo) and the readings farthest from the rest.
export function calibrate(
  samples: ReadonlyMap<Color, readonly Feature[]>,
): Palette {
  const palette = { ...DEFAULT_PALETTE };
  for (const [color, values] of samples) {
    if (!values.length) continue;
    const middle = (list: readonly Feature[]) =>
      [0, 1, 2].map(
        (k) => list.reduce((sum, v) => sum + v[k], 0) / list.length,
      ) as unknown as Feature;
    const first = middle(values);
    const kept = [...values]
      .sort((a, b) => distance(a, first) - distance(b, first))
      .slice(0, Math.max(1, Math.ceil(values.length * 0.75)));
    palette[color] = middle(kept);
  }
  return palette;
}
