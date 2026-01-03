import { test, expect } from "@playwright/test";

/**
 * Phase 5: Systems Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Systems", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test.describe("define_system", () => {
    test("adds a system", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        const before = tools.call("get_systems").data.length;

        tools.call("define_system", {
          system: {
            name: "gravity",
            phase: "physics",
            query: { has: ["Velocity"] },
            actions: [
              { type: "add", target: "entity.Velocity.vy", value: "rules.physics.gravity * dt" },
            ],
          },
        });

        const after = tools.call("get_systems").data.length;
        const system = tools.call("get_system", { name: "gravity" });

        return { before, after, system: system.data };
      });

      expect(result.before).toBe(0);
      expect(result.after).toBe(1);
      expect(result.system.name).toBe("gravity");
      expect(result.system.phase).toBe("physics");
    });

    test("replaces existing system with same name", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_system", {
          system: {
            name: "test-system",
            phase: "update",
            query: {},
            actions: [{ type: "emit", event: "v1" }],
          },
        });

        tools.call("define_system", {
          system: {
            name: "test-system",
            phase: "update",
            query: {},
            actions: [{ type: "emit", event: "v2" }],
          },
        });

        return {
          count: tools.call("get_systems").data.length,
          system: tools.call("get_system", { name: "test-system" }).data,
        };
      });

      expect(result.count).toBe(1);
      expect(result.system.actions[0].event).toBe("v2");
    });
  });

  test.describe("remove_system", () => {
    test("removes a system", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_system", {
          system: { name: "to-remove", phase: "update", query: {}, actions: [] },
        });

        const before = tools.call("get_systems").data.length;
        tools.call("remove_system", { name: "to-remove" });
        const after = tools.call("get_systems").data.length;

        return { before, after };
      });

      expect(result.before).toBe(1);
      expect(result.after).toBe(0);
    });
  });

  test.describe("run_systems", () => {
    test("runs systems on matching entities", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create an entity with Position and Velocity
        tools.call("create_entity", {
          id: "ball",
          tags: ["physics"],
          components: {
            Position: { x: 0, y: 0 },
            Velocity: { vx: 100, vy: 0 },
          },
        });

        // Define a movement system
        tools.call("define_system", {
          system: {
            name: "movement",
            phase: "physics",
            query: { has: ["Position", "Velocity"] },
            actions: [
              { type: "add", target: "entity.Position.x", value: "entity.Velocity.vx * dt" },
              { type: "add", target: "entity.Position.y", value: "entity.Velocity.vy * dt" },
            ],
          },
        });

        // Run systems manually
        const runResult = tools.call("run_systems", { input: {} });

        // Check entity position changed
        const entity = tools.call("get_entity", { id: "ball" }).data;

        return {
          systemsRun: runResult.data.systemsRun,
          positionX: entity.components.Position.x,
        };
      });

      expect(result.systemsRun.length).toBe(1);
      expect(result.systemsRun[0].entitiesProcessed).toBe(1);
      // Position should increase by velocity * dt (100 * 1/60)
      expect(result.positionX).toBeCloseTo(100 / 60, 3);
    });

    test("systems emit events", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("create_entity", {
          id: "player",
          tags: ["player"],
          components: {},
        });

        tools.call("define_system", {
          system: {
            name: "player-update",
            phase: "update",
            query: { tag: "player" },
            actions: [{ type: "emit", event: "player-updated" }],
          },
        });

        return tools.call("run_systems", { input: {} });
      });

      expect(result.data.eventsEmitted).toContain("player-updated");
    });

    test("systems respect phase ordering", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("create_entity", { id: "e1", tags: ["test"], components: {} });

        // Add systems in wrong order
        tools.call("define_system", {
          system: { name: "physics-sys", phase: "physics", query: { tag: "test" },
            actions: [{ type: "emit", event: "physics" }] },
        });
        tools.call("define_system", {
          system: { name: "input-sys", phase: "input", query: { tag: "test" },
            actions: [{ type: "emit", event: "input" }] },
        });
        tools.call("define_system", {
          system: { name: "update-sys", phase: "update", query: { tag: "test" },
            actions: [{ type: "emit", event: "update" }] },
        });

        const result = tools.call("run_systems", { input: {} });
        return result.data.systemsRun.map((s) => s.systemName);
      });

      // Should run in phase order: input, update, physics
      expect(result[0]).toBe("input-sys");
      expect(result[1]).toBe("update-sys");
      expect(result[2]).toBe("physics-sys");
    });

    test("systems can use input context", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("create_entity", {
          id: "player",
          tags: ["player"],
          components: { Velocity: { vx: 0 } },
        });

        tools.call("define_system", {
          system: {
            name: "player-input",
            phase: "input",
            query: { tag: "player" },
            actions: [
              { type: "set", target: "entity.Velocity.vx", value: "input.horizontal * 100" },
            ],
          },
        });

        tools.call("run_systems", { input: { horizontal: 1 } });
        const entity = tools.call("get_entity", { id: "player" }).data;

        return entity.components.Velocity.vx;
      });

      expect(result).toBe(100);
    });
  });

  test.describe("step runs systems", () => {
    test("step() executes all systems", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("create_entity", {
          id: "counter",
          tags: ["countable"],
          components: { Count: { value: 0 } },
        });

        tools.call("define_system", {
          system: {
            name: "counter",
            phase: "update",
            query: { tag: "countable" },
            actions: [{ type: "add", target: "entity.Count.value", value: "1" }],
          },
        });

        // Step 10 times
        tools.call("step", { frames: 10 });

        const entity = tools.call("get_entity", { id: "counter" }).data;
        return entity.components.Count.value;
      });

      expect(result).toBe(10);
    });
  });

  test("system tools are listed", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map((t) => t.name);
    });

    expect(tools).toContain("define_system");
    expect(tools).toContain("remove_system");
    expect(tools).toContain("get_system");
    expect(tools).toContain("get_systems");
    expect(tools).toContain("run_systems");
  });
});
