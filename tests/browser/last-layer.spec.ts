import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const status = (page: Page) => page.getByTestId('lesson-status');

async function openMode(page: Page, name: '2-Look OLL' | '2-Look PLL') {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
});

for (const [mode, count, groups] of [
  ['2-Look OLL', 10, ['1단계 · 엣지 방향', '2단계 · 코너 방향']],
  ['2-Look PLL', 6, ['1단계 · 코너 위치', '2단계 · 엣지 위치']],
] as const) {
  for (let index = 0; index < count; index++) {
    test(`LL-01/03/05: ${mode} case ${index + 1} starts unsolved and its demonstration completes the step`, async ({
      page,
    }) => {
      await openMode(page, mode);
      await expect(page.locator('.case-group-title')).toHaveText(
        groups.map((group) => new RegExp(group)),
      );
      await expect(page.locator('.case-select')).toHaveCount(count);
      await page.locator('.case-select').nth(index).click();
      await expect(page.locator('.lesson-expanded')).toHaveCount(1);
      await expect(page.locator('.case-select').nth(index)).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(page.getByTestId('cube-front')).toHaveAttribute(
        'aria-label',
        /F 빨강, R 초록, U 노랑/,
      );
      await expect(status(page)).toHaveAttribute('data-status', 'working');
      await expect(page.locator('.case-recognition')).toContainText('인식');
      await page.getByRole('button', { name: '전체 시연' }).click();
      await expect(status(page)).toHaveAttribute('data-status', 'complete');
      await expect(
        page.getByRole('button', { name: '단계 완료', exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole('button', { name: '전체 시연' }),
      ).toBeDisabled();
      await page.getByRole('button', { name: '같은 배치 다시' }).click();
      await expect(status(page)).toHaveAttribute('data-status', 'working');
    });
  }
}

test('LL-03: continuing from the line case runs the full 2-look chain to a solved cube', async ({
  page,
}) => {
  await openMode(page, '2-Look OLL');
  const steps = [
    ['노란 십자 완성', /이어서 · OLL 2단계 수네/],
    ['윗면 전체 노랑 완성', /이어서 · PLL 1단계 헤드라이트 O · T-perm/],
    ['네 옆면 모두 헤드라이트 완성', /이어서 · PLL 2단계 Ua-perm/],
  ] as const;
  for (const [badge, next] of steps) {
    await page.getByRole('button', { name: '전체 시연' }).click();
    await expect(page.locator('.live-badge')).toHaveText(badge);
    await page.getByRole('button', { name: next }).click();
    await expect(status(page)).toHaveAttribute('data-status', 'working');
  }
  await expect(
    page.getByRole('button', { name: '2-Look PLL', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '전체 시연' }).click();
  await expect(status(page)).toContainText('큐브 완성');
  await expect(page.locator('.live-badge')).toHaveText('여섯 면 완성');
  await expect(page.getByRole('button', { name: /이어서/ })).toHaveCount(0);
});

test('LL-04/05: rotated views run the red-front algorithm on actual faces; letters seek both ways', async ({
  page,
}) => {
  await openMode(page, '2-Look OLL');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 주황/,
  );
  await expect(page.locator('.solution-reference')).toContainText(
    '다음 F → 현재 화면 B',
  );
  await page.getByRole('button', { name: '3수 U까지 이동' }).click();
  await expect(page.getByLabel('회전 이력')).toHaveText(/→→BLU$/);
  await page.getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByLabel('회전 이력')).toHaveText(/BLUU'L'B'$/);
  await expect(status(page)).toHaveAttribute('data-status', 'working');
  await page.getByRole('button', { name: '전체 시연' }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'complete');
  await page.getByRole('button', { name: '풀이 숨김', exact: true }).click();
  await expect(page.getByTestId('case-guide')).toHaveCount(0);
  await expect(status(page)).toHaveAttribute('data-status', 'complete');
  // Manual turn opens F2L: status explains that the algorithm is in progress.
  await page.keyboard.press('r');
  await expect(status(page)).toHaveAttribute('data-status', 'f2l-open');
});

test('LL-08: grouped triggers, x whole-cube steps and the f button follow the guide', async ({
  page,
}) => {
  await openMode(page, '2-Look OLL');
  // H: F, three named twists in brackets, F′.
  await page.locator('.case-select').nth(5).click();
  await expect(page.locator('.solution-group')).toHaveCount(3);
  await expect(page.locator('.solution-group small')).toHaveText([
    '트위스트',
    '트위스트',
    '트위스트',
  ]);
  await expect(page.locator('.solution-heading')).toContainText('14수');
  // T: x shows the white bottom in front; x′ at the end returns yellow up.
  await page.locator('.case-select').nth(8).click();
  await expect(page.locator('.solution-heading')).toContainText('8수');
  await page.getByRole('button', { name: '1수 x까지 이동' }).click();
  await expect(page.getByLabel('회전 이력')).toHaveText(/x$/);
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 흰색/,
  );
  await expect(page.locator('.solution-reference')).not.toContainText(
    '현재 화면',
  );
  await page.getByRole('button', { name: '전체 시연' }).click();
  await expect(status(page)).toHaveAttribute('data-status', 'complete');
  await page.getByRole('button', { name: /^10수 x/ }).click();
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 빨강, R 초록, U 노랑/,
  );
  // ㄴ자: the on-screen f button is the printed first step.
  await page.locator('.case-select').nth(1).click();
  await page.getByRole('button', { name: /^f 앞 두 줄/ }).click();
  await expect(
    page.getByRole('button', { name: '1수 f까지 이동' }),
  ).toHaveAttribute('aria-current', 'step');
});

test('LL-06: switching modes or cases cancels a running demonstration', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('천천히 돌려 보기').check();
  await openMode(page, '2-Look PLL');
  await page.getByRole('button', { name: '전체 시연' }).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'true',
  );
  await page.locator('.case-select').nth(3).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');
  await page.getByRole('button', { name: '전체 시연' }).click();
  await page.getByRole('button', { name: 'F2L 페어링', exact: true }).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.locator('.lesson-observation')).toContainText('W·R·G');
});

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 844 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`LL-07: ${viewport.width}×${viewport.height} case controls and both cubes remain usable`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    for (const mode of ['2-Look OLL', '2-Look PLL'] as const) {
      await openMode(page, mode);
      await page.getByRole('button', { name: '전체 시연' }).click();
      await expect(status(page)).toHaveAttribute('data-status', 'complete');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const id of ['cube-front', 'cube-circles']) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      }
      for (const button of await page
        .locator('.practice-modes button, .case-select, .solution-moves button')
        .all()) {
        const box = (await button.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
}
