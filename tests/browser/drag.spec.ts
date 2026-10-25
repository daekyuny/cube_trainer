import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const sticker = (page: Page, position: string, face: string) =>
  page
    .getByTestId('cube-front')
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
  const grab = await center(sticker(page, '1,0,1', 'F'));
  await drag(page, grab, 0, -40);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');
  expect(await page.getByTestId('cube-front').innerHTML()).toEqual(before);

  await drag(page, grab, 0, -260);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('R');
  await drag(page, await center(sticker(page, '0,1,1', 'U')), 260, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('RF');
  // The front face's bottom row sideways = D.
  await drag(page, await center(sticker(page, '0,-1,1', 'F')), 260, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('RFD');
  // Middle row sideways = E, middle column up = M′.
  const middle = await center(sticker(page, '0,0,1', 'F'));
  await drag(page, middle, 260, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('RFDE');
  await drag(page, middle, 0, -260);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText("RFDEM'");
  await expect(page.locator('.move-count')).toHaveText('5 moves');
  await page.getByRole('button', { name: '↶ 한 수 되돌리기' }).click();
  await expect(page.getByLabel('회전 이력')).toHaveText('RFDE');
});

test('DRAG-07: dragging outside the cube along the nearest face grid turns the whole cube', async ({
  page,
}) => {
  const svg = (await page.getByTestId('cube-front').boundingBox())!;
  // Beside the front face, and above the top face.
  const side = { x: svg.x + 8, y: svg.y + svg.height * 0.64 };
  const above = { x: svg.x + svg.width / 2, y: svg.y + 6 };
  await drag(page, side, 40, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');
  await drag(page, side, 320, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('←');
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 파랑/,
  );
  await drag(page, side, -320, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('←→');
  // Up beside the front tips the cube forward: x (white comes to the front).
  await drag(page, side, 0, -320);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('←→x');
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 흰색, R 초록, U 빨강/,
  );
  await expect(page.locator('.orientation-note')).toHaveText(
    '빨강 위 · 주황 아래',
  );
  // Sideways above the top face rolls the cube: z.
  await drag(page, above, 320, 0);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('←→xz');
  await expect(page.locator('.move-count')).toHaveText('0 moves');
  // A sticker drag follows the cube as it is now shown.
  await drag(page, await center(sticker(page, '1,0,1', 'F')), 0, -260);
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('←→xzR');
  await expect(page.locator('.live-badge')).toHaveText('자유롭게 연습 중');
});

test('DRAG-10: middle-layer and whole-cube keys and buttons', async ({
  page,
}) => {
  // The key listener is attached in an effect right after the first render.
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 빨강/,
  );
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
  await page.keyboard.press('m');
  await page.keyboard.press('Shift+E');
  await page.keyboard.press('s');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('z');
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText("ME'Sxz");
  await expect(page.locator('.move-count')).toHaveText('3 moves');
  await page
    .getByRole('button', { name: 'E 가로 중간 · D 방향 시계 방향 회전' })
    .click();
  await page
    .getByRole('button', { name: 'x 전체 · R 방향 시계 방향 회전' })
    .click();
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText("ME'SxzEx");
  for (let i = 0; i < 7; i++)
    await page.getByRole('button', { name: '↶ 한 수 되돌리기' }).click();
  await expect(page.locator('.live-badge')).toHaveText('여섯 면 완성');
  for (const button of await page.locator('.extra-move').all())
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
});

test('DRAG-08: a drag in a lesson follows the guide like a key press', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'F2L 페어링', exact: true }).click();
  const grab = await center(sticker(page, '1,0,1', 'F'));
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
  const grab = await center(sticker(page, '1,0,1', 'F'));
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
