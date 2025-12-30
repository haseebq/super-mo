import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__SUPER_MO__?.modding != null);

  const startOverlay = page.locator(".start-overlay");
  await expect(startOverlay).toBeVisible();
  await page.keyboard.press("Enter");

  const introOverlay = page.locator(".intro-overlay");
  await expect(introOverlay).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(introOverlay).toHaveClass(/is-hidden/);
});

test("modding prompt removes coins", async ({ page }) => {
  const moddingToggle = page.locator("#modding-toggle");
  await moddingToggle.click();

  const moddingOverlay = page.locator("#modding-overlay");
  await expect(moddingOverlay).not.toHaveClass(/is-hidden/);

  const initialCoins = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().entities.coins
  );
  expect(initialCoins).toBeGreaterThan(0);

  const input = page.locator("#modding-input");
  await input.fill("remove all coins");
  await page.locator("#modding-send").click();

  await page.waitForFunction(
    () => window.__SUPER_MO__.modding.getSnapshot().entities.coins === 0
  );
});

test("modding prompt updates gravity", async ({ page }) => {
  const moddingToggle = page.locator("#modding-toggle");
  await moddingToggle.click();

  const moddingOverlay = page.locator("#modding-overlay");
  await expect(moddingOverlay).not.toHaveClass(/is-hidden/);

  const input = page.locator("#modding-input");
  await input.fill("gravity off");
  await page.locator("#modding-send").click();

  await page.waitForFunction(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity === 0
  );
});
