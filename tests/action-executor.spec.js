import { test, expect } from "@playwright/test";

/**
 * Phase 4: Action Executor Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Action Executor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test.describe("set action", () => {
    test("sets rules value", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        const before = tools.call("query_state", { path: "rules.physics.gravity" }).data;

        tools.call("execute_action", {
          action: { type: "set", target: "rules.physics.gravity", value: "500" },
        });

        const after = tools.call("query_state", { path: "rules.physics.gravity" }).data;

        return { before, after };
      });

      expect(result.before).toBe(980);
      expect(result.after).toBe(500);
    });

    test("sets value using expression", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Set gravity to double its current value
        tools.call("execute_action", {
          action: { type: "set", target: "rules.physics.gravity", value: "rules.physics.gravity * 2" },
        });

        return tools.call("query_state", { path: "rules.physics.gravity" }).data;
      });

      expect(result).toBe(1960); // 980 * 2
    });
  });

  test.describe("add action", () => {
    test("adds to rules value", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        const before = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        tools.call("execute_action", {
          action: { type: "add", target: "rules.scoring.coinValue", value: "50" },
        });

        const after = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        return { before, after };
      });

      expect(result.before).toBe(100);
      expect(result.after).toBe(150);
    });
  });

  test.describe("spawn action", () => {
    test("spawns entity from template", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_template", {
          name: "coin",
          template: {
            tags: ["coin"],
            components: { Position: { x: 0, y: 0 }, Value: { points: 100 } },
          },
        });

        const countBefore = tools.call("get_entities", { tag: "coin" }).data.length;

        tools.call("execute_action", {
          action: { type: "spawn", template: "coin" },
        });

        const countAfter = tools.call("get_entities", { tag: "coin" }).data.length;

        return { before: countBefore, after: countAfter };
      });

      expect(result.before).toBe(0);
      expect(result.after).toBe(1);
    });

    test("spawns entity at position from context", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_template", {
          name: "enemy",
          template: {
            tags: ["enemy"],
            components: { Position: { x: 0, y: 0 } },
          },
        });

        // Using data.spawnPos to pass position
        tools.call("execute_action", {
          action: {
            type: "spawn",
            template: "enemy",
            at: "data.spawnPos",
          },
          context: { data: { spawnPos: { x: 200, y: 300 } } },
        });

        const enemies = tools.call("get_entities", { tag: "enemy" });
        return enemies;
      });

      expect(result.data.length).toBe(1);
      // Position comes from template as data.spawnPos references the context
    });
  });

  test.describe("emit action", () => {
    test("emits event", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        return tools.call("execute_action", {
          action: { type: "emit", event: "player-hit" },
        });
      });

      expect(result.success).toBe(true);
      expect(result.data.eventsEmitted).toContain("player-hit");
    });
  });

  test.describe("when action", () => {
    test("executes then branch when true", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        return tools.call("execute_action", {
          action: {
            type: "when",
            condition: "5 > 3",
            then: [{ type: "emit", event: "condition-true" }],
            else: [{ type: "emit", event: "condition-false" }],
          },
        });
      });

      expect(result.data.eventsEmitted).toContain("condition-true");
      expect(result.data.eventsEmitted).not.toContain("condition-false");
    });

    test("executes else branch when false", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        return tools.call("execute_action", {
          action: {
            type: "when",
            condition: "5 < 3",
            then: [{ type: "emit", event: "condition-true" }],
            else: [{ type: "emit", event: "condition-false" }],
          },
        });
      });

      expect(result.data.eventsEmitted).toContain("condition-false");
      expect(result.data.eventsEmitted).not.toContain("condition-true");
    });

    test("uses context in condition", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        return tools.call("execute_action", {
          action: {
            type: "when",
            condition: "entity.Health.lives > 0",
            then: [{ type: "emit", event: "alive" }],
            else: [{ type: "emit", event: "dead" }],
          },
          context: {
            entity: { Health: { lives: 3 } },
          },
        });
      });

      expect(result.data.eventsEmitted).toContain("alive");
    });
  });

  test.describe("setMode action", () => {
    test("changes game mode", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        const modeBefore = tools.call("get_mode").data;

        tools.call("execute_action", {
          action: { type: "setMode", mode: "playing" },
        });

        const modeAfter = tools.call("get_mode").data;

        return { before: modeBefore, after: modeAfter };
      });

      expect(result.before).toBe("title");
      expect(result.after).toBe("playing");
    });
  });

  test.describe("forEach action", () => {
    test("iterates over matching entities", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create multiple enemies
        tools.call("create_entity", {
          id: "enemy1",
          tags: ["enemy"],
          components: { Health: { value: 10 } },
        });
        tools.call("create_entity", {
          id: "enemy2",
          tags: ["enemy"],
          components: { Health: { value: 10 } },
        });
        tools.call("create_entity", {
          id: "player",
          tags: ["player"],
          components: { Health: { value: 100 } },
        });

        // Emit event for each enemy
        const actionResult = tools.call("execute_action", {
          action: {
            type: "forEach",
            query: { tag: "enemy" },
            do: [{ type: "emit", event: "enemy-found" }],
          },
        });

        return actionResult.data.eventsEmitted.filter((e) => e === "enemy-found").length;
      });

      expect(result).toBe(2);
    });
  });

  test.describe("execute_actions tool", () => {
    test("executes multiple actions in sequence", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Start with coinValue = 100
        const before = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        tools.call("execute_actions", {
          actions: [
            { type: "add", target: "rules.scoring.coinValue", value: "100" },
            { type: "add", target: "rules.scoring.coinValue", value: "50" },
            { type: "add", target: "rules.scoring.coinValue", value: "25" },
          ],
        });

        const after = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        return { before, after };
      });

      // 100 + 100 + 50 + 25 = 275
      expect(result.before).toBe(100);
      expect(result.after).toBe(275);
    });

    test("collects all emitted events", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        return tools.call("execute_actions", {
          actions: [
            { type: "emit", event: "event1" },
            { type: "emit", event: "event2" },
            { type: "emit", event: "event3" },
          ],
        });
      });

      expect(result.data.eventsEmitted).toEqual(["event1", "event2", "event3"]);
    });
  });

  test("action tools are listed", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map((t) => t.name);
    });

    expect(tools).toContain("execute_action");
    expect(tools).toContain("execute_actions");
  });
});
