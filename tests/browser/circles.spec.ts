import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const graph = (page: Page) => page.getByTestId('cube-circles');
// Each sticker's dot centre, in sticker order.
const dots = (page: Page) =>
  graph(page)
    .locator('.sticker-dot')
    .evaluateAll((nodes) =>
      nodes.map((n) =>
        ['cx', 'cy'].map((k) => Number(n.getAttribute(k)).toFixed(2)).join(),
      ),
    );
const activeRings = (page: Page) =>
  graph(page)
    .locator('[data-active]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-ring')));
const idle = (page: Page) =>
  expect(page.getByTestId('cube-stage')).toHaveAttribute('data-busy', 'false');

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('./');
  // The key listener is attached in an effect right after the first render.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(resolve)),
  );
});

test('CIRCLE-01: the circle graph replaces the flipped cube and shows all six faces', async ({
  page,
}) => {
  await expect(page.getByTestId('cube-back')).toHaveCount(0);
  await expect(graph(page)).toHaveAttribute(
    'aria-label',
    '원 그래프: U 노랑, F 빨강, R 초록, B 주황, L 파랑, D 흰색',
  );
  await expect(graph(page).locator('.ring')).toHaveCount(9);
  await expect(graph(page).locator('.sticker-dot')).toHaveCount(54);
  await expect(graph(page).getByTestId('circle-move')).toHaveCount(0);
});

test('CIRCLE-02: a turn highlights its ring, shows the symbol and slides the dots', async ({
  page,
}) => {
  await page.getByLabel('천천히 돌려 보기').check();
  const before = await dots(page);
  await page.keyboard.press('r');
  await expect(graph(page)).toHaveAttribute('data-turning', 'R');
  expect(await activeRings(page)).toEqual(['0:1']);
  await expect(graph(page).locator('.ring-arrow')).toHaveCount(1);
  await expect(graph(page).getByTestId('circle-move')).toHaveText('R');
  await expect(graph(page).getByTestId('circle-move')).toHaveClass(/is-active/);
  await expect.poll(() => dots(page)).not.toEqual(before);
  await idle(page);
  // Done: no highlight, the last symbol stays faintly, and the stickers sit
  // on the same spots as before but moved to other ones.
  await expect(graph(page)).not.toHaveAttribute('data-turning', /.*/);
  expect(await activeRings(page)).toEqual([]);
  await expect(graph(page).getByTestId('circle-move')).toHaveText('R');
  await expect(graph(page).getByTestId('circle-move')).not.toHaveClass(
    /is-active/,
  );
  const after = await dots(page);
  expect(after).not.toEqual(before);
  expect([...after].sort()).toEqual([...before].sort());

  await page.keyboard.press('Shift+m');
  await expect(graph(page)).toHaveAttribute('data-turning', 'M′');
  expect(await activeRings(page)).toEqual(['0:0']);
  await idle(page);
  await page.keyboard.press('x');
  await expect(graph(page)).toHaveAttribute('data-turning', 'x');
  expect((await activeRings(page)).sort()).toEqual(['0:-1', '0:0', '0:1']);
  await idle(page);
  await page.keyboard.press('ArrowRight');
  await expect(graph(page)).toHaveAttribute('data-turning', 'y');
  await idle(page);
  await expect(graph(page).getByTestId('circle-move')).toHaveText('y');
  await expect(page.getByLabel('회전 이력')).toHaveText("RM'x→");
});

test('CIRCLE-03: only the main cube takes drags; the graph follows a drag preview', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const box = (await graph(page).boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  for (const [dx, dy] of [
    [200, 0],
    [0, -200],
  ]) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 10 });
    await page.mouse.up();
  }
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');

  const sticker = (await page
    .getByTestId('cube-front')
    .locator('[data-position="1,0,1"][data-face="F"]')
    .boundingBox())!;
  const grab = {
    x: sticker.x + sticker.width / 2,
    y: sticker.y + sticker.height / 2,
  };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x, grab.y - 60, { steps: 6 });
  await expect(graph(page)).toHaveAttribute('data-turning', 'R');
  expect(await activeRings(page)).toEqual(['0:1']);
  await page.mouse.move(grab.x, grab.y - 260, { steps: 6 });
  await page.mouse.up();
  await idle(page);
  await expect(page.getByLabel('회전 이력')).toHaveText('R');
  await expect(graph(page).getByTestId('circle-move')).toHaveText('R');
});
