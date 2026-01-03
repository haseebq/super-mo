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

test("setEntityScript applies sine wave to enemies", async ({ page }) => {
  const status = await page.evaluate(() => ({
    ready: window.__SANDBOX_READY__ === true,
    error: window.__SANDBOX_ERROR__ || null,
  }));
  expect(
    status.ready,
    `Sandbox not ready: ${status.error ?? "unknown"}`
  ).toBeTruthy();

  // Get initial enemy positions
  const initialPositions = await page.evaluate(() =>
    window.__SUPER_MO__.state.enemies.map((e) => ({ x: e.x, y: e.y }))
  );
  expect(initialPositions.length).toBeGreaterThan(0);

  // Apply setEntityScript via sandbox runScript
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "runScript",
          code: `"use strict";
            capabilities.setEntityScript(
              "enemy",
              "if (!entity.baseY) entity.baseY = entity.y; entity.y = entity.baseY + Math.sin(time * 2) * 20;"
            );`,
        },
      ],
    });
  });

  expect(result.success).toBeTruthy();
  // runScript counts as 1, plus the nested setEntityScript should make it 2
  expect(result.appliedOps).toBeGreaterThanOrEqual(2);

  // Check that entityScripts.enemy is now set
  const hasScript = await page.evaluate(
    () => window.__SUPER_MO__.state.entityScripts.enemy !== null
  );
  expect(hasScript).toBeTruthy();

  // Wait a bit for the script to execute during game updates
  await page.waitForTimeout(200);

  // Verify enemies have moved (sine wave should have affected their Y position)
  const finalPositions = await page.evaluate(() =>
    window.__SUPER_MO__.state.enemies.map((e) => ({ x: e.x, y: e.y, baseY: e.baseY }))
  );

  // At least one enemy should have baseY set by the script
  const hasBaseY = finalPositions.some((e) => e.baseY !== undefined);
  expect(hasBaseY).toBeTruthy();
});

test("setEntityScript can be applied directly without sandbox", async ({ page }) => {
  // Apply setEntityScript directly via applyPatch (no sandbox)
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "setEntityScript",
          target: "enemy",
          script: "entity.y += Math.sin(time) * 0.5;",
        },
      ],
    });
  });

  expect(result.success).toBeTruthy();
  expect(result.appliedOps).toBe(1);

  const hasScript = await page.evaluate(
    () => window.__SUPER_MO__.state.entityScripts.enemy !== null
  );
  expect(hasScript).toBeTruthy();
});
