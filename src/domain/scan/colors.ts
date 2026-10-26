import type { Color } from '../cube/cube.ts';

export type Rgb = readonly [number, number, number];
export type Lab = readonly [number, number, number];

export const SCAN_COLORS: Color[] = [
  'white',
  'yellow',
  'red',
  'orange',
  'blue',
  'green',
];

// sRGB (0–255) to CIELAB (D65).
export function rgbToLab([r, g, b]: Rgb): Lab {
  const linear = (value: number) => {
    const c = value / 255;
    return c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

// Lighting mostly changes lightness, so it counts for half; hue and chroma
// tell red from orange and white from yellow.
export function distance(a: Lab, b: Lab): number {
  return Math.hypot((a[0] - b[0]) * 0.5, a[1] - b[1], a[2] - b[2]);
}

// Typical sticker colors under daylight, only to name the six centers.
export const REFERENCE: Record<Color, Lab> = {
  white: rgbToLab([236, 238, 236]),
  yellow: rgbToLab([240, 214, 40]),
  red: rgbToLab([196, 26, 42]),
  orange: rgbToLab([250, 122, 24]),
  blue: rgbToLab([24, 84, 206]),
  green: rgbToLab([22, 168, 82]),
};

export type Classified = {
  colors: Color[];
  // How clearly each sticker belongs to its color: its distance to the
  // color's mean over the distance to the next nearest mean (0 = clear).
  ambiguity: number[];
};

// Nine stickers per color: start from the six centers' own colors, then
// alternate a capacity-limited assignment with updating each color's mean.
export function classifyStickers(
  samples: readonly Lab[],
  centers: ReadonlyMap<number, Color>,
): Classified {
  const means = new Map<Color, Lab>(
    [...centers].map(([index, color]) => [color, samples[index]]),
  );
  let colors: Color[] = [];
  for (let round = 0; round < 8; round++) {
    const next = assign(samples, means, centers);
    const stable = next.every((color, index) => color === colors[index]);
    colors = next;
    for (const color of SCAN_COLORS) {
      const members = samples.filter((_, index) => colors[index] === color);
      means.set(
        color,
        [0, 1, 2].map(
          (k) => members.reduce((sum, lab) => sum + lab[k], 0) / members.length,
        ) as unknown as Lab,
      );
    }
    if (stable) break;
  }
  const ambiguity = samples.map((lab, index) => {
    const own = distance(lab, means.get(colors[index])!);
    const other = Math.min(
      ...SCAN_COLORS.filter((color) => color !== colors[index]).map((color) =>
        distance(lab, means.get(color)!),
      ),
    );
    return own / Math.max(other, 1e-6);
  });
  return { colors, ambiguity };
}

// Cheapest pairs first while each color has room, then swap pairs of
// stickers whenever that lowers the total distance.
function assign(
  samples: readonly Lab[],
  means: ReadonlyMap<Color, Lab>,
  fixed: ReadonlyMap<number, Color>,
): Color[] {
  const cost = (index: number, color: Color) =>
    fixed.has(index)
      ? fixed.get(index) === color
        ? -1e9
        : 1e9
      : distance(samples[index], means.get(color)!);
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
