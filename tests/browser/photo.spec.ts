import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { projectPoint } from '../../src/features/simulator/gesture.ts';
import { applyMoves, solvedCube } from '../../src/domain/cube/cube.ts';
import type { Vec3 } from '../../src/domain/cube/cube.ts';
import { homeFacelet } from '../../src/domain/solver/pieces.ts';
import { parseAlgorithm } from '../../src/domain/training/guide.ts';

// "Photos" are screenshots of the app's own cube drawing: the near corner
// view (U/F/R as held), the second one after z2 y shows D/L/B.
const status = (page: Page) => page.getByTestId('solver-status');
const scan = (page: Page) => page.getByTestId('photo-scan');
const E = 1.48;
const CORNERS: Vec3[] = [
  [E, E, E],
  [-E, E, -E],
  [E, E, -E],
  [E, -E, -E],
  [E, -E, E],
  [-E, -E, E],
  [-E, E, E],
];

async function openDemo(page: Page) {
  await page.getByRole('button', { name: '풀이 데모', exact: true }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  });
}

// A screenshot of the cube drawing and where its seven outline corners are
// in that picture's pixels.
async function takePhoto(page: Page) {
  const cube = page.getByTestId('cube-front');
  const box = (await cube.boundingBox())!;
  const scale = Math.min(box.width / 380, box.height / 355);
  const offset = [
    (box.width - 380 * scale) / 2,
    (box.height - 355 * scale) / 2,
  ];
  const buffer = await cube.screenshot();
  const corners = CORNERS.map((point) => {
    const [x, y] = projectPoint(point, false);
    return [offset[0] + x * scale, offset[1] + y * scale] as const;
  });
  return { buffer, corners, width: box.width, height: box.height };
}

async function upload(
  page: Page,
  photo: Awaited<ReturnType<typeof takePhoto>>,
) {
  await scan(page).getByLabel('사진 찍기').setInputFiles({
    name: 'cube.png',
    mimeType: 'image/png',
    buffer: photo.buffer,
  });
  const fit = page.getByTestId('photo-fit');
  await expect(fit).toBeVisible();
  const rect = (await fit.boundingBox())!;
  // Drag each handle from where it is onto the cube's corner.
  for (const [handle, [x, y]] of photo.corners.entries()) {
    const dot = fit.locator(`[data-handle="${handle}"] .fit-dot`);
    const from = (await dot.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      rect.x + (x / photo.width) * rect.width,
      rect.y + (y / photo.height) * rect.height,
      { steps: 4 },
    );
    await page.mouse.up();
  }
}

// The unfolded net's facelet (standard order) of the sticker seen at
// `position`/`normal` when the cube is held turned by `held`.
function netFacelet(held: string, position: Vec3, normal: Vec3): number {
  const turned = applyMoves(solvedCube(), parseAlgorithm(held));
  const same = (a: Vec3, b: Vec3) => a.every((v, i) => v === b[i]);
  const sticker = turned.find(
    (s) => same(s.position, position) && same(s.normal, normal),
  )!;
  return homeFacelet(sticker.id);
}

// From one color toward another in HSV (hue the short way round), as hex.
function towards(from: string, to: string, t: number): string {
  const rgb = (hex: string) =>
    [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const toHsv = ([r, g, b]: number[]) => {
    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);
    const h = !d
      ? 0
      : max === r
        ? ((g - b) / d + 6) % 6
        : max === g
          ? (b - r) / d + 2
          : (r - g) / d + 4;
    return [h * 60, max ? d / max : 0, max];
  };
  const [h1, s1, v1] = toHsv(rgb(from));
  const [h2, s2, v2] = toHsv(rgb(to));
  // A gray has no hue of its own: keep the other color's.
  const start = s1 < 0.1 ? h2 : h1;
  const end = s2 < 0.1 ? h1 : h2;
  const turn = ((end - start + 540) % 360) - 180;
  const h = (start + turn * t + 360) % 360;
  const sat = s1 + (s2 - s1) * t;
  const v = v1 + (v2 - v1) * t;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * sat * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)]
    .map((c) =>
      Math.round(c * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

test.describe.configure({ timeout: 90000 });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await openDemo(page);
});

test('PHOTO-01: two corner photos rebuild the same cube, and its solution solves it', async ({
  page,
}) => {
  const shown = await page.getByTestId('cube-front').innerHTML();
  const first = await takePhoto(page);
  for (const key of ['z', 'z', 'y']) await page.keyboard.press(key);
  const second = await takePhoto(page);

  await page.getByRole('button', { name: '사진으로 입력' }).click();
  await expect(scan(page)).toHaveAttribute('data-step', '1');
  await expect(scan(page).getByLabel('사진 찍기')).toHaveAttribute(
    'capture',
    'environment',
  );
  await upload(page, first);
  await page.getByRole('button', { name: '이 위치로 색 읽기' }).click();
  await expect(scan(page)).toHaveAttribute('data-step', '2');
  await upload(page, second);
  await page.getByRole('button', { name: '이 위치로 색 읽기' }).click();

  // Clear colors need no confirmation: the demo starts from the photo.
  await expect(scan(page)).toHaveCount(0, { timeout: 30000 });
  await expect(status(page)).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  });
  await expect(page.locator('.scramble-detail summary')).toContainText(
    '사진 입력',
  );
  expect(await page.getByTestId('cube-front').innerHTML()).toEqual(shown);
  await page.getByRole('button', { name: '▶ 전체 재생' }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'complete', {
    timeout: 30000,
  });
});

test('PHOTO-02: an unclear sticker opens the net on its face for confirmation', async ({
  page,
}) => {
  const shown = await page.getByTestId('cube-front').innerHTML();
  const first = await takePhoto(page);
  for (const key of ['z', 'z', 'y']) await page.keyboard.press(key);
  // Repaint one top edge sticker (D as held) halfway between its color and
  // the one it lies nearest to, as the reader sees colors (hue, saturation,
  // brightness).
  const sticker = page
    .getByTestId('cube-front')
    .locator('g[data-position="1,1,0"][data-face="U"] polygon')
    .nth(1);
  const original = (await sticker.getAttribute('fill'))!;
  const partner: Record<string, string> = {
    '#e74453': '#fb9143',
    '#fb9143': '#f6d64b',
    '#f7f8f3': '#f6d64b',
    '#f6d64b': '#fb9143',
    '#4284e5': '#26ad77',
    '#26ad77': '#4284e5',
  };
  const mixed = towards(original, partner[original], 0.5);
  await sticker.evaluate((node, fill) => {
    node.setAttribute('fill', fill);
    node.setAttribute('stroke', fill);
  }, mixed);
  const second = await takePhoto(page);
  // Undo the repaint: React would keep it where the drawn color is unchanged.
  await sticker.evaluate((node, fill) => {
    node.setAttribute('fill', fill);
    node.setAttribute('stroke', fill);
  }, original);

  await page.getByRole('button', { name: '사진으로 입력' }).click();
  await upload(page, first);
  await page.getByRole('button', { name: '이 위치로 색 읽기' }).click();
  await upload(page, second);
  await page.getByRole('button', { name: '이 위치로 색 읽기' }).click();

  await expect(scan(page)).toHaveAttribute('data-step', 'review');
  // The repainted sticker (held U face, front-right edge after z2 y) sits on
  // this facelet of the unfolded net; its face is marked for confirmation.
  const repainted = netFacelet('z2 y', [1, 1, 0], [0, 1, 0]);
  await expect(page.locator('.net-face[data-face="D"]')).toHaveAttribute(
    'data-unsure',
    'true',
  );
  const names: Record<string, string> = {
    '#e74453': '빨강',
    '#26ad77': '초록',
    '#f6d64b': '노랑',
    '#f7f8f3': '흰색',
    '#4284e5': '파랑',
    '#fb9143': '주황',
  };
  const paint = async (face: string, facelet: number, color: string) => {
    await page.locator(`.net-face[data-face="${face}"]`).click();
    await page.locator(`.net-editor-grid [data-facelet="${facelet}"]`).click();
    await page
      .getByRole('group', { name: '칸 색 고르기' })
      .getByRole('button', { name: color })
      .click();
  };
  await page.locator('.net-face[data-face="D"]').click();
  await expect(
    page.locator(`.net-editor-grid [data-facelet="${repainted}"]`),
  ).toHaveAttribute('data-unclear', 'true');
  await paint('D', repainted, names[original]);
  // Had the reader given it the other color, a sticker of that color was
  // pushed out to make room (shown in the original color, marked): put it
  // back. Other marked stickers were read right and stay as they are.
  const confirm = page.getByRole('button', { name: '이 색으로 풀이 보기' });
  if (await confirm.isDisabled())
    for (const face of await page
      .locator('.net-face[data-unsure="true"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-face')!))) {
      await page.locator(`.net-face[data-face="${face}"]`).click();
      for (const button of await page
        .locator('.net-editor-grid button[data-unclear="true"]')
        .all()) {
        const facelet = Number(await button.getAttribute('data-facelet'));
        // The label reads "3번 칸 노랑": the color is the third word.
        const shown = (await button.getAttribute('aria-label'))!.split(' ')[2];
        if (facelet !== repainted && shown === names[original])
          await paint(face, facelet, names[partner[original]]);
      }
    }
  await page.getByRole('button', { name: '이 색으로 풀이 보기' }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  });
  // The rebuilt cube is shown upright again, as before the z2 y.
  expect(await page.getByTestId('cube-front').innerHTML()).toEqual(shown);
});

test('PHOTO-03: the same corner twice is refused with a hint', async ({
  page,
}) => {
  const first = await takePhoto(page);
  await page.getByRole('button', { name: '사진으로 입력' }).click();
  await upload(page, first);
  await page.getByRole('button', { name: '이 위치로 색 읽기' }).click();
  await upload(page, first);
  await page.getByRole('button', { name: '이 위치로 색 읽기' }).click();
  await expect(scan(page).getByRole('alert')).toContainText('같은 면');
  await page.getByRole('button', { name: '취소' }).click();
  await expect(scan(page)).toHaveCount(0);
  await expect(status(page)).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  });
});

test('PHOTO-04: a solved cube calibrates the colors, kept in this browser until cleared', async ({
  page,
}) => {
  // The demo always scrambles: photograph the solved cube of the first page.
  await page.goto('./');
  const first = await takePhoto(page);
  for (const key of ['z', 'z', 'y']) await page.keyboard.press(key);
  const second = await takePhoto(page);
  await openDemo(page);
  await page.getByRole('button', { name: '사진으로 입력' }).click();
  const palette = page.getByTestId('scan-palette');
  await expect(palette).toContainText('기본값');
  await expect(scan(page).getByLabel('사진 업로드')).toHaveCount(0);
  // The info button opens and closes the explanation.
  const info = palette.getByRole('button', { name: '색 보정 설명' });
  await expect(info).toHaveAttribute('aria-expanded', 'false');
  await info.click();
  await expect(page.locator('#calibration-help')).toContainText(
    '브라우저에만 저장',
  );
  await info.click();
  await expect(page.locator('#calibration-help')).toHaveCount(0);
  for (const button of await palette.getByRole('button').all())
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await palette.getByRole('button', { name: '맞춘 큐브로 색 보정' }).click();
  await expect(scan(page)).toHaveAttribute('data-mode', 'calibrate');
  await upload(page, first);
  await page.getByRole('button', { name: '이 위치로 색 읽기' }).click();
  await upload(page, second);
  await page.getByRole('button', { name: '이 위치로 색 읽기' }).click();
  await expect(scan(page)).toHaveAttribute('data-mode', 'scan');
  await expect(scan(page).getByRole('status')).toContainText('색 보정을 저장');
  await expect(palette).toContainText('내 큐브로 보정함');

  await page.reload();
  await openDemo(page);
  await page.getByRole('button', { name: '사진으로 입력' }).click();
  await expect(palette).toContainText('내 큐브로 보정함');
  await palette.getByRole('button', { name: '보정 지우기' }).click();
  await expect(palette).toContainText('기본값');
});
