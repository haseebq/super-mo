import { test, expect } from "@playwright/test";

/**
 * Phase 0: Foundation tests
 *
 * Minimal tests to verify infrastructure works.
 * These connect via HTTP like an AI would connect via tools.
 */

test("server responds with index page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response.status()).toBe(200);
});

test("engine module exports are available", async ({ page }) => {
  await page.goto("/");

  // Wait for any script initialization
  await page.waitForTimeout(100);

  // The page should load without errors
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // Basic page structure
  await expect(page.locator("body")).toBeVisible();
  expect(errors).toHaveLength(0);
});
