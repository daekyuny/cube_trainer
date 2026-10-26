import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { Color } from '../../domain/cube/cube';
import { review, readCube } from '../../domain/scan/scan';
import type { PhotoSamples, ScanResult } from '../../domain/scan/scan';
import { ColorNet } from './ColorNet';
import { PhotoFit } from './PhotoFit';
import { loadPhoto, readPhoto } from './photo';
import type { Photo } from './photo';

const SHOTS = [
  {
    title: '사진 1/2',
    text: '노랑이 위, 빨강이 왼쪽 앞(크게 보이는 면), 초록이 오른쪽에 오도록 들고 가까운 꼭짓점을 정면에서 찍습니다.',
  },
  {
    title: '사진 2/2',
    text: '큐브를 위아래로 뒤집어 흰색을 위로 하고, 반대쪽 꼭짓점(파랑·주황)이 보이게 찍습니다.',
  },
];

type Reviewing = Extract<ScanResult, { ok: true }>;

// Two corner photos (taken now or picked from the album) → fit the outline
// → read the colors. Only when a reading is unclear or impossible does the
// unfolded net ask the learner to confirm those faces.
export function PhotoScan({
  busy,
  error,
  onColors,
  onCancel,
}: {
  busy: boolean;
  error: string | null;
  onColors: (colors: Color[]) => void;
  onCancel: () => void;
}) {
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
  const read = () => {
    if (!photo) return;
    const samples = readPhoto(photo);
    if (step === 0) {
      setFirst(samples);
      setPhoto(null);
      setStep(1);
      return;
    }
    const scan = readCube([first!, samples]);
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

  const shot = SHOTS[step];
  return (
    <div className="photo-scan" data-testid="photo-scan" data-step={step + 1}>
      <p className="scan-instruction">
        <strong>{shot.title}</strong> {shot.text}
      </p>
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
          <label className="secondary-button">
            사진 업로드
            <input
              className="visually-hidden"
              type="file"
              accept="image/*"
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
