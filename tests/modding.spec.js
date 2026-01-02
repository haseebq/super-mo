import { test, expect } from "@playwright/test";

async function pressKey(page, code) {
  await page.evaluate((keyCode) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: keyCode }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: keyCode }));
  }, code);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__SUPER_MO__?.modding != null);
  await page.waitForFunction(() => window.__SUPER_MO__?.state?.backgroundTime > 0, {
    timeout: 10000,
  });

  const startOverlay = page.locator(".start-overlay");
  await expect(startOverlay).toBeVisible();
  await pressKey(page, "Enter");

  const introOverlay = page.locator(".intro-overlay");
  await expect(introOverlay).toBeVisible();
  await pressKey(page, "Enter");
  await expect(introOverlay).toHaveClass(/is-hidden/);
});

test("modding prompt removes coins", async ({ page }) => {
  const moddingToggle = page.locator("#modding-toggle");
  await moddingToggle.click();

  const moddingOverlay = page.locator("#modding-overlay");
  await expect(moddingOverlay).not.toHaveClass(/is-hidden/);

  const initialCoins = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().entities.coins
  );
  expect(initialCoins).toBeGreaterThan(0);

  const input = page.locator("#modding-input");
  await input.fill("remove all coins");
  await page.locator("#modding-send").click();

  await page.waitForFunction(
    () => window.__SUPER_MO__.modding.getSnapshot().entities.coins === 0
  );
});

test("modding prompt updates gravity", async ({ page }) => {
  const moddingToggle = page.locator("#modding-toggle");
  await moddingToggle.click();

  const moddingOverlay = page.locator("#modding-overlay");
  await expect(moddingOverlay).not.toHaveClass(/is-hidden/);

  const input = page.locator("#modding-input");
  await input.fill("gravity off");
  await page.locator("#modding-send").click();

  await page.waitForFunction(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity === 0
  );
});

test("sandbox runScript applies ops", async ({ page }) => {
  const status = await page.evaluate(() => ({
    ready: window.__SANDBOX_READY__ === true,
    error: window.__SANDBOX_ERROR__ || null,
  }));
  expect(
    status.ready,
    `Sandbox not ready: ${status.error ?? "unknown"}`
  ).toBeTruthy();
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "runScript",
          code: '"use strict"; capabilities.setRule("physics.gravity", 0);',
        },
      ],
    });
  });

  expect(result.success).toBeTruthy();
  const gravity = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );
  expect(gravity).toBe(0);
});

test("sandbox validator rejects forbidden calls", async ({ page }) => {
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "runScript",
          code: '"use strict"; eval("2+2");',
        },
      ],
    });
  });

  expect(result.success).toBeFalsy();
  expect(result.errors?.some((error) => error.includes("Script error"))).toBeTruthy();
});

test("rollback restores last patch", async ({ page }) => {
  const original = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );

  await page.evaluate(async () => {
    await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "setRule",
          path: "physics.gravity",
          value: 0,
        },
      ],
    });
  });

  const updated = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );
  expect(updated).toBe(0);

  const rollback = await page.evaluate(
    () => window.__SUPER_MO__.modding.rollbackLastPatch()
  );
  expect(rollback.success).toBeTruthy();

  const restored = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );
  expect(restored).toBe(original);
});
