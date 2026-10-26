import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const status = (page: Page) => page.getByTestId('solver-status');
const stages = (page: Page) => page.getByRole('list', { name: '풀이 단계' });
const badge = (page: Page) => page.locator('.live-badge');
const moves = async (page: Page) =>
  Number((await page.locator('.move-count').textContent())!.split(' ')[0]);

async function openDemo(page: Page) {
  await page.getByRole('button', { name: '풀이 데모', exact: true }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  });
}

// The two-phase search runs in a worker and may take a few seconds under load.
test.describe.configure({ timeout: 60000 });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
});

test('SOLVE-01: the demo scrambles a cube and lists the six CFOP stages', async ({
  page,
}) => {
  await openDemo(page);
  await expect(
    page.getByRole('button', { name: '풀이 데모', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(badge(page)).not.toHaveText('여섯 면 완성');
  const scramble = page.getByTestId('scramble-moves');
  expect((await scramble.textContent())!.split(' ')).toHaveLength(25);
  await expect(stages(page).locator('.stage-row strong')).toHaveText([
    '십자',
    'F2L',
    'OLL 1단계',
    'OLL 2단계',
    'PLL 1단계',
    'PLL 2단계',
  ]);
  await expect(
    page.getByRole('button', { name: /CFOP 6단계/ }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: /CFOP 6단계/ })).toContainText(
    /\d+수/,
  );
  // A new scramble is a new start.
  const before = (await scramble.textContent())!;
  await page.getByRole('button', { name: '랜덤 섞기' }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  });
  await expect(scramble).not.toHaveText(before);
});

test('SOLVE-02: playing the whole CFOP solution solves the cube', async ({
  page,
}) => {
  await openDemo(page);
  await page.getByRole('button', { name: '▶ 전체 재생' }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'complete', {
    timeout: 30000,
  });
  await expect(badge(page)).toHaveText('여섯 면 완성');
  await expect(stages(page).locator('li[data-state="todo"]')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '▶ 전체 재생' }),
  ).toBeDisabled();
  // Back to the start at once.
  await page.getByRole('button', { name: '처음으로' }).click();
  await expect(badge(page)).not.toHaveText('여섯 면 완성');
  expect(await moves(page)).toBe(0);
});

test('SOLVE-03: a stage row jumps to its start and plays only that stage', async ({
  page,
}) => {
  await openDemo(page);
  const pll = stages(page).locator('li[data-stage="pll-corners"]');
  // PLL 1 can be skipped when the corners happen to be in place already.
  const target =
    (await pll.getAttribute('data-state')) === 'skipped'
      ? stages(page).locator('li[data-stage="oll-corners"]')
      : pll;
  await target.locator('.stage-row').click();
  await expect(target).toHaveAttribute('data-state', 'current');
  await expect(badge(page)).toHaveText('1·2층 완성');
  await expect(stages(page).locator('li[data-stage="f2l"]')).toHaveAttribute(
    'data-state',
    'done',
  );
  await target.getByRole('button', { name: '이 단계 재생' }).click();
  await expect(target).toHaveAttribute('data-state', 'done', {
    timeout: 30000,
  });
  await expect(status(page)).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  });
});

test('SOLVE-04: the nearly optimal answer takes at most 21 turns and solves the cube', async ({
  page,
}) => {
  await openDemo(page);
  const optimal = page
    .getByRole('group', { name: '풀이 방법' })
    .getByRole('button', { name: /거의 최적/ });
  await optimal.click();
  await expect(optimal).toHaveAttribute('aria-pressed', 'true');
  await expect(status(page)).toHaveAttribute('data-status', 'ready', {
    timeout: 30000,
  });
  const count = Number((await optimal.textContent())!.match(/(\d+)수/)![1]);
  expect(count).toBeLessThanOrEqual(21);
  await expect(stages(page).locator('.stage-row strong')).toHaveText([
    '거의 최적 해법',
  ]);
  await page.getByRole('button', { name: '▶ 전체 재생' }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'complete', {
    timeout: 30000,
  });
  // The move counter counts quarter turns (a U2 is played as U U).
  expect(await moves(page)).toBeGreaterThanOrEqual(count);
  await expect(badge(page)).toHaveText('여섯 면 완성');
});

test('SOLVE-05: playback speed changes the pace, and pause stops after the current turn', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await openDemo(page);
  const advance = async (speed: string) => {
    const restart = page.getByRole('button', { name: '처음으로' });
    if (await restart.isEnabled()) await restart.click();
    await page.getByRole('button', { name: speed, exact: true }).click();
    await expect(
      page.getByRole('button', { name: speed, exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '▶ 전체 재생' }).click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: '❚❚ 멈춤' }).click();
    await expect(
      page.getByRole('button', { name: '▶ 전체 재생' }),
    ).toBeEnabled();
    return moves(page);
  };
  const slow = await advance('0.5×');
  const fast = await advance('4×');
  expect(fast).toBeGreaterThan(slow);
  await expect(status(page)).not.toHaveAttribute('data-status', 'complete');
});

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
])
  test(`SOLVE-06: ${viewport.width}px demo controls fit without overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openDemo(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await page
      .locator('.solver-panel button:visible')
      .all())
      expect(
        (await button.boundingBox())!.height,
        await button.evaluate((node) => node.outerHTML.slice(0, 80)),
      ).toBeGreaterThanOrEqual(44);
  });
