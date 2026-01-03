import { test, expect } from "@playwright/test";

async function pressKey(page, code) {
  await page.evaluate((keyCode) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: keyCode }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: keyCode }));
  }, code);
}

test("engine boots and toggles states", async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

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
  await page.waitForFunction(() => window.__RENDERER_READY__ === true, {
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

  expect(pageErrors, `Page errors: ${pageErrors.join(" | ")}`).toHaveLength(0);
  expect(
    consoleErrors,
    `Console errors: ${consoleErrors.join(" | ")}`
  ).toHaveLength(0);
});

test("camera pans right when player moves right", async ({ page }) => {
  await page.goto("/");

  await page.waitForFunction(() => window.__SUPER_MO__?.state != null, {
    timeout: 10000,
  });
  await page.waitForFunction(() => window.__RENDERER_READY__ === true, {
    timeout: 10000,
  });

  await pressKey(page, "Enter");
  await page.waitForFunction(() => window.__SUPER_MO__?.state?.mode === "intro", {
    timeout: 10000,
  });
  await pressKey(page, "Enter");

  await page.waitForFunction(() => window.__SUPER_MO__?.state?.mode === "playing", {
    timeout: 10000,
  });

  const initialCameraX = await page.evaluate(
    () => window.__SUPER_MO__?.state?.camera?.x ?? 0
  );

  await page.keyboard.down("ArrowRight");
  await page.waitForFunction(() => window.__SUPER_MO__?.state?.camera?.x > 0, {
    timeout: 3000,
  });
  await page.keyboard.up("ArrowRight");

  const cameraX = await page.evaluate(
    () => window.__SUPER_MO__?.state?.camera?.x ?? 0
  );
  expect(cameraX).toBeGreaterThan(initialCameraX);
});
