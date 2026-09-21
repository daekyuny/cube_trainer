import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'F2L 페어링', exact: true }).click();
});

test('F2L-01/03: five types start above the correct slot and demonstrate pairing, alignment and both insertions', async ({
  page,
}) => {
  for (let index = 0; index < 5; index++) {
    await page.locator('.lesson-picker button').nth(index).click();
    await expect(page.locator('.lesson-observation')).toContainText(
      'W·R·G / R·G 슬롯 바로 위',
    );
    await expect(page.getByTestId('cube-front')).toHaveAttribute(
      'aria-label',
      /F 빨강, R 초록, U 노랑/,
    );
    await expect(page.locator('.live-badge')).toHaveText('흰색 십자가 완성');
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      'working',
    );
    await expect(
      page.getByTestId('cube-front').locator('[data-target-label="C·W"]'),
    ).toHaveCount(1);
    if (index === 0) {
      await expect(page.getByTestId('stage-insert')).toContainText(
        "W 오른쪽: R U R'",
      );
      await expect(page.getByTestId('stage-insert')).toContainText(
        'W 왼쪽: L′ U′ L',
      );
      await expect(page.locator('.lesson-stages li')).toHaveCount(1);
    }
    await page.getByRole('button', { name: '이 단계 시연' }).click();
    await expect(page.getByTestId('cube-stage')).toHaveAttribute(
      'data-busy',
      'false',
    );
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      index === 0 ? 'inserted' : 'paired',
    );
    if (index === 0)
      await expect(page.getByLabel('회전 이력')).toHaveText("RUR'");
    await page.getByRole('button', { name: '수순 리셋', exact: true }).click();
    await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      index === 0 ? 'inserted' : 'paired',
    );
    if (index !== 0 && index !== 4) {
      await page.getByRole('button', { name: '이 단계 시연' }).click();
      await expect(page.getByTestId('cube-stage')).toHaveAttribute(
        'data-busy',
        'false',
      );
      if (index === 1 || index === 3) {
        await expect(page.getByTestId('cube-front')).toHaveAttribute(
          'aria-label',
          /F 초록, R 주황, U 노랑/,
        );
        await expect(page.getByTestId('stage-insert')).toContainText(
          "U' L' U L",
        );
      }
    }
    if (index !== 0)
      await page.getByRole('button', { name: '이 단계 시연' }).click();
    await expect(page.getByTestId('lesson-status')).toHaveText(
      '삽입 완료 · W 십자가도 유지했습니다.',
    );
    await expect(
      page.getByRole('button', { name: '예시 수순 완료', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: '같은 배치 다시' }).click();
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      'working',
    );
    await expect(page.getByTestId('cube-front')).toHaveAttribute(
      'aria-label',
      /F 빨강, R 초록, U 노랑/,
    );
  }
});

test('F2L-04: manual keyboard practice, wrong turn, undo and history reset keep the guide honest', async ({
  page,
}) => {
  await page.keyboard.press('d');
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(
    page.getByRole('button', { name: '예시 수순에서 벗어남', exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'cross-broken',
  );
  await page.getByRole('button', { name: '한 수 되돌리기' }).click();
  await expect(
    page.getByRole('button', { name: '다음 한 수 · R', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '혼자 연습', exact: true }).click();
  await expect(page.locator('.lesson-guide')).toHaveCount(0);
  for (const key of ['r', 'u']) await page.keyboard.press(key);
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'cross-broken',
  );
  const before = await page.getByTestId('cube-front').innerHTML();
  await page.getByRole('button', { name: '수순 리셋', exact: true }).click();
  expect(await page.getByTestId('cube-front').innerHTML()).toEqual(before);
  await page
    .getByRole('button', { name: '설명 보며 연습', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: "다음 한 수 · R'", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press('Shift+r');
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'inserted',
  );
  await page.getByRole('button', { name: '같은 배치 다시' }).click();
  await page.getByText('색 문자와 시작 조건', { exact: true }).click();
  await page
    .getByRole('button', { name: '같은 유형의 다른 배치 (1/2)', exact: true })
    .click();
  await expect(page.locator('.lesson-observation')).toContainText('Y층 왼쪽');
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'working',
  );
});

test('F2L-07: case 4 changes the actual edge position and requires pairing; the simple left variant belongs to case 1', async ({
  page,
}) => {
  await page.locator('.lesson-picker button').nth(3).click();
  await expect(page.locator('.lesson-observation')).toContainText('W는 앞');
  await expect(page.locator('.lesson-observation')).toContainText('Y층 뒤쪽');
  await expect(page.locator('.lesson-observation h3')).not.toContainText(
    '1번 회전형',
  );
  await expect(page.locator('.lesson-stages li')).toHaveCount(3);
  for (const key of ['Shift+f', 'Shift+u', 'f']) await page.keyboard.press(key);
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'working',
  );
  await expect(page.locator('.live-badge')).toHaveText('흰색 십자가 완성');
  await page.getByRole('button', { name: '같은 배치 다시' }).click();
  await page.getByRole('button', { name: '이 단계 시연' }).click();
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'paired',
  );
  await page.getByRole('button', { name: '이 단계 시연' }).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await page.getByRole('button', { name: '이 단계 시연' }).click();
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'inserted',
  );

  await page.locator('.lesson-picker button').nth(0).click();
  await page.getByText('색 문자와 시작 조건', { exact: true }).click();
  await page
    .getByRole('button', { name: '같은 유형의 다른 배치 (1/2)', exact: true })
    .click();
  await expect(page.locator('.lesson-observation')).toContainText('W는 앞');
  await expect(page.locator('.lesson-observation')).toContainText('Y층 왼쪽');
  await expect(page.locator('.lesson-stages li')).toHaveCount(1);
  await expect(page.getByTestId('stage-insert')).toContainText("→ L' U' L");
  await expect(page.getByTestId('stage-insert')).toContainText(
    'W 왼쪽: L′ U′ L',
  );
  await page.getByRole('button', { name: '이 단계 시연' }).click();
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'inserted',
  );
  await expect(page.locator('.move-count')).toHaveText('3 moves');
});

test('SESSION-03/04: reset and restart cancel animation, and switching modes cancels demonstration', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('천천히 돌려 보기').check();
  await page.getByRole('button', { name: '이 단계 시연' }).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'true',
  );
  await page.getByRole('button', { name: '수순 리셋', exact: true }).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await page.getByRole('button', { name: '같은 배치 다시' }).click();
  await page.getByRole('button', { name: '이 단계 시연' }).click();
  await page.getByRole('button', { name: '다음 유형 →' }).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.locator('.lesson-observation h3')).toHaveText(
    '2. 윗색 같음 · W 반대편',
  );
  await page.getByRole('button', { name: '이 단계 시연' }).click();
  await page.getByRole('button', { name: '자유 연습', exact: true }).click();
  await expect(page.locator('.live-badge')).toHaveText('여섯 면 완성');
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
});

for (const viewport of [
  { width: 320, height: 844 },
  { width: 390, height: 844 },
  { width: 768, height: 844 },
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`F2L-05: ${viewport.width}×${viewport.height} lesson controls and both cubes remain usable`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.getByRole('button', { name: '이 단계 시연' }).click();
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      'inserted',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const id of ['cube-front', 'cube-back']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    const demo = (await page
      .getByRole('button', { name: '이 단계 시연' })
      .boundingBox())!;
    expect(demo.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: '같은 배치 다시' }).click();
    await page.getByRole('button', { name: '혼자 연습', exact: true }).click();
    await page
      .getByRole('button', { name: 'R 오른쪽 면 시계 방향 회전', exact: true })
      .click();
    await expect(page.getByTestId('cube-stage')).toHaveAttribute(
      'data-busy',
      'false',
    );
    await expect(page.getByLabel('회전 이력')).toHaveText('R');
    for (const id of ['cube-front', 'cube-back']) {
      const box = (await page.getByTestId(id).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
  });
}
