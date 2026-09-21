import { expect, test } from '@playwright/test';

test('assets load under the site base and reloading preserves a usable app', async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
  });
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId('cube-front')).toBeVisible();
  const assets = await page
    .locator('script[src], link[rel="stylesheet"]')
    .evaluateAll((nodes) =>
      nodes.map((node) =>
        node instanceof HTMLScriptElement
          ? node.src
          : (node as HTMLLinkElement).href,
      ),
    );
  expect(assets.length).toBeGreaterThan(0);
  const site = new URL(baseURL!);
  for (const asset of assets) {
    const url = new URL(asset);
    expect(url.origin).toBe(site.origin);
    expect(url.pathname.startsWith(site.pathname)).toBe(true);
  }
  await page.reload();
  await expect(page.getByTestId('cube-back')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('cube-front')).toHaveAttribute(
    'aria-label',
    /F 초록, R 주황, U 노랑/,
  );
  expect(errors).toEqual([]);
});
