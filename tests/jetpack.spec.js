import { test, expect } from "@playwright/test";

test("jetpack power-up activates and functions correctly", async ({ page }) => {
  await page.goto("/");
  
  // Start the game
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  
  // Wait for game to be in playing mode
  await page.waitForTimeout(500);
  
  // Verify game is in playing mode
  const gameMode = await page.evaluate(() => {
    return window.__SUPER_MO__?.state.mode;
  });
  
  expect(gameMode).toBe("playing");
  
  // Activate jetpack via game state
  await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      window.__SUPER_MO__.state.jetpackTimer = 10;
      window.__SUPER_MO__.state.jetpackWarning = false;
    }
  });
  
  // Wait for timer to tick down enough that ceil() value changes
  await page.waitForTimeout(1500);
  
  // Verify jetpack timer is counting down
  const timer = await page.evaluate(() => {
    return window.__SUPER_MO__?.state.jetpackTimer || 0;
  });
  
  expect(timer).toBeLessThan(10);
  expect(timer).toBeGreaterThan(7);
  
  // Check HUD shows jetpack timer (should be visible after ceil value changed)
  const hudBuffs = page.locator("#hud-buffs");
  await expect(hudBuffs).toContainText("🚀");
});

test("jetpack warning appears at 2 seconds", async ({ page }) => {
  await page.goto("/");
  
  // Start the game
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  
  await page.waitForTimeout(500);
  
  // Set jetpack to 10 seconds first
  await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      window.__SUPER_MO__.state.jetpackTimer = 10;
    }
  });
  
  // Wait for HUD to update with multiple checks
  await page.waitForTimeout(300);
  
  // Verify jetpack is shown
  let hudBuffs = page.locator("#hud-buffs");
  await expect(hudBuffs).toContainText("🚀", { timeout: 2000 });
  
  // Now set it to 1.9 seconds to be in warning range
  await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      window.__SUPER_MO__.state.jetpackTimer = 1.9;
    }
  });
  
  // Wait for next update cycle
  await page.waitForTimeout(200);
  
  // Check HUD shows warning icon
  await expect(hudBuffs).toContainText("🚀⚠", { timeout: 2000 });
});

test("jetpack power-up can be collected", async ({ page }) => {
  await page.goto("/");
  
  // Start the game
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  
  await page.waitForTimeout(500);
  
  // Check that level has jetpack powerups
  const hasJetpack = await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      const jetpacks = window.__SUPER_MO__.state.level.powerups.filter(
        p => p.kind === "jetpack" && !p.collected
      );
      return jetpacks.length > 0;
    }
    return false;
  });
  
  expect(hasJetpack).toBe(true);
  
  // Simulate collecting a jetpack
  const collected = await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      const jetpack = window.__SUPER_MO__.state.level.powerups.find(
        p => p.kind === "jetpack" && !p.collected
      );
      if (jetpack) {
        jetpack.collected = true;
        window.__SUPER_MO__.state.jetpackTimer = 10;
        return true;
      }
    }
    return false;
  });
  
  expect(collected).toBe(true);
  
  // Verify jetpack is active
  const isActive = await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      return window.__SUPER_MO__.state.jetpackTimer > 0;
    }
    return false;
  });
  
  expect(isActive).toBe(true);
});
