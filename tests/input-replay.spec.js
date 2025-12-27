import { test, expect } from "@playwright/test";

test("deterministic input replay moves player forward", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Enter");

  const start = await page.evaluate(() => {
    const { x, y } = window.__SUPER_MO__.state.player;
    return { x, y };
  });

  await page.waitForTimeout(100);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(400);
  await page.keyboard.press("KeyZ");
  await page.waitForTimeout(200);
  await page.keyboard.up("ArrowRight");
  await page.waitForTimeout(200);

  const position = await page.evaluate(() => {
    const { x, y } = window.__SUPER_MO__.state.player;
    return { x, y };
  });

  expect(position.x).toBeGreaterThan(start.x + 6);
  expect(position.y).toBeLessThan(start.y - 2);
});
