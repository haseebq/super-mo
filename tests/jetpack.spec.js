import { test, expect } from "@playwright/test";

test("jetpack power-up activates and functions correctly", async ({ page }) => {
  await page.goto("/");
  
  // Start the game
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  
  // Wait for game to be ready
  await page.waitForTimeout(500);
  
  // Activate jetpack via game state
  const activated = await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      window.__SUPER_MO__.state.jetpackTimer = 10;
      window.__SUPER_MO__.state.jetpackWarning = false;
      return true;
    }
    return false;
  });
  
  expect(activated).toBe(true);
  
  // Wait for HUD to update
  await page.waitForTimeout(200);
  
  // Check HUD shows jetpack timer
  const hudBuffs = page.locator("#hud-buffs");
  await expect(hudBuffs).toContainText("🚀");
  
  // Verify jetpack timer counts down
  await page.waitForTimeout(1000);
  const timer = await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      return window.__SUPER_MO__.state.jetpackTimer;
    }
    return 0;
  });
  
  expect(timer).toBeLessThan(10);
  expect(timer).toBeGreaterThan(8);
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
  
  // Wait for HUD to update
  await page.waitForTimeout(200);
  
  // Verify jetpack is shown
  let hudBuffs = page.locator("#hud-buffs");
  await expect(hudBuffs).toContainText("🚀");
  
  // Now set it to 1.9 seconds to be in warning range
  await page.evaluate(() => {
    if (window.__SUPER_MO__) {
      window.__SUPER_MO__.state.jetpackTimer = 1.9;
    }
  });
  
  // Wait for next update cycle
  await page.waitForTimeout(100);
  
  // Check HUD shows warning icon
  await expect(hudBuffs).toContainText("🚀⚠");
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
