import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { projectPoint } from '../../src/features/simulator/gesture.ts';
import type { Vec3 } from '../../src/domain/cube/cube.ts';

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
  await scan(page).getByLabel('사진 업로드').setInputFiles({
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
  // the one it is most easily mistaken for.
  const sticker = page
    .getByTestId('cube-front')
    .locator('g[data-position="1,1,0"][data-face="U"] polygon')
    .nth(1);
  const original = (await sticker.getAttribute('fill'))!;
  const partner: Record<string, string> = {
    '#e74453': '#fb9143',
    '#fb9143': '#e74453',
    '#f7f8f3': '#f6d64b',
    '#f6d64b': '#f7f8f3',
    '#4284e5': '#26ad77',
    '#26ad77': '#4284e5',
  };
  const mixed = `#${[1, 3, 5]
    .map((i) =>
      Math.round(
        (parseInt(original.slice(i, i + 2), 16) +
          parseInt(partner[original].slice(i, i + 2), 16)) /
          2,
      )
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
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
  const unsure = page.locator('.net-face[data-unsure="true"]');
  await expect(unsure).toHaveCount(1);
  await expect(unsure).toHaveAttribute('data-face', 'D');
  // The unsure face is open; set its marked sticker to the real color.
  const marked = page.locator('.net-editor-grid button[data-unclear="true"]');
  await expect(marked).toHaveCount(1);
  await marked.click();
  const names: Record<string, string> = {
    '#e74453': '빨강',
    '#26ad77': '초록',
    '#f6d64b': '노랑',
    '#f7f8f3': '흰색',
    '#4284e5': '파랑',
    '#fb9143': '주황',
  };
  await page
    .getByRole('group', { name: '칸 색 고르기' })
    .getByRole('button', { name: names[original] })
    .click();
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
