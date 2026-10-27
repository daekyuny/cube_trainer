import { SCAN_COLORS } from '../../domain/scan/colors';
import type { Palette } from '../../domain/scan/colors';

// A calibration from the learner's own cube, kept in this browser only.
// Storage can be missing or blocked (private mode): then nothing is kept.
const KEY = 'cube-trainer.scan-palette.v1';

export function loadPalette(): Palette | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    const valid =
      typeof value === 'object' &&
      value !== null &&
      SCAN_COLORS.every((color) => {
        const entry = (value as Record<string, unknown>)[color];
        return (
          Array.isArray(entry) &&
          entry.length === 3 &&
          entry.every((n) => typeof n === 'number' && Number.isFinite(n))
        );
      });
    return valid ? (value as Palette) : null;
  } catch {
    return null;
  }
}

export function savePalette(palette: Palette | null): void {
  try {
    if (palette) localStorage.setItem(KEY, JSON.stringify(palette));
    else localStorage.removeItem(KEY);
  } catch {
    // Not kept; the calibration still applies until the page is reloaded.
  }
}
