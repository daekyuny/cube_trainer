import { defaultHexagon, samplePoints } from '../../domain/scan/geometry';
import type { Hexagon } from '../../domain/scan/geometry';
import { sampleColor } from '../../domain/scan/sample';
import type { PhotoSamples } from '../../domain/scan/scan';

// A loaded photo, scaled down to at most 1280 px, with its fitted outline.
export type Photo = {
  url: string;
  width: number;
  height: number;
  pixels: ImageData;
  hexagon: Hexagon;
};

const LONGEST = 1280;

export async function loadPhoto(file: File): Promise<Photo> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  const scale = Math.min(
    1,
    LONGEST / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, width, height);
  return {
    url,
    width,
    height,
    pixels: context.getImageData(0, 0, width, height),
    hexagon: defaultHexagon(width, height),
  };
}

// The 27 visible stickers' colors, by facelet index as held.
export function readPhoto(photo: Photo): PhotoSamples {
  return new Map(
    samplePoints(photo.hexagon).map(({ facelet, point, radius }) => [
      facelet,
      sampleColor(photo.pixels, point, radius),
    ]),
  );
}
