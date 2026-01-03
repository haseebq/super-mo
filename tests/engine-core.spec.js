import { test, expect } from "@playwright/test";

/**
 * Phase 1: Engine Core Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Engine Core", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("step advances frame and time", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      const before = tools.call("get_frame");
      tools.call("step", { frames: 10 });
      const after = tools.call("get_frame");

      return { before: before.data, after: after.data };
    });

    expect(result.before).toBe(0);
    expect(result.after).toBe(10);
  });

  test("step accumulates time", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      const dt = 1 / 60;

      tools.call("step", { frames: 60, dt });
      return tools.call("get_time").data;
    });

    expect(result).toBeCloseTo(1.0, 5);
  });

  test("state round-trips through JSON", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Get initial state
      const original = tools.call("dump_state").data;

      // Modify it
      tools.call("step", { frames: 100 });

      // Reload original
      tools.call("load_state", { state: original });

      // Check it's back to original
      const restored = tools.call("dump_state").data;

      return {
        originalFrame: original.frame,
        restoredFrame: restored.frame,
      };
    });

    expect(result.originalFrame).toBe(0);
    expect(result.restoredFrame).toBe(0);
  });

  test("query_state returns full state", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      const state = tools.call("query_state").data;
      return {
        hasFrame: "frame" in state,
        hasEntities: "entities" in state,
        hasRules: "rules" in state,
        hasModes: "modes" in state,
      };
    });

    expect(result.hasFrame).toBe(true);
    expect(result.hasEntities).toBe(true);
    expect(result.hasRules).toBe(true);
    expect(result.hasModes).toBe(true);
  });

  test("query_state with path filters result", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      return tools.call("query_state", { path: "rules.physics.gravity" }).data;
    });

    expect(result).toBe(980);
  });

  test("get_mode returns current mode", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      return tools.call("get_mode").data;
    });

    expect(result).toBe("title");
  });

  test("unknown tool returns error", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      return tools.call("nonexistent_tool");
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown tool");
  });

  test("getTools lists available tools", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map(t => t.name);
    });

    expect(tools).toContain("step");
    expect(tools).toContain("dump_state");
    expect(tools).toContain("load_state");
    expect(tools).toContain("query_state");
  });
});
