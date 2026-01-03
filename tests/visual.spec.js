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

test("camera viewport scale matches baseline", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__SUPER_MO__?.state?.assetsReady);

  await page.evaluate(() => {
    const game = window.__SUPER_MO__;
    if (!game) return;
    game.setMode("playing");
    game.setMode("paused");

    const { state } = game;
    state.camera.x = 160;
    state.camera.y = 0;
    state.time = 0;
    state.backgroundTime = 0;

    state.player.x = 200;
    state.player.y = 136;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = true;
    state.player.facing = 1;
  });

  const canvas = page.locator("#game");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveScreenshot("camera-viewport.png");
});

test("sprites and animations match baseline", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__SUPER_MO__?.state?.assetsReady);

  await page.evaluate(() => {
    const game = window.__SUPER_MO__;
    if (!game) return;
    game.setMode("playing");
    game.setMode("paused");

    const { state } = game;
    state.camera.x = 0;
    state.camera.y = 0;
    state.time = 0;
    state.invulnerableTimer = 0;

    state.player.x = 120;
    state.player.y = 136;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.onGround = true;
    state.player.facing = 1;
    state.player.anim.currentAnimation = "run";
    state.player.anim.frameIndex = 1;
    state.player.anim.timer = 0;

    const moomba = state.enemies.find((enemy) => enemy.kind === "moomba");
    if (moomba && "anim" in moomba) {
      moomba.x = 180;
      moomba.y = 160;
      moomba.vx = 0;
      moomba.anim.frameIndex = 1;
      moomba.anim.timer = 0;
    }

    const spikelet = state.enemies.find((enemy) => enemy.kind === "spikelet");
    if (spikelet) {
      spikelet.x = 220;
      spikelet.y = 160;
      spikelet.vx = 0;
    }

    const flit = state.enemies.find((enemy) => enemy.kind === "flit");
    if (flit) {
      flit.x = 260;
      flit.y = 108;
      flit.vy = 0;
    }
  });

  const canvas = page.locator("#game");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveScreenshot("sprites-anim.png");
});
