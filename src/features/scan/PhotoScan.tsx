import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Color } from '../../domain/cube/cube';
import type { Palette } from '../../domain/scan/colors';
import { calibrateFromSolved, readCube, review } from '../../domain/scan/scan';
import type { PhotoSamples, ScanResult } from '../../domain/scan/scan';
import { ColorNet } from './ColorNet';
import { PhotoFit } from './PhotoFit';
import { loadPhoto, readPhoto } from './photo';
import type { Photo } from './photo';

const HOLDS = [
  '노랑이 위, 빨강이 왼쪽 앞(크게 보이는 면), 초록이 오른쪽에 오도록 들고 가까운 꼭짓점을 정면에서 찍습니다.',
  '큐브를 위아래로 뒤집어 흰색을 위로 하고, 파랑이 왼쪽 앞, 주황이 오른쪽에 오는 반대쪽 꼭짓점을 찍습니다.',
];

type Mode = 'scan' | 'calibrate';
type Reviewing = Extract<ScanResult, { ok: true }>;

// Two corner photos taken with the camera → fit the outline → read the
// colors. Only when a reading is unclear or impossible does the unfolded net
// ask the learner to confirm those faces. Calibration takes the same two
// photos of a solved cube and keeps how this cube's colors look here.
export function PhotoScan({
  busy,
  error,
  palette,
  onPalette,
  onColors,
  onCancel,
}: {
  busy: boolean;
  error: string | null;
  palette: Palette | null;
  onPalette: (palette: Palette | null) => void;
  onColors: (colors: Color[]) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<Mode>('scan');
  const [notice, setNotice] = useState('');
  const [step, setStep] = useState(0);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [first, setFirst] = useState<PhotoSamples | null>(null);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Reviewing | null>(null);

  // Photos are object URLs: release each one when it is replaced.
  useEffect(() => {
    const url = photo?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo?.url]);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setPhoto(await loadPhoto(file));
      setMessage('');
    } catch {
      setMessage('사진을 열 수 없습니다. 다른 사진을 골라 주세요.');
    }
  };
  const restart = (next: Mode) => {
    setMode(next);
    setStep(0);
    setFirst(null);
    setPhoto(null);
    setMessage('');
    setNotice('');
  };
  const read = () => {
    if (!photo) return;
    const samples = readPhoto(photo);
    if (step === 0) {
      setFirst(samples);
      setNotice('');
      setPhoto(null);
      setStep(1);
      return;
    }
    if (mode === 'calibrate') {
      const calibration = calibrateFromSolved([first!, samples]);
      if (!calibration.ok) {
        setMessage(calibration.message);
        return;
      }
      onPalette(calibration.palette);
      restart('scan');
      setNotice('색 보정을 저장했습니다. 이제 섞인 큐브를 찍으세요.');
      return;
    }
    const scan = readCube([first!, samples], palette ?? undefined);
    if (!scan.ok) {
      setMessage(scan.message);
      return;
    }
    if (!scan.unsureFacelets.length && !scan.problems.length) {
      onColors(scan.colors);
      return;
    }
    setPhoto(null);
    setResult(scan);
  };
  const edit = (facelet: number, color: Color) => {
    if (!result) return;
    const colors = result.colors.map((c, i) => (i === facelet ? color : c));
    // A sticker the learner has set is no longer unclear.
    const unclear = result.unclear.map((flag, i) => flag && i !== facelet);
    setResult(review(colors, unclear) as Reviewing);
  };

  if (result)
    return (
      <div className="photo-scan" data-testid="photo-scan" data-step="review">
        <p className="scan-instruction">
          <strong>색 확인</strong> 사진에서 구분하기 어려운 칸이 있습니다.
          테두리가 굵은 면을 눌러 ? 칸의 색을 실제 큐브와 맞춰 주세요.
        </p>
        <ColorNet
          colors={result.colors}
          unsure={result.unsure}
          unsureFacelets={result.unsureFacelets}
          onChange={edit}
        />
        {result.problems.length > 0 && (
          <ul className="scan-problems" data-testid="scan-problems">
            {[...new Set(result.problems.map((p) => p.message))].map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        )}
        {error && <p className="scan-error">{error}</p>}
        <div className="lesson-actions">
          <button
            className="primary-button"
            disabled={busy || result.problems.length > 0}
            onClick={() => onColors(result.colors)}
          >
            {busy ? '큐브 만드는 중…' : '이 색으로 풀이 보기'}
          </button>
          <button className="secondary-button" onClick={onCancel}>
            취소
          </button>
        </div>
      </div>
    );

  const calibrating = mode === 'calibrate';
  return (
    <div
      className="photo-scan"
      data-testid="photo-scan"
      data-step={step + 1}
      data-mode={mode}
    >
      <p className="scan-instruction">
        <strong>
          {calibrating ? '색 보정' : '사진'} {step + 1}/2
        </strong>{' '}
        {calibrating && '맞춘 큐브로 찍습니다. '}
        {HOLDS[step]}
      </p>
      {!photo && step === 0 && (
        <div className="scan-palette" data-testid="scan-palette">
          {calibrating ? (
            <>
              <span>
                맞춘 큐브의 두 꼭짓점을 찍으면 이 큐브·이 조명의 색을 기억해
                다음부터 더 정확히 읽습니다.
              </span>
              <button className="text-button" onClick={() => restart('scan')}>
                보정 그만두기
              </button>
            </>
          ) : (
            <>
              <span>색 기준: {palette ? '내 큐브로 보정함' : '기본값'}</span>
              <button
                className="text-button"
                onClick={() => restart('calibrate')}
              >
                맞춘 큐브로 색 보정
              </button>
              {palette && (
                <button
                  className="text-button"
                  onClick={() => {
                    onPalette(null);
                    setNotice('색 보정을 지웠습니다.');
                  }}
                >
                  보정 지우기
                </button>
              )}
            </>
          )}
        </div>
      )}
      {notice && (
        <p className="scan-notice" role="status">
          {notice}
        </p>
      )}
      {photo ? (
        <>
          <PhotoFit
            photo={photo}
            onChange={(hexagon) => setPhoto({ ...photo, hexagon })}
          />
          <p className="scan-hint">
            점 일곱 개를 큐브 꼭짓점에 맞추세요. 가운데 점은 세 면이 만나는
            가까운 꼭짓점이고, 틀 안쪽을 끌면 전체가 움직입니다.
          </p>
        </>
      ) : (
        <div className="scan-inputs">
          <label className="primary-button">
            사진 찍기
            <input
              className="visually-hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={choose}
            />
          </label>
        </div>
      )}
      {(message || error) && (
        <p className="scan-error" role="alert">
          {message || error}
        </p>
      )}
      <div className="lesson-actions">
        {photo && (
          <>
            <button className="primary-button" disabled={busy} onClick={read}>
              {busy ? '큐브 만드는 중…' : '이 위치로 색 읽기'}
            </button>
            <button className="secondary-button" onClick={() => setPhoto(null)}>
              다른 사진
            </button>
          </>
        )}
        <button className="secondary-button" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );
}
