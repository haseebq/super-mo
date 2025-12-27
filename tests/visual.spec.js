import { test, expect } from "@playwright/test";

test("paused frame matches baseline", async ({ page }) => {
  await page.goto("/");

  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  await page.keyboard.press("KeyP");

  const canvas = page.locator("#game");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveScreenshot("paused-canvas.png");
});
