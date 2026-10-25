import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const stages = (page: Page) => page.getByRole('group', { name: '연습 단계' });
const status = (page: Page) => page.getByTestId('lesson-status');
const guide = (page: Page) => page.getByTestId('practice-guide');

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
});

test('PRACTICE-05: stage practice replaces free practice and presets', async ({
  page,
}) => {
  await expect(
    page.getByRole('button', { name: '단계별 연습', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.getByRole('button', { name: '자유 연습', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: /프리셋/ })).toHaveCount(0);
  await expect(stages(page).getByRole('button')).toHaveText([
    /F2L 페어링/,
    /OLL 1단계/,
    /OLL 2단계/,
    /PLL 1단계/,
    /PLL 2단계/,
  ]);
  await expect(page.locator('.live-badge')).toHaveText('여섯 면 완성');
});

for (const stage of [
  'F2L 페어링',
  'OLL 1단계',
  'OLL 2단계',
  'PLL 1단계',
  'PLL 2단계',
])
  test(`PRACTICE-06: ${stage} — hidden answer, reveal, demonstrate, new start hides again`, async ({
    page,
  }) => {
    const button = stages(page).getByRole('button', {
      name: new RegExp(stage),
    });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(status(page)).not.toHaveAttribute('data-status', 'complete');
    await expect(guide(page)).toHaveCount(0);
    const start = await page.getByTestId('cube-front').innerHTML();

    await page.getByRole('button', { name: '풀이 보기' }).click();
    await expect(guide(page)).toContainText('케이스');
    await page.getByRole('button', { name: '전체 시연' }).click();
    await expect(status(page)).toHaveAttribute('data-status', 'complete');
    await expect(
      page.getByRole('button', { name: '전체 시연' }),
    ).toBeDisabled();

    // Same start again keeps the answer open; a new start hides it.
    await page.getByRole('button', { name: '같은 배치 다시' }).click();
    expect(await page.getByTestId('cube-front').innerHTML()).toEqual(start);
    await expect(guide(page)).toBeVisible();
    await page.getByRole('button', { name: '새 배치' }).click();
    await expect(guide(page)).toHaveCount(0);
    await expect(status(page)).not.toHaveAttribute('data-status', 'complete');
  });

test('PRACTICE-07: F2L practice marks the random pair and judges it like the lesson', async ({
  page,
}) => {
  await stages(page).getByRole('button', { name: /F2L/ }).click();
  const target = await status(page).textContent();
  expect(target).toMatch(
    /^R·([GB])·W 코너와 R·\1 엣지를 Y층에서 붙여 보세요\.$/,
  );
  const letter = target!.match(/R·([GB])/)![1];
  const labels = await page
    .getByTestId('cube-front')
    .locator('text')
    .allTextContents();
  expect(labels.length).toBeGreaterThan(0);
  for (const text of labels) expect(['W', 'R', letter]).toContain(text);
  await expect(
    page.getByTestId('cube-circles').locator('.sticker-dot.is-target'),
  ).toHaveCount(5);
  await page.getByRole('button', { name: '풀이 보기' }).click();
  await page.getByRole('button', { name: '전체 시연' }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'complete');
  await expect(page.locator('.live-badge')).toHaveText(
    '페어 완성 · 십자·세 슬롯 유지',
  );
});

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
])
  test(`PRACTICE-08: ${viewport.width}px stage buttons fit without overflow`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await stages(page)
      .getByRole('button', { name: /PLL 2단계/ })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const button of await stages(page).getByRole('button').all())
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
