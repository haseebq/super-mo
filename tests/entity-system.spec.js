import { test, expect } from "@playwright/test";

/**
 * Phase 2: Entity System Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Entity System", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("create_entity creates entity with components", async ({ page }) => {
    const entity = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      return tools.call("create_entity", {
        id: "test-entity",
        tags: ["player", "controllable"],
        components: {
          Position: { x: 100, y: 200 },
          Velocity: { vx: 0, vy: 0 },
        },
      });
    });

    expect(entity.success).toBe(true);
    expect(entity.data.id).toBe("test-entity");
    expect(entity.data.tags).toContain("player");
    expect(entity.data.components.Position.x).toBe(100);
  });

  test("get_entity returns entity data", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("create_entity", {
        id: "get-test",
        tags: ["test"],
        components: { Health: { value: 100 } },
      });

      return tools.call("get_entity", { id: "get-test" });
    });

    expect(result.success).toBe(true);
    expect(result.data.id).toBe("get-test");
    expect(result.data.components.Health.value).toBe(100);
  });

  test("get_entity returns error for non-existent entity", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      return tools.call("get_entity", { id: "nonexistent" });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
  });

  test("remove_entity deletes entity", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("create_entity", { id: "to-delete" });
      const removed = tools.call("remove_entity", { id: "to-delete" });
      const getAfter = tools.call("get_entity", { id: "to-delete" });

      return { removed, getAfter };
    });

    expect(result.removed.success).toBe(true);
    expect(result.getAfter.success).toBe(false);
  });

  test("get_entities queries by tag", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("create_entity", { id: "e1", tags: ["enemy"] });
      tools.call("create_entity", { id: "e2", tags: ["enemy"] });
      tools.call("create_entity", { id: "p1", tags: ["player"] });

      return tools.call("get_entities", { tag: "enemy" });
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data.map((e) => e.id)).toContain("e1");
    expect(result.data.map((e) => e.id)).toContain("e2");
  });

  test("get_entities queries by components", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("create_entity", {
        id: "with-pos",
        components: { Position: { x: 0, y: 0 } },
      });
      tools.call("create_entity", {
        id: "with-pos-vel",
        components: { Position: { x: 0, y: 0 }, Velocity: { vx: 0, vy: 0 } },
      });
      tools.call("create_entity", { id: "empty" });

      return tools.call("get_entities", { has: ["Position", "Velocity"] });
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("with-pos-vel");
  });

  test("get_entities with not filter excludes components", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("create_entity", {
        id: "static",
        components: { Position: { x: 0, y: 0 }, Static: {} },
      });
      tools.call("create_entity", {
        id: "moving",
        components: { Position: { x: 0, y: 0 } },
      });

      return tools.call("get_entities", { has: ["Position"], not: ["Static"] });
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe("moving");
  });

  test("set_component adds/replaces component", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("create_entity", { id: "comp-test" });
      tools.call("set_component", {
        id: "comp-test",
        component: "Health",
        data: { value: 50 },
      });

      return tools.call("get_entity", { id: "comp-test" });
    });

    expect(result.success).toBe(true);
    expect(result.data.components.Health.value).toBe(50);
  });

  test("update_component modifies component value", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("create_entity", {
        id: "update-test",
        components: { Position: { x: 0, y: 0 } },
      });
      tools.call("update_component", {
        id: "update-test",
        path: "Position.x",
        value: 999,
      });

      return tools.call("get_entity", { id: "update-test" });
    });

    expect(result.success).toBe(true);
    expect(result.data.components.Position.x).toBe(999);
  });

  test("remove_component removes component", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("create_entity", {
        id: "remove-comp-test",
        components: { A: {}, B: {} },
      });
      tools.call("remove_component", {
        id: "remove-comp-test",
        component: "A",
      });

      return tools.call("get_entity", { id: "remove-comp-test" });
    });

    expect(result.success).toBe(true);
    expect(result.data.components.A).toBeUndefined();
    expect(result.data.components.B).toBeDefined();
  });

  test("define_template and spawn_entity work together", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("define_template", {
        name: "coin",
        template: {
          tags: ["collectible", "coin"],
          components: {
            Position: { x: 0, y: 0 },
            Sprite: { sheet: "items", frame: "coin" },
            Value: { points: 100 },
          },
        },
      });

      const spawned = tools.call("spawn_entity", {
        template: "coin",
        at: { x: 150, y: 300 },
      });

      return spawned;
    });

    expect(result.success).toBe(true);
    expect(result.data.tags).toContain("coin");
    expect(result.data.components.Position.x).toBe(150);
    expect(result.data.components.Position.y).toBe(300);
    expect(result.data.components.Value.points).toBe(100);
  });

  test("spawn_entity fails for unknown template", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      return tools.call("spawn_entity", { template: "nonexistent" });
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown template");
  });

  test("get_template returns template definition", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      tools.call("define_template", {
        name: "enemy",
        template: {
          tags: ["enemy"],
          components: {
            Health: { value: 10 },
          },
        },
      });

      return tools.call("get_template", { name: "enemy" });
    });

    expect(result.success).toBe(true);
    expect(result.data.tags).toContain("enemy");
    expect(result.data.components.Health.value).toBe(10);
  });

  test("entity tools are listed", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map((t) => t.name);
    });

    expect(tools).toContain("spawn_entity");
    expect(tools).toContain("create_entity");
    expect(tools).toContain("remove_entity");
    expect(tools).toContain("get_entity");
    expect(tools).toContain("get_entities");
    expect(tools).toContain("set_component");
    expect(tools).toContain("update_component");
    expect(tools).toContain("remove_component");
    expect(tools).toContain("define_template");
    expect(tools).toContain("get_template");
  });
});
