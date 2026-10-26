import { useState } from 'react';
import { COLOR_NAMES, COLORS } from '../../domain/cube/cube';
import type { Color, Face } from '../../domain/cube/cube';
import { SCAN_COLORS } from '../../domain/scan/colors';
import { FACELET_FACES } from '../../domain/solver/facelets';

// The unfolded cube: U above F, then L F R B in a row, D below F.
const LAYOUT: { face: Face; row: number; col: number }[] = [
  { face: 'U', row: 1, col: 2 },
  { face: 'L', row: 2, col: 1 },
  { face: 'F', row: 2, col: 2 },
  { face: 'R', row: 2, col: 3 },
  { face: 'B', row: 2, col: 4 },
  { face: 'D', row: 3, col: 2 },
];
const FACE_NAMES: Record<Face, string> = {
  U: '위',
  D: '아래',
  F: '앞',
  B: '뒤',
  L: '왼쪽',
  R: '오른쪽',
};

// Confirm or correct the colors read. The net shows all six faces with the
// unsure ones outlined; a face opens large below it, where a sticker is
// tapped and then its color. Centers are fixed.
export function ColorNet({
  colors,
  unsure,
  unsureFacelets,
  onChange,
}: {
  colors: readonly Color[];
  unsure: readonly Face[];
  unsureFacelets: readonly number[];
  onChange: (facelet: number, color: Color) => void;
}) {
  const [open, setOpen] = useState<Face>(unsure[0] ?? 'F');
  const [selected, setSelected] = useState<number | null>(null);
  const base = FACELET_FACES.indexOf(open) * 9;
  const stickers = (face: Face) =>
    Array.from(
      { length: 9 },
      (_, offset) => FACELET_FACES.indexOf(face) * 9 + offset,
    );

  return (
    <div className="color-net-wrap">
      <div className="color-net" role="group" aria-label="여섯 면 전개도">
        {LAYOUT.map(({ face, row, col }) => (
          <button
            key={face}
            className="net-face"
            data-face={face}
            data-unsure={unsure.includes(face)}
            aria-pressed={open === face}
            aria-label={`${FACE_NAMES[face]} 면${unsure.includes(face) ? ' · 확인 필요' : ''}`}
            style={{ gridRow: row, gridColumn: col }}
            onClick={() => {
              setOpen(face);
              setSelected(null);
            }}
          >
            {stickers(face).map((facelet) => (
              <i
                key={facelet}
                style={{ background: COLORS[colors[facelet]] }}
                data-unclear={unsureFacelets.includes(facelet)}
              />
            ))}
          </button>
        ))}
      </div>
      <div className="net-editor" data-testid="net-editor">
        <strong>
          {FACE_NAMES[open]} 면
          {unsure.includes(open) && <span> · 표시된 칸을 확인하세요</span>}
        </strong>
        <div
          className="net-editor-grid"
          role="group"
          aria-label={`${FACE_NAMES[open]} 면 칸`}
        >
          {stickers(open).map((facelet) => {
            const center = facelet === base + 4;
            return (
              <button
                key={facelet}
                style={{ background: COLORS[colors[facelet]] }}
                data-facelet={facelet}
                data-unclear={unsureFacelets.includes(facelet)}
                aria-pressed={selected === facelet}
                disabled={center}
                aria-label={`${facelet - base + 1}번 칸 ${COLOR_NAMES[colors[facelet]]}${center ? ' (센터)' : ''}`}
                onClick={() =>
                  setSelected(selected === facelet ? null : facelet)
                }
              >
                {center ? open : unsureFacelets.includes(facelet) ? '?' : ''}
              </button>
            );
          })}
        </div>
        {selected !== null && (
          <div className="net-palette" role="group" aria-label="칸 색 고르기">
            {SCAN_COLORS.map((color) => (
              <button
                key={color}
                style={{ background: COLORS[color] }}
                aria-pressed={colors[selected] === color}
                onClick={() => {
                  onChange(selected, color);
                  setSelected(null);
                }}
              >
                {COLOR_NAMES[color]}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
