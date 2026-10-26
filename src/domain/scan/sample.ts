import type { Rgb } from './colors.ts';
import type { Point } from './geometry.ts';

export type Pixels = {
  width: number;
  height: number;
  data: ArrayLike<number>;
};

// The median color in a small disc: robust to a glare spot or a dark gap
// edge caught by the disc.
export function sampleColor(
  pixels: Pixels,
  [cx, cy]: Point,
  radius: number,
): Rgb {
  const channels: number[][] = [[], [], []];
  const r = Math.max(1, radius);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || y < 0 || x >= pixels.width || y >= pixels.height) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const offset = (y * pixels.width + x) * 4;
      for (let k = 0; k < 3; k++) channels[k].push(pixels.data[offset + k]);
    }
  return channels.map((values) => {
    if (!values.length) return 0;
    values.sort((a, b) => a - b);
    return values[values.length >> 1];
  }) as unknown as Rgb;
}
