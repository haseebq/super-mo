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

test("capture debug overlays", async ({ page }) => {
  ensureArtifacts();
  await page.goto("/?debugTiles=1&debugLabels=1");

  await page.evaluate(() => {
    const game = window.__SUPER_MO__;
    if (!game) return;
    game.state.storySeen = true;
    game.setMode("playing");
    game.setMode("paused");
    game.state.camera.x = 0;
    game.state.camera.y = 0;
    game.state.player.x = 120;
    game.state.player.y = 136;
  });

  await page.screenshot({ path: join(artifactsDir, "debug-tiles-labels.png"), fullPage: true });

  await page.evaluate(() => {
    window.__SUPER_MO__?.setDebug({ tiles: false, labels: true });
  });
  await page.screenshot({ path: join(artifactsDir, "debug-labels.png"), fullPage: true });

  await page.evaluate(() => {
    window.__SUPER_MO__?.setDebug({ tiles: true, labels: false });
  });
  await page.screenshot({ path: join(artifactsDir, "debug-tiles.png"), fullPage: true });
});
