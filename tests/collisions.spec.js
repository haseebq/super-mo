import { test, expect } from "@playwright/test";

/**
 * Phase 6: Collision System Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Collisions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test.describe("define_collision", () => {
    test("adds a collision handler", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        const before = tools.call("get_collision_handlers").data.length;

        tools.call("define_collision", {
          handler: {
            between: ["player", "enemy"],
            emit: "player-hit",
          },
        });

        const after = tools.call("get_collision_handlers").data.length;
        const handlers = tools.call("get_collision_handlers").data;

        return { before, after, handler: handlers[0] };
      });

      expect(result.before).toBe(0);
      expect(result.after).toBe(1);
      expect(result.handler.between).toEqual(["player", "enemy"]);
      expect(result.handler.emit).toBe("player-hit");
    });

    test("replaces handler with same between pair", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_collision", {
          handler: { between: ["a", "b"], emit: "event-v1" },
        });

        tools.call("define_collision", {
          handler: { between: ["a", "b"], emit: "event-v2" },
        });

        const handlers = tools.call("get_collision_handlers").data;
        return { count: handlers.length, emit: handlers[0].emit };
      });

      expect(result.count).toBe(1);
      expect(result.emit).toBe("event-v2");
    });
  });

  test.describe("remove_collision", () => {
    test("removes a collision handler", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_collision", {
          handler: { between: ["x", "y"], emit: "xy-collision" },
        });

        const before = tools.call("get_collision_handlers").data.length;
        tools.call("remove_collision", { between: ["x", "y"] });
        const after = tools.call("get_collision_handlers").data.length;

        return { before, after };
      });

      expect(result.before).toBe(1);
      expect(result.after).toBe(0);
    });
  });

  test.describe("detect_collisions", () => {
    test("detects AABB overlap between entities", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create two overlapping entities
        tools.call("create_entity", {
          id: "entity-a",
          tags: [],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 32, height: 32, layer: "player" },
          },
        });

        tools.call("create_entity", {
          id: "entity-b",
          tags: [],
          components: {
            Position: { x: 16, y: 16 }, // Overlaps with entity-a
            Collider: { width: 32, height: 32, layer: "enemy" },
          },
        });

        // Define collision handler
        tools.call("define_collision", {
          handler: { between: ["player", "enemy"], emit: "collision-detected" },
        });

        // Detect collisions
        const collisionResult = tools.call("detect_collisions");
        return collisionResult.data;
      });

      expect(result.collisionsDetected.length).toBe(1);
      expect(result.eventsEmitted.length).toBe(1);
      expect(result.eventsEmitted[0].event).toBe("collision-detected");
    });

    test("no collision when entities don't overlap", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create two non-overlapping entities
        tools.call("create_entity", {
          id: "entity-a",
          tags: [],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 32, height: 32, layer: "player" },
          },
        });

        tools.call("create_entity", {
          id: "entity-b",
          tags: [],
          components: {
            Position: { x: 100, y: 100 }, // Far from entity-a
            Collider: { width: 32, height: 32, layer: "enemy" },
          },
        });

        tools.call("define_collision", {
          handler: { between: ["player", "enemy"], emit: "collision-detected" },
        });

        return tools.call("detect_collisions").data;
      });

      expect(result.collisionsDetected.length).toBe(0);
      expect(result.eventsEmitted.length).toBe(0);
    });

    test("collision with condition", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("create_entity", {
          id: "player",
          tags: [],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 32, height: 32, layer: "player" },
            Health: { value: 100 },
          },
        });

        tools.call("create_entity", {
          id: "spike",
          tags: [],
          components: {
            Position: { x: 10, y: 10 },
            Collider: { width: 32, height: 32, layer: "hazard" },
          },
        });

        // Only collide if player has health > 50
        tools.call("define_collision", {
          handler: {
            between: ["player", "hazard"],
            condition: "data.a.components.Health.value > 50",
            emit: "player-damaged",
          },
        });

        return tools.call("detect_collisions").data;
      });

      expect(result.collisionsDetected.length).toBe(1);
    });

    test("collision with failing condition", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("create_entity", {
          id: "player",
          tags: [],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 32, height: 32, layer: "player" },
            Health: { value: 30 }, // Low health
          },
        });

        tools.call("create_entity", {
          id: "spike",
          tags: [],
          components: {
            Position: { x: 10, y: 10 },
            Collider: { width: 32, height: 32, layer: "hazard" },
          },
        });

        // Condition fails: health is not > 50
        tools.call("define_collision", {
          handler: {
            between: ["player", "hazard"],
            condition: "data.a.components.Health.value > 50",
            emit: "player-damaged",
          },
        });

        return tools.call("detect_collisions").data;
      });

      expect(result.collisionsDetected.length).toBe(0);
    });
  });

  test.describe("get_collisions_log", () => {
    test("returns simplified collision log", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("create_entity", {
          id: "player1",
          tags: [],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 32, height: 32, layer: "player" },
          },
        });

        tools.call("create_entity", {
          id: "coin1",
          tags: [],
          components: {
            Position: { x: 10, y: 10 },
            Collider: { width: 16, height: 16, layer: "collectible" },
          },
        });

        tools.call("define_collision", {
          handler: { between: ["player", "collectible"], emit: "coin-collected" },
        });

        return tools.call("get_collisions_log").data;
      });

      expect(result.length).toBe(1);
      expect(result[0].entityA).toBe("player1");
      expect(result[0].entityB).toBe("coin1");
      expect(result[0].event).toBe("coin-collected");
    });
  });

  test.describe("step() integration", () => {
    test("step() runs collision detection", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("create_entity", {
          id: "ball",
          tags: [],
          components: {
            Position: { x: 0, y: 0 },
            Velocity: { vx: 100, vy: 0 },
            Collider: { width: 10, height: 10, layer: "ball" },
          },
        });

        tools.call("create_entity", {
          id: "wall",
          tags: [],
          components: {
            Position: { x: 5, y: 0 },
            Collider: { width: 10, height: 10, layer: "wall" },
          },
        });

        tools.call("define_collision", {
          handler: { between: ["ball", "wall"], emit: "ball-hit-wall" },
        });

        // Step should detect collision
        const stepResult = tools.call("step", { frames: 1 });
        return stepResult.data;
      });

      expect(result.collisionsDetected).toBe(1);
      expect(result.eventsEmitted).toContain("ball-hit-wall");
    });
  });

  test.describe("collider offset", () => {
    test("respects collider offset", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Entity A at (0,0) with offset (50,50) - effective position (50,50)
        tools.call("create_entity", {
          id: "offset-entity",
          tags: [],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 10, height: 10, layer: "a", offsetX: 50, offsetY: 50 },
          },
        });

        // Entity B at (55,55) - should overlap with offset entity
        tools.call("create_entity", {
          id: "normal-entity",
          tags: [],
          components: {
            Position: { x: 55, y: 55 },
            Collider: { width: 10, height: 10, layer: "b" },
          },
        });

        tools.call("define_collision", {
          handler: { between: ["a", "b"], emit: "offset-collision" },
        });

        return tools.call("detect_collisions").data;
      });

      expect(result.collisionsDetected.length).toBe(1);
    });
  });

  test("collision tools are listed", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map((t) => t.name);
    });

    expect(tools).toContain("define_collision");
    expect(tools).toContain("remove_collision");
    expect(tools).toContain("get_collision_handlers");
    expect(tools).toContain("detect_collisions");
    expect(tools).toContain("get_collisions_log");
  });

  test.describe("layer requirement (TUI bug regression)", () => {
    test("entities without layer property are not detected in collisions", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create entities WITHOUT layer property (this was the TUI bug)
        tools.call("create_entity", {
          id: "player-no-layer",
          tags: ["player"],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 32, height: 32 }, // No layer!
          },
        });

        tools.call("create_entity", {
          id: "coin-no-layer",
          tags: ["coin"],
          components: {
            Position: { x: 10, y: 10 }, // Overlapping
            Collider: { width: 16, height: 16 }, // No layer!
          },
        });

        tools.call("define_collision", {
          handler: { between: ["player", "coin"], emit: "coin-collected" },
        });

        return tools.call("detect_collisions").data;
      });

      // Without layers, collisions are NOT detected (this documents the behavior)
      expect(result.collisionsDetected.length).toBe(0);
      expect(result.eventsEmitted.length).toBe(0);
    });

    test("entities WITH layer property are detected in collisions", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create entities WITH layer property (the fix)
        tools.call("create_entity", {
          id: "player-with-layer",
          tags: ["player"],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 32, height: 32, layer: "player" },
          },
        });

        tools.call("create_entity", {
          id: "coin-with-layer",
          tags: ["coin"],
          components: {
            Position: { x: 10, y: 10 }, // Overlapping
            Collider: { width: 16, height: 16, layer: "coin" },
          },
        });

        tools.call("define_collision", {
          handler: { between: ["player", "coin"], emit: "coin-collected" },
        });

        return tools.call("detect_collisions").data;
      });

      // With layers set correctly, collision IS detected
      expect(result.collisionsDetected.length).toBe(1);
      expect(result.eventsEmitted.length).toBe(1);
      expect(result.eventsEmitted[0].event).toBe("coin-collected");
    });

    test("TUI-style player-coin collision emits events through step()", async ({
      page,
    }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Simulate TUI setup with player and coin templates
        tools.call("define_template", {
          name: "tui-player",
          template: {
            tags: ["player"],
            components: {
              Position: { x: 5, y: 14 },
              Velocity: { vx: 0, vy: 0 },
              Collider: { width: 1, height: 1, layer: "player" },
              Health: { lives: 3 },
              Stats: { coins: 0, score: 0 },
            },
          },
        });

        tools.call("define_template", {
          name: "tui-coin",
          template: {
            tags: ["coin"],
            components: {
              Position: { x: 0, y: 0 },
              Collider: { width: 1, height: 1, layer: "coin" },
            },
          },
        });

        // Spawn player and coin at overlapping positions
        tools.call("spawn_entity", {
          template: "tui-player",
          id: "tui-player-1",
        });
        tools.call("spawn_entity", {
          template: "tui-coin",
          id: "tui-coin-1",
          at: { x: 5, y: 14 }, // Same position as player
        });

        // Define collision handler (uses emit, not actions)
        tools.call("define_collision", {
          handler: {
            between: ["player", "coin"],
            emit: "coin_collected",
          },
        });

        // Step the engine
        const stepResult = tools.call("step", { frames: 1 });
        return stepResult.data;
      });

      expect(result.collisionsDetected).toBe(1);
      expect(result.eventsEmitted).toContain("coin_collected");
    });
  });
});
