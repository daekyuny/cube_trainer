import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const sticker = (
  page: Page,
  view: 'front' | 'back',
  position: string,
  face: string,
) =>
  page
    .getByTestId(`cube-${view}`)
    .locator(`[data-position="${position}"][data-face="${face}"]`);

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function drag(
  page: Page,
  from: { x: number; y: number },
  dx: number,
  dy: number,
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 12 });
  await page.mouse.up();
}

const idle = (page: Page) =>
  Promise.all([
    expect(page.getByTestId('cube-stage')).toHaveAttribute(
      'data-busy',
      'false',
    ),
    expect(page.getByTestId('cube-stage')).toHaveAttribute(
      'data-dragging',
      'false',
    ),
  ]);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
});

test('DRAG-06: dragging a sticker past half a turn commits; a short drag springs back', async ({
  page,
}) => {
  const before = await page.getByTestId('cube-front').innerHTML();
  const grab = await center(sticker(page, 'front', '1,0,1', 'F'));
  await drag(page, grab, 0, -40);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');
  expect(await page.getByTestId('cube-front').innerHTML()).toEqual(before);

  await drag(page, grab, 0, -260);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('R');
  await drag(page, await center(sticker(page, 'front', '0,1,1', 'U')), 260, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('RF');
  // The flipped view turns D from its top (white) row.
  await drag(
    page,
    await center(sticker(page, 'back', '0,-1,-1', 'B')),
    -200,
    0,
  );
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('RFD');
  // A middle layer has no turn: nothing moves.
  await drag(page, await center(sticker(page, 'front', '0,0,1', 'F')), 260, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('RFD');
  await page.getByRole('button', { name: '↶ 한 수 되돌리기' }).click();
  await expect(page.getByLabel('회전 이력')).toHaveText('RF');
});

test('DRAG-07: dragging outside the cube spins the whole cube like the yaw keys', async ({
  page,
}) => {
  const svg = (await page.getByTestId('cube-front').boundingBox())!;
  const blank = { x: svg.x + 8, y: svg.y + 8 };
  await drag(page, blank, 60, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');
  await drag(page, blank, 320, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('←');
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 파랑/,
  );
  await drag(page, blank, -320, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('←→');
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 빨강, R 초록/,
  );
  // After spinning, a sticker drag follows the cube as it is now shown.
  await drag(page, blank, 320, 0);
  await idle(page);
  await drag(page, await center(sticker(page, 'front', '1,0,1', 'F')), 0, -260);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('←→←R');
  await expect(page.locator('.move-count')).toHaveText('1 moves');
});

test('DRAG-08: a drag in a lesson follows the guide like a key press', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'F2L 페어링', exact: true }).click();
  const grab = await center(sticker(page, 'front', '1,0,1', 'F'));
  await drag(page, grab, 0, -260);
  await idle(page);
  await expect(
    page.getByRole('button', { name: '1수 R까지 이동' }),
  ).toHaveAttribute('aria-current', 'step');
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'pair-cross-broken',
  );
});

test('DRAG-09: touch drag on a 390px screen turns a layer without scrolling', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    baseURL: test.info().project.use.baseURL,
  });
  const page = await context.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  const grab = await center(sticker(page, 'front', '1,0,1', 'F'));
  const cdp = await context.newCDPSession(page);
  const touch = (type: string, x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
    } as never);
  const scrollBefore = await page.evaluate(() => scrollY);
  await touch('touchStart', grab.x, grab.y);
  for (let step = 1; step <= 10; step++)
    await touch('touchMove', grab.x, grab.y - step * 12);
  await touch('touchEnd', grab.x, grab.y - 120);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('R');
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  await context.close();
});
