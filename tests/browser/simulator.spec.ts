import { expect, test } from '@playwright/test';

test('keyboard rotates, Shift reverses, yaw changes the reference, presets reset', async ({
  page,
}) => {
  await page.goto('./');
  const stage = page.getByTestId('cube-stage');
  const history = page.getByLabel('회전 이력');
  const front = page.getByTestId('cube-front');
  await expect(front).toHaveAttribute('aria-label', /F 빨강, R 초록, U 노랑/);
  await expect(page.getByTestId('cube-back')).toHaveAttribute(
    'aria-label',
    /B 주황, L 파랑, D 흰색/,
  );
  const original = await front
    .locator('polygon')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('fill')));
  await page.keyboard.press('f');
  await expect(stage).toHaveAttribute('data-busy', 'false');
  await expect(history).toHaveText('F');
  expect(
    await front
      .locator('polygon')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('fill'))),
  ).not.toEqual(original);
  await page.keyboard.press('Shift+f');
  await expect(stage).toHaveAttribute('data-busy', 'false');
  expect(
    await front
      .locator('polygon')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('fill'))),
  ).toEqual(original);
  await page.keyboard.press('ArrowRight');
  await expect(front).toHaveAttribute('aria-label', /F 초록, R 주황, U 노랑/);
  await page.getByRole('button', { name: '흰색 십자가 프리셋 적용' }).click();
  await expect(page.locator('.live-badge')).toHaveText('흰색 십자가 완성');
  await expect(front).toHaveAttribute('aria-label', /F 빨강/);
  await page.getByRole('button', { name: '1·2층 완성 프리셋 적용' }).click();
  await expect(page.locator('.live-badge')).toHaveText('1·2층 완성');
  await page.getByRole('button', { name: '랜덤 섞기 프리셋 적용' }).click();
  await expect(page.locator('.live-badge')).toHaveText('자유롭게 연습 중');
});

for (const direction of [
  {
    key: 'ArrowRight',
    label: '오른쪽',
    arrow: '→',
    front: '기준 큐브: F 초록, R 주황, U 노랑',
    back: '뒤집어 본 큐브: B 파랑, L 빨강, D 흰색',
  },
  {
    key: 'ArrowLeft',
    label: '왼쪽',
    arrow: '←',
    front: '기준 큐브: F 파랑, R 빨강, U 노랑',
    back: '뒤집어 본 큐브: B 초록, L 주황, D 흰색',
  },
]) {
  test(`${direction.key}: keyboard and screen button share direction, history and undo`, async ({
    page,
  }) => {
    await page.goto('./');
    const front = page.getByTestId('cube-front');
    const back = page.getByTestId('cube-back');
    const stage = page.getByTestId('cube-stage');
    const history = page.getByLabel('회전 이력');
    const originalFront = await front
      .locator('polygon')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));
    const originalBack = await back
      .locator('polygon')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));

    await page.keyboard.press(direction.key);
    await expect(front).toHaveAttribute('aria-label', direction.front);
    await expect(back).toHaveAttribute('aria-label', direction.back);
    await expect(history).toHaveText(direction.arrow);
    const rotated = await front
      .locator('polygon')
      .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill')));
    await page.getByRole('button', { name: '맞춘 큐브 프리셋 적용' }).click();
    await page
      .getByRole('button', {
        name: `큐브 전체 ${direction.label}으로 90도 회전`,
      })
      .click();
    await expect(front).toHaveAttribute('aria-label', direction.front);
    await expect(back).toHaveAttribute('aria-label', direction.back);
    await expect(history).toHaveText(direction.arrow);
    expect(
      await front
        .locator('polygon')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill'))),
    ).toEqual(rotated);

    await page.getByRole('button', { name: '한 수 되돌리기' }).click();
    await expect(front).toHaveAttribute(
      'aria-label',
      '기준 큐브: F 빨강, R 초록, U 노랑',
    );
    await expect(back).toHaveAttribute(
      'aria-label',
      '뒤집어 본 큐브: B 주황, L 파랑, D 흰색',
    );
    for (let count = 0; count < 4; count++)
      await page.keyboard.press(direction.key);
    await expect(history).toHaveText(direction.arrow.repeat(4));
    await expect(stage).toHaveAttribute('data-busy', 'false');
    expect(
      await front
        .locator('polygon')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill'))),
    ).toEqual(originalFront);
    expect(
      await back
        .locator('polygon')
        .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('fill'))),
    ).toEqual(originalBack);
  });
}

test('animation is visible in both views and reset cancels an in-flight queue', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByLabel('천천히 돌려 보기').check();
  const polygons = page.getByTestId('cube-front').locator('polygon');
  const before = await polygons.evaluateAll((nodes) =>
    nodes.map((n) => n.getAttribute('points')),
  );
  await page.keyboard.press('r');
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'true',
  );
  await expect
    .poll(async () =>
      polygons.evaluateAll((nodes) =>
        nodes.map((n) => n.getAttribute('points')),
      ),
    )
    .not.toEqual(before);
  await page.keyboard.press('u');
  await page.keyboard.press('f');
  await page.getByRole('button', { name: '맞춘 큐브 프리셋 적용' }).click();
  await expect(page.getByTestId('cube-stage')).toHaveAttribute(
    'data-busy',
    'false',
  );
  await expect(page.locator('.live-badge')).toHaveText('여섯 면 완성');
  await expect(page.getByLabel('회전 이력')).toContainText('첫 회전');
});

for (const width of [320, 390, 768, 1440]) {
  test(`${width}px: two views, touch controls, no overflow, cubes remain visible while controlling`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('./');
    await expect(page.getByTestId('cube-front')).toBeVisible();
    await expect(page.getByTestId('cube-back')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const first = await page.getByTestId('cube-front').boundingBox();
    const second = await page.getByTestId('cube-back').boundingBox();
    expect(first!.width).toBeGreaterThan(second!.width);
    await page
      .getByRole('button', { name: '↺ 반시계 방향', exact: true })
      .click();
    await page
      .getByRole('button', { name: 'F 앞 면 반시계 방향 회전', exact: true })
      .click();
    await expect(page.getByTestId('cube-stage')).toHaveAttribute(
      'data-busy',
      'false',
    );
    await expect(page.getByLabel('회전 이력')).toHaveText("F'");
    for (const id of ['cube-front', 'cube-back']) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    }
  });
}
