import { test, expect } from "@playwright/test";

test("modding api modifies game rules", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Enter"); // Start
  await page.keyboard.press("Enter"); // Intro -> Playing

  // Wait for game to stabilize
  await page.waitForTimeout(500);

  // 1. Modify coin value
  await page.evaluate(() => {
    window.__SUPER_MO__.modding.applyPatch({
      ops: [{ op: "setRule", path: "scoring.coinValue", value: 1000 }],
    });
  });

  // Verify rule change in snapshot
  const value = await page.evaluate(() => {
    return window.__SUPER_MO__.modding.getSnapshot().rules.scoring.coinValue;
  });
  expect(value).toBe(1000);

  // 2. Remove entities (coins)
  // First check initial count
  const initialCoins = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().entities.coins
  );
  expect(initialCoins).toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__SUPER_MO__.modding.applyPatch({
      ops: [{ op: "removeEntities", filter: { kind: "coin" } }],
    });
  });

  const finalCoins = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().entities.coins
  );
  expect(finalCoins).toBe(0);

  // 3. Gravity (Fly)
  const initialGravity = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );
  expect(initialGravity).toBeGreaterThan(0);

  await page.evaluate(() => {
    window.__SUPER_MO__.modding.applyPatch({
      ops: [{ op: "setRule", path: "physics.gravity", value: 0 }],
    });
  });

  const finalGravity = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );
  expect(finalGravity).toBe(0);
});
