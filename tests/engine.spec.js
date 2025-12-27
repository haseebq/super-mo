import { test, expect } from "@playwright/test";

test("engine boots and toggles states", async ({ page }) => {
  await page.goto("/");

  const canvas = page.locator("#game");
  await expect(canvas).toBeVisible();

  const startOverlay = page.locator(".start-overlay");
  await expect(startOverlay).toBeVisible();

  await page.keyboard.press("Enter");

  await expect(startOverlay).toHaveClass(/is-hidden/);
  const storyOverlay = page.locator(".story-overlay");
  await expect(storyOverlay).toBeVisible();

  await page.evaluate(() => {
    const game = window.__SUPER_MO__;
    if (!game) {
      return;
    }
    game.state.storySeen = true;
    game.setMode("intro");
  });

  const introOverlay = page.locator(".intro-overlay");
  await expect(introOverlay).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(introOverlay).toHaveClass(/is-hidden/);

  await page.keyboard.press("KeyP");
  const pauseOverlay = page.locator(".pause-overlay");
  await expect(pauseOverlay).toBeVisible();

  const hud = page.locator(".hud");
  await expect(hud).toBeVisible();
});
