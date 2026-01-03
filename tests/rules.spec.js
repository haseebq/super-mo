import { test, expect } from "@playwright/test";

/**
 * Phase 8: Rules System Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Rules", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test.describe("get_rule", () => {
    test("gets physics rule by path", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_rule", { path: "physics.gravity" }).data;
      });

      expect(result).toBe(980); // Default value
    });

    test("gets scoring rule by path", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_rule", { path: "scoring.coinValue" }).data;
      });

      expect(result).toBe(100); // Default value
    });

    test("gets entire physics section", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_rule", { path: "physics" }).data;
      });

      expect(result.gravity).toBe(980);
      expect(result.friction).toBe(0.9);
      expect(result.moveSpeed).toBe(150);
      expect(result.jumpImpulse).toBe(300);
    });

    test("returns undefined for non-existent path", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_rule", { path: "physics.nonExistent" }).data;
      });

      expect(result).toBeUndefined();
    });
  });

  test.describe("set_rule", () => {
    test("sets physics rule value", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("set_rule", { path: "physics.gravity", value: 1500 });
        return tools.call("get_rule", { path: "physics.gravity" }).data;
      });

      expect(result).toBe(1500);
    });

    test("sets scoring rule value", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("set_rule", { path: "scoring.coinValue", value: 500 });
        return tools.call("get_rule", { path: "scoring.coinValue" }).data;
      });

      expect(result).toBe(500);
    });

    test("creates new nested path", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("set_rule", { path: "controls.jump", value: "Space" });
        return tools.call("get_rule", { path: "controls.jump" }).data;
      });

      expect(result).toBe("Space");
    });
  });

  test.describe("get_rules", () => {
    test("returns all rules", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_rules").data;
      });

      expect(result.physics).toBeDefined();
      expect(result.scoring).toBeDefined();
      expect(result.controls).toBeDefined();
    });
  });

  test.describe("get_physics_rules", () => {
    test("returns physics rules", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_physics_rules").data;
      });

      expect(result.gravity).toBe(980);
      expect(result.friction).toBe(0.9);
      expect(result.moveSpeed).toBe(150);
      expect(result.jumpImpulse).toBe(300);
    });
  });

  test.describe("get_scoring_rules", () => {
    test("returns scoring rules", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_scoring_rules").data;
      });

      expect(result.coinValue).toBe(100);
      expect(result.enemyKillBonus).toBe(200);
    });
  });

  test.describe("controls", () => {
    test("set_control sets key mapping", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("set_control", { action: "jump", key: "Space" });
        tools.call("set_control", { action: "dash", key: "Shift" });

        return tools.call("get_controls").data;
      });

      expect(result.jump).toBe("Space");
      expect(result.dash).toBe("Shift");
    });
  });

  test.describe("reset_rules", () => {
    test("resets rules to defaults", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Modify rules
        tools.call("set_rule", { path: "physics.gravity", value: 9999 });
        tools.call("set_rule", { path: "scoring.coinValue", value: 9999 });

        const beforeReset = {
          gravity: tools.call("get_rule", { path: "physics.gravity" }).data,
          coinValue: tools.call("get_rule", { path: "scoring.coinValue" }).data,
        };

        // Reset
        tools.call("reset_rules");

        const afterReset = {
          gravity: tools.call("get_rule", { path: "physics.gravity" }).data,
          coinValue: tools.call("get_rule", { path: "scoring.coinValue" }).data,
        };

        return { beforeReset, afterReset };
      });

      expect(result.beforeReset.gravity).toBe(9999);
      expect(result.beforeReset.coinValue).toBe(9999);
      expect(result.afterReset.gravity).toBe(980);
      expect(result.afterReset.coinValue).toBe(100);
    });
  });

  test.describe("expressions use rules", () => {
    test("expressions can reference rules.physics.gravity", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("evaluate_expression", {
          expression: "rules.physics.gravity * 2",
        }).data;
      });

      expect(result).toBe(1960); // 980 * 2
    });

    test("expressions can reference rules.scoring.coinValue", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("evaluate_expression", {
          expression: "rules.scoring.coinValue + 50",
        }).data;
      });

      expect(result).toBe(150); // 100 + 50
    });
  });

  test.describe("systems use rules", () => {
    test("system can use rule values in expressions", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create entity
        tools.call("create_entity", {
          id: "ball",
          tags: ["physics"],
          components: { Velocity: { vy: 0 } },
        });

        // Define system that applies gravity
        tools.call("define_system", {
          system: {
            name: "gravity",
            phase: "physics",
            query: { tag: "physics" },
            actions: [
              { type: "add", target: "entity.Velocity.vy", value: "rules.physics.gravity * dt" },
            ],
          },
        });

        // Run for 1 frame
        tools.call("run_systems", { input: {} });

        // Check velocity
        const entity = tools.call("get_entity", { id: "ball" }).data;
        return entity.components.Velocity.vy;
      });

      // vy should increase by gravity * dt (980 * 1/60)
      expect(result).toBeCloseTo(980 / 60, 3);
    });
  });

  test("rules tools are listed", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map((t) => t.name);
    });

    expect(tools).toContain("get_rule");
    expect(tools).toContain("set_rule");
    expect(tools).toContain("get_rules");
    expect(tools).toContain("get_physics_rules");
    expect(tools).toContain("get_scoring_rules");
    expect(tools).toContain("get_controls");
    expect(tools).toContain("set_control");
    expect(tools).toContain("reset_rules");
  });
});
