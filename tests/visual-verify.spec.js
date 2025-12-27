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

test("capture sprite atlas grid", async ({ page }) => {
  ensureArtifacts();
  await page.goto("/");

  await page.evaluate(async () => {
    const atlas = await fetch("/assets/sprites.prod.json").then((res) => res.json());
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.src = "/assets/sprites.prod.png";
      img.onload = () => resolve(img);
      img.onerror = reject;
    });

    const entries = Object.entries(atlas).sort(([a], [b]) => a.localeCompare(b));
    const columns = 7;
    const cell = 32;
    const rows = Math.ceil(entries.length / columns);

    const canvas = document.createElement("canvas");
    canvas.width = columns * cell;
    canvas.height = rows * cell;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;

    entries.forEach(([_, frame], index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const dx = col * cell + (cell - frame.w * 2) / 2;
      const dy = row * cell + (cell - frame.h * 2) / 2;
      ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, dx, dy, frame.w * 2, frame.h * 2);
    });

    document.body.style.margin = "0";
    document.body.style.background = "#0c0c0c";
    document.body.replaceChildren(canvas);
  });

  await page.waitForTimeout(100);
  await page.screenshot({ path: join(artifactsDir, "atlas-grid.png"), fullPage: true });
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
