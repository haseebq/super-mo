import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const artifactsDir = join("tests", "artifacts");

function ensureArtifacts() {
  mkdirSync(artifactsDir, { recursive: true });
}

test("capture title and playing screens", async ({ page }) => {
  ensureArtifacts();
  await page.goto("/");

  const titleOverlay = page.locator(".start-overlay");
  const completeOverlay = page.locator(".complete-overlay");
  await expect(titleOverlay).toBeVisible();
  await expect(completeOverlay).toHaveClass(/is-hidden/);

  await page.screenshot({ path: join(artifactsDir, "title.png"), fullPage: true });

  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);

  await expect(titleOverlay).toHaveClass(/is-hidden/);
  await expect(completeOverlay).toHaveClass(/is-hidden/);

  await page.screenshot({ path: join(artifactsDir, "playing.png"), fullPage: true });
});
