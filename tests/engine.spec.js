import { test, expect } from "@playwright/test";

async function pressKey(page, code) {
  await page.evaluate((keyCode) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: keyCode }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: keyCode }));
  }, code);
}

test("engine boots and toggles states", async ({ page }) => {
  await page.goto("/");

  const canvas = page.locator("#game");
  await expect(canvas).toBeVisible();

  // Wait for game + renderer initialization
  await page.waitForFunction(() => window.__SUPER_MO__?.state != null, {
    timeout: 10000,
  });
  await page.waitForFunction(() => window.__SUPER_MO__?.state?.backgroundTime > 0, {
    timeout: 10000,
  });

  const startOverlay = page.locator(".start-overlay");
  await expect(startOverlay).toBeVisible();

  await pressKey(page, "Enter");

  await expect(startOverlay).toHaveClass(/is-hidden/);
  const introOverlay = page.locator(".intro-overlay");
  await expect(introOverlay).toBeVisible();

  await pressKey(page, "Enter");
  await expect(introOverlay).toHaveClass(/is-hidden/);

  await pressKey(page, "KeyP");
  const pauseOverlay = page.locator(".pause-overlay");
  await expect(pauseOverlay).toBeVisible();

  const hud = page.locator(".hud");
  await expect(hud).toBeVisible();
});
