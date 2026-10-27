import { distance, feature } from './colors.ts';
import type { Rgb } from './colors.ts';
import type { Point } from './geometry.ts';

export type Pixels = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

function medianColor(
  pixels: Pixels,
  [cx, cy]: Point,
  radius: number,
): Rgb | null {
  const channels: number[][] = [[], [], []];
  const r = Math.max(1, radius);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const offset = (y * pixels.width + x) * 4;
      for (let k = 0; k < 3; k++) channels[k].push(pixels.data[offset + k]);
    }
  if (!channels[0].length) return null;
  return channels.map((values) => {
    values.sort((a, b) => a - b);
    return values[values.length >> 1];
  }) as unknown as Rgb;
}

// Nine small patches across the disc; the one most like the others stands
// for the sticker. A glare spot, a dark gap or a corner of the next sticker
// caught by a few patches does not move the reading.
export function sampleColor(
  pixels: Pixels,
  [cx, cy]: Point,
  radius: number,
): Rgb {
  const step = radius * 0.6;
  const patches = [-1, 0, 1]
    .flatMap((dy) =>
      [-1, 0, 1].map((dx) =>
        medianColor(pixels, [cx + dx * step, cy + dy * step], radius / 3),
      ),
    )
    .filter((rgb): rgb is Rgb => rgb !== null);
  if (!patches.length) return [0, 0, 0];
  const features = patches.map(feature);
  const spread = (index: number) =>
    features.reduce((sum, f) => sum + distance(f, features[index]), 0);
  let best = 0;
  for (let i = 1; i < patches.length; i++)
    if (spread(i) < spread(best)) best = i;
  return patches[best];
}
