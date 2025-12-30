import { test, expect } from "@playwright/test";

test("rig preview tool loads", async ({ page }) => {
  await page.goto("/docs/tools/rig-preview.html");
  await expect(page.locator("h1")) .toHaveText("Rig Preview Tool");
  await expect(page.locator("#canvas")).toBeVisible();
});

test("vector rendering spike loads", async ({ page }) => {
  await page.goto("/docs/spikes/vector-rendering.html");
  await expect(page.locator("h1")).toHaveText("Vector Rendering Spike");
  await expect(page.locator("#spike")).toBeVisible();
});
