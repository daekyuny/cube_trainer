import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await page.getByRole('button', { name: 'F2L 페어링', exact: true }).click();
});

test('F2L-01/03: all five fixed starts finish with a Y-layer pair and no insertion stage', async ({
  page,
}) => {
  for (let index = 0; index < 5; index++) {
    await page.locator('.case-select').nth(index).click();
    await expect(page.locator('.lesson-observation')).toContainText(
      'W·R·G / R·G 슬롯 바로 위',
    );
    await expect(page.locator('.lesson-observation')).toContainText(
      'Y층 뒤쪽 · O 센터 위',
    );
    await expect(page.getByTestId('cube-front')).toHaveAttribute(
      'aria-label',
      /F 빨강, R 초록, U 노랑/,
    );
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      'working',
    );
    await expect(page.locator('.lesson-expanded')).toHaveCount(1);
    await expect(page.locator('.lesson-expanded')).toHaveAttribute(
      'id',
      `solution-${index + 1}`,
    );
    await expect(page.getByTestId('stage-pair')).toBeVisible();
    await expect(page.getByTestId('stage-insert')).toHaveCount(0);
    await expect(page.getByTestId('stage-align')).toHaveCount(0);
    await page.getByRole('button', { name: '전체 시연' }).click();
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      'paired',
    );
    await expect(
      page.getByRole('button', { name: '페어링 완료', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: '전체 시연' }),
    ).toBeDisabled();
    const before = await page.getByTestId('cube-front').innerHTML();
    await page.getByRole('button', { name: '수순 리셋', exact: true }).click();
    expect(await page.getByTestId('cube-front').innerHTML()).toEqual(before);
    await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');
    await page.getByRole('button', { name: '같은 배치 다시' }).click();
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      'working',
    );
  }
});

test('F2L-04/07: manual pairing, cross restoration, undo and history reset', async ({
  page,
}) => {
  await page.keyboard.press('d');
  await expect(
    page.getByRole('button', { name: '수순 밖', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: '한 수 되돌리기' }).click();
  await expect(
    page.getByRole('button', { name: '다음 · R', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '풀이 숨김', exact: true }).click();
  await expect(page.locator('.lesson-guide')).toHaveCount(0);
  await page.keyboard.press('r');
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'pair-cross-broken',
  );
  await page.keyboard.press('Shift+u');
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  const before = await page.getByTestId('cube-front').innerHTML();
  await page.getByRole('button', { name: '수순 리셋', exact: true }).click();
  expect(await page.getByTestId('cube-front').innerHTML()).toEqual(before);
  await page.getByRole('button', { name: '풀이 보기', exact: true }).click();
  await expect(
    page.getByRole('button', { name: "다음 · R'", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press('Shift+r');
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'paired',
  );
  await page.getByRole('button', { name: '한 수 되돌리기' }).click();
  await expect(
    page.getByRole('button', { name: "다음 · R'", exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '같은 배치 다시' }).click();
  for (const key of ['r', 'u', 'Shift+r']) await page.keyboard.press(key);
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'working',
  );
});

test('F2L-02/08: only case 5 changes edge orientation; both views show color labels without face letters', async ({
  page,
}) => {
  const verifyLabels = async () => {
    const texts = await page.locator('.cube-svg text').allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) expect(text).toMatch(/^[YWROBG]$/);
  };
  for (let index = 0; index < 5; index++) {
    await page.locator('.case-select').nth(index).click();
    await verifyLabels();
  }
  await page
    .getByRole('button', { name: '엣지 윗색 바꾸기 · 현재 R', exact: true })
    .click();
  await expect(page.locator('.lesson-observation')).toContainText(
    'Y층 뒤쪽 · O 센터 위 · 위는 G',
  );
  await expect(page.locator('.solution-token')).toHaveText([
    'U2',
    "F'",
    "U'",
    'F',
  ]);
  await page.getByRole('button', { name: '전체 시연' }).click();
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'paired',
  );
  await verifyLabels();
  await page.getByLabel('대상 조각 강조').uncheck();
  await expect(page.locator('.cube-svg text')).toHaveCount(0);
  await page.getByRole('button', { name: '자유 연습', exact: true }).click();
  await expect(page.locator('.cube-svg text')).toHaveCount(0);
});

test('F2L-09: a pair that breaks another slot is not accepted; corrected demonstration preserves it', async ({
  page,
}) => {
  await page.locator('.case-select').nth(1).click();
  for (const key of ['Shift+r', 'u', 'u', 'r']) await page.keyboard.press(key);
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'slots-disturbed',
  );
  await expect(page.getByTestId('lesson-status')).toContainText(
    '다른 세 슬롯까지 복원',
  );
  await expect(
    page.getByRole('button', { name: '페어링 완료', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: '같은 배치 다시' }).click();
  await expect(page.locator('.solution-token')).toHaveText([
    'U',
    "F'",
    'U2',
    'F',
  ]);
  await page.getByRole('button', { name: '전체 시연' }).click();
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'paired',
  );
  await expect(page.getByTestId('lesson-status')).toContainText(
    '다른 세 슬롯도 유지',
  );
});

test('SESSION-03/04: reset and restart cancel animation, and switching modes cancels demonstration', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('천천히 돌려 보기').check();
  await page.getByRole('button', { name: '전체 시연' }).click();
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
  await page.getByRole('button', { name: '전체 시연' }).click();
  await page.locator('.case-select').nth(1).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.locator('.case-select').nth(1)).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: '전체 시연' }).click();
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
    await page.getByRole('button', { name: '전체 시연' }).click();
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      'paired',
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
      .getByRole('button', { name: '전체 시연' })
      .boundingBox())!;
    expect(demo.height).toBeGreaterThanOrEqual(44);
    await page.getByRole('button', { name: '같은 배치 다시' }).click();
    await page.getByRole('button', { name: '풀이 숨김', exact: true }).click();
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

test('F2L-10/11: inline accordion, mirrors, reversible letter navigation and hidden practice', async ({
  page,
}) => {
  for (let index = 0; index < 5; index++) {
    await page
      .getByRole('button', {
        name: `${index + 1}번 좌우 대칭 · RB로 전환`,
        exact: true,
      })
      .click();
    await expect(page.locator('.lesson-expanded')).toHaveCount(1);
    await expect(page.locator('.lesson-expanded')).toHaveAttribute(
      'id',
      `solution-${index + 1}`,
    );
    await expect(page.locator('.lesson-observation')).toContainText(
      'W·R·B / R·B 슬롯 바로 위 · 앞·왼쪽 위',
    );
    const initial = await page.locator('.cube-stage').innerHTML();
    const letters = page.locator('.solution-token');
    await letters.last().click();
    await expect(page.getByTestId('lesson-status')).toHaveAttribute(
      'data-status',
      'paired',
    );
    await page.getByRole('button', { name: '수순 리셋', exact: true }).click();
    await letters.first().click();
    await expect(page.getByTestId('cube-stage')).toHaveAttribute(
      'data-busy',
      'false',
    );
    await expect(letters.first()).toHaveAttribute('aria-current', 'step');
    await page.getByRole('button', { name: '시작', exact: true }).click();
    await expect(page.getByTestId('cube-stage')).toHaveAttribute(
      'data-busy',
      'false',
    );
    expect(await page.locator('.cube-stage').innerHTML()).toEqual(initial);
    await page.getByRole('button', { name: '풀이 숨김', exact: true }).click();
    await expect(letters).toHaveCount(0);
    await expect(page.getByTestId('stage-pair')).toHaveCount(0);
    expect(await page.locator('.cube-stage').innerHTML()).toEqual(initial);
    await page.getByRole('button', { name: '풀이 보기', exact: true }).click();
  }
  // U2 is one selectable letter even though manual input uses quarter turns.
  await page
    .getByRole('button', { name: '엣지 윗색 바꾸기 · 현재 R', exact: true })
    .click();
  await expect(page.locator('.solution-token')).toHaveText([
    'U2',
    'F',
    'U',
    "F'",
  ]);
  await page.keyboard.press('u');
  await expect(page.locator('.solution-token').first()).toHaveAttribute(
    'data-partial',
    'true',
  );
  await page.getByRole('button', { name: '다음 · U2', exact: true }).click();
  await expect(page.locator('.solution-token').first()).toHaveAttribute(
    'data-partial',
    'false',
  );
  await page.locator('.solution-token').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.solution-token').nth(1)).toHaveAttribute(
    'aria-current',
    'step',
  );
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.solution-token').first()).toHaveAttribute(
    'aria-current',
    'step',
  );
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 빨강, R 초록, U 노랑/,
  );
});

test('F2L-11: reverse seeking animates both cubes and mirror switching cancels it', async ({
  page,
}) => {
  await page.getByRole('button', { name: '전체 시연' }).click();
  await expect(page.getByTestId('lesson-status')).toHaveAttribute(
    'data-status',
    'paired',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByLabel('천천히 돌려 보기').check();
  const before = await page.getByTestId('cube-front').innerHTML();
  await page.getByRole('button', { name: '시작', exact: true }).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'true',
  );
  await expect(page.getByTestId('cube-front')).not.toHaveJSProperty(
    'innerHTML',
    before,
  );
  await page
    .getByRole('button', { name: '1번 좌우 대칭 · RB로 전환', exact: true })
    .click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  const mirrored = await page.getByTestId('cube-front').innerHTML();
  await expect(page.locator('.solution-token')).toHaveText(["L'", 'U', 'L']);
  // Wait past the cancelled frame's duration by starting a new animation.
  await page.locator('.solution-token').first().click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  expect(await page.getByTestId('cube-front').innerHTML()).toEqual(mirrored);
});
