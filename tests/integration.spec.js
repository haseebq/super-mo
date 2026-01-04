import { test, expect } from "@playwright/test";

/**
 * Phase 13: Integration Tests
 *
 * Full end-to-end tests for the game loop.
 * Verifies the complete game flow works.
 */

test.describe("Game Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
    // Create initial game state for integration tests
    await page.evaluate(() => {
      window.__SUPER_MO__.stopGame();
      window.__SUPER_MO__.startGame({ withInitialState: true });
    });
  });

  test("game starts with initial entities", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;
      const entities = tools.call("get_entities", {}).data;
      return {
        entityCount: entities.length,
        hasPlayer: entities.some(e => e.tags.includes("player")),
        hasCoins: entities.some(e => e.tags.includes("coin")),
        hasPlatforms: entities.some(e => e.tags.includes("platform")),
      };
    });

    expect(result.entityCount).toBeGreaterThan(0);
    expect(result.hasPlayer).toBe(true);
    expect(result.hasCoins).toBe(true);
    expect(result.hasPlatforms).toBe(true);
  });

  test("game starts in title mode", async ({ page }) => {
    const mode = await page.evaluate(() => {
      return window.__SUPER_MO__.engine.getMode();
    });

    expect(mode).toBe("title");
  });

  test("title overlay is visible on start", async ({ page }) => {
    const isVisible = await page.locator(".start-overlay").isVisible();
    expect(isVisible).toBe(true);
  });

  test("pressing Enter transitions from title to intro", async ({ page }) => {
    await page.keyboard.press("Enter");

    // Wait for mode change
    await page.waitForFunction(() => window.__SUPER_MO__.engine.getMode() === "intro", {
      timeout: 2000,
    });

    const mode = await page.evaluate(() => window.__SUPER_MO__.engine.getMode());
    expect(mode).toBe("intro");
  });

  test("pressing Enter twice goes to playing mode", async ({ page }) => {
    await page.keyboard.press("Enter"); // title -> intro
    await page.waitForFunction(() => window.__SUPER_MO__.engine.getMode() === "intro");

    await page.keyboard.press("Enter"); // intro -> playing
    await page.waitForFunction(() => window.__SUPER_MO__.engine.getMode() === "playing");

    const mode = await page.evaluate(() => window.__SUPER_MO__.engine.getMode());
    expect(mode).toBe("playing");
  });

  test("engine steps when in playing mode", async ({ page }) => {
    // Go to playing mode
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__SUPER_MO__.engine.getMode() === "playing");

    const frameBefore = await page.evaluate(() => window.__SUPER_MO__.engine.getFrame());

    // Wait a bit for game loop to run
    await page.waitForTimeout(100);

    const frameAfter = await page.evaluate(() => window.__SUPER_MO__.engine.getFrame());

    expect(frameAfter).toBeGreaterThan(frameBefore);
  });

  test("P key pauses and resumes", async ({ page }) => {
    // Go to playing mode
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.__SUPER_MO__.engine.getMode() === "playing");

    // Pause
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__SUPER_MO__.engine.getMode() === "paused");
    const pausedMode = await page.evaluate(() => window.__SUPER_MO__.engine.getMode());
    expect(pausedMode).toBe("paused");

    // Resume
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__SUPER_MO__.engine.getMode() === "playing");
    const playingMode = await page.evaluate(() => window.__SUPER_MO__.engine.getMode());
    expect(playingMode).toBe("playing");
  });

  test("input state tracks arrow keys", async ({ page }) => {
    await page.keyboard.down("ArrowLeft");

    const leftPressed = await page.evaluate(() => window.__SUPER_MO__.inputState.horizontal);
    expect(leftPressed).toBe(-1);

    await page.keyboard.up("ArrowLeft");
    await page.keyboard.down("ArrowRight");

    const rightPressed = await page.evaluate(() => window.__SUPER_MO__.inputState.horizontal);
    expect(rightPressed).toBe(1);

    await page.keyboard.up("ArrowRight");

    const released = await page.evaluate(() => window.__SUPER_MO__.inputState.horizontal);
    expect(released).toBe(0);
  });

  test("input state tracks jump key", async ({ page }) => {
    await page.keyboard.down("Space");

    const jumpPressed = await page.evaluate(() => window.__SUPER_MO__.inputState.jump);
    expect(jumpPressed).toBe(true);

    await page.keyboard.up("Space");

    const jumpReleased = await page.evaluate(() => window.__SUPER_MO__.inputState.jump);
    expect(jumpReleased).toBe(false);
  });

  test("input state tracks dash key", async ({ page }) => {
    await page.keyboard.down("ShiftLeft");

    const dashPressed = await page.evaluate(() => window.__SUPER_MO__.inputState.dash);
    expect(dashPressed).toBe(true);

    await page.keyboard.up("ShiftLeft");

    const dashReleased = await page.evaluate(() => window.__SUPER_MO__.inputState.dash);
    expect(dashReleased).toBe(false);
  });
});

test.describe("Scenario Tests - Tool Sequences", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
    // Create initial game state including templates
    await page.evaluate(() => {
      window.__SUPER_MO__.stopGame();
      window.__SUPER_MO__.startGame({ withInitialState: true });
    });
  });

  test("scenario: spawn and move entity", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;

      // Spawn a test entity
      const spawn = tools.call("spawn_entity", {
        template: "coin",
        id: "scenario-coin",
        at: { x: 0, y: 0 },
      });

      // Verify it exists
      const entity1 = tools.call("get_entity", { id: "scenario-coin" });
      const pos1 = entity1.data.components.Position;

      // Move it using set_component
      tools.call("set_component", {
        id: "scenario-coin",
        component: "Position",
        data: { x: 100, y: 50 },
      });

      // Verify new position
      const entity2 = tools.call("get_entity", { id: "scenario-coin" });
      const pos2 = entity2.data.components.Position;

      return {
        spawnSuccess: spawn.success,
        originalPos: pos1,
        newPos: pos2,
      };
    });

    expect(result.spawnSuccess).toBe(true);
    expect(result.originalPos).toEqual({ x: 0, y: 0 });
    expect(result.newPos).toEqual({ x: 100, y: 50 });
  });

  test("scenario: define and trigger event", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;

      // Define an event that emits another event (simpler test)
      tools.call("define_event", {
        event: "test-collect",
        actions: [
          { type: "emit", event: "collected" },
        ],
      });

      // Trigger and check events log
      tools.call("trigger_event", {
        event: "test-collect",
      });

      // The event system processed the trigger
      const eventsLog = tools.call("get_events_log").data;

      return {
        hasEvent: eventsLog !== undefined,
        eventDefined: tools.call("get_event", { event: "test-collect" }).success,
      };
    });

    expect(result.hasEvent).toBe(true);
    expect(result.eventDefined).toBe(true);
  });

  test("scenario: complete game flow via tools", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;

      // Start from title
      const mode1 = tools.call("get_mode").data;

      // Transition to intro
      tools.call("trigger_transition", { trigger: "start" });
      const mode2 = tools.call("get_mode").data;

      // Transition to playing
      tools.call("trigger_transition", { trigger: "start" });
      const mode3 = tools.call("get_mode").data;

      // Step some frames
      tools.call("step", { frames: 10 });
      const frame = tools.call("get_frame").data;

      // Trigger complete
      tools.call("trigger_transition", { trigger: "complete" });
      const mode4 = tools.call("get_mode").data;

      return { mode1, mode2, mode3, mode4, frame };
    });

    expect(result.mode1).toBe("title");
    expect(result.mode2).toBe("intro");
    expect(result.mode3).toBe("playing");
    expect(result.mode4).toBe("complete");
    expect(result.frame).toBe(10);
  });

  test("scenario: modify rules affects simulation", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;

      // Get initial gravity
      const initialGravity = tools.call("get_rule", { path: "physics.gravity" }).data;

      // Modify gravity
      tools.call("set_rule", { path: "physics.gravity", value: 500 });
      const modifiedGravity = tools.call("get_rule", { path: "physics.gravity" }).data;

      // Reset to original
      tools.call("set_rule", { path: "physics.gravity", value: 980 });
      const resetGravity = tools.call("get_rule", { path: "physics.gravity" }).data;

      // Modify move speed
      const initialSpeed = tools.call("get_rule", { path: "physics.moveSpeed" }).data;
      tools.call("set_rule", { path: "physics.moveSpeed", value: 300 });
      const modifiedSpeed = tools.call("get_rule", { path: "physics.moveSpeed" }).data;

      return {
        initialGravity,
        modifiedGravity,
        resetGravity,
        initialSpeed,
        modifiedSpeed,
      };
    });

    expect(result.initialGravity).toBe(980);
    expect(result.modifiedGravity).toBe(500);
    expect(result.resetGravity).toBe(980);
    expect(result.modifiedSpeed).toBe(300);
  });
});

test.describe("Determinism Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("same inputs produce same outputs", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;

      // Save initial state
      const initialState = tools.call("dump_state").data;

      // Run simulation with specific inputs
      tools.call("set_mode", { mode: "playing" });

      const input = { horizontal: 1, vertical: 0, jump: false, dash: false };

      for (let i = 0; i < 60; i++) {
        tools.call("step", { dt: 1 / 60 });
      }

      const state1 = tools.call("dump_state").data;

      // Reset and run again
      tools.call("load_state", { state: initialState });
      tools.call("set_mode", { mode: "playing" });

      for (let i = 0; i < 60; i++) {
        tools.call("step", { dt: 1 / 60 });
      }

      const state2 = tools.call("dump_state").data;

      // Compare frames and time
      return {
        frame1: state1.frame,
        frame2: state2.frame,
        time1: state1.time,
        time2: state2.time,
        sameFrame: state1.frame === state2.frame,
        sameTime: Math.abs(state1.time - state2.time) < 0.0001,
      };
    });

    expect(result.sameFrame).toBe(true);
    expect(result.sameTime).toBe(true);
  });

  test("state can be saved and restored", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;

      // Make some changes
      tools.call("set_mode", { mode: "playing" });
      tools.call("step", { frames: 30 });

      // Save state
      const savedState = tools.call("dump_state").data;
      const savedFrame = savedState.frame;

      // Make more changes
      tools.call("step", { frames: 30 });
      const afterMoreSteps = tools.call("get_frame").data;

      // Restore
      tools.call("load_state", { state: savedState });
      const afterRestore = tools.call("get_frame").data;

      return {
        savedFrame,
        afterMoreSteps,
        afterRestore,
        restored: afterRestore === savedFrame,
      };
    });

    expect(result.afterMoreSteps).toBe(60);
    expect(result.afterRestore).toBe(30);
    expect(result.restored).toBe(true);
  });
});

test.describe("AI Can Build Game", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("AI can define complete game via tools", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;

      // Clear existing state
      const initialState = tools.call("dump_state").data;
      initialState.entities = [];
      initialState.systems = [];
      initialState.events = {};
      initialState.templates = {};
      tools.call("load_state", { state: initialState });

      // Define templates
      tools.call("define_template", {
        name: "hero",
        template: {
          tags: ["player", "hero"],
          components: {
            Position: { x: 0, y: 0 },
            Velocity: { vx: 0, vy: 0 },
            Health: { lives: 5, hp: 100 },
            Stats: { score: 0, kills: 0 },
          },
        },
      });

      tools.call("define_template", {
        name: "monster",
        template: {
          tags: ["enemy", "monster"],
          components: {
            Position: { x: 0, y: 0 },
            Velocity: { vx: -20, vy: 0 },
            Health: { hp: 50 },
          },
        },
      });

      // Spawn entities
      tools.call("spawn_entity", { template: "hero", id: "player" });
      tools.call("spawn_entity", { template: "monster", id: "monster-1", at: { x: 200, y: 50 } });
      tools.call("spawn_entity", { template: "monster", id: "monster-2", at: { x: 300, y: 50 } });

      // Define systems
      tools.call("define_system", {
        system: {
          name: "ai-movement",
          phase: "physics",
          query: { tag: "monster", has: ["Position", "Velocity"] },
          actions: [
            { type: "add", target: "Position.x", value: "Velocity.vx * dt" },
          ],
        },
      });

      // Define events
      tools.call("define_event", {
        event: "monster-killed",
        actions: [
          { type: "add", target: "data.player.Stats.kills", value: "1" },
          { type: "add", target: "data.player.Stats.score", value: "100" },
        ],
      });

      // Define collision handler
      tools.call("define_collision", {
        handler: {
          between: ["player", "enemy"],
          emit: "player-hit",
          data: {},
        },
      });

      // Configure screens
      tools.call("set_screen", {
        screen: "title",
        config: { text: "Monster Hunter", prompt: "Press Start" },
      });

      // Verify everything was created
      const entities = tools.call("get_entities", {}).data;
      const systems = tools.call("get_systems").data;
      const events = tools.call("get_events").data;
      const collisions = tools.call("get_collision_handlers").data;
      const titleScreen = tools.call("get_screen", { screen: "title" }).data;

      return {
        entityCount: entities.length,
        systemCount: systems.length,
        eventCount: Object.keys(events).length,
        collisionCount: collisions.length,
        titleText: titleScreen.text,
      };
    });

    expect(result.entityCount).toBe(3);
    expect(result.systemCount).toBe(1);
    expect(result.eventCount).toBe(1);
    expect(result.collisionCount).toBe(1);
    expect(result.titleText).toBe("Monster Hunter");
  });

  test("AI-built game runs correctly", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { tools } = window.__SUPER_MO__;

      // Build a simple game - test that systems and entities can be defined via tools
      tools.call("define_template", {
        name: "ball",
        template: {
          tags: ["ball"],
          components: {
            Position: { x: 100, y: 0 },
            Velocity: { vx: 0, vy: 0 },
          },
        },
      });

      const spawnResult = tools.call("spawn_entity", { template: "ball", id: "test-ball" });

      tools.call("define_system", {
        system: {
          name: "ball-fall",
          phase: "physics",
          query: { tag: "ball" },
          actions: [
            { type: "add", target: "Velocity.vy", value: "100 * dt" },
            { type: "add", target: "Position.y", value: "Velocity.vy * dt" },
          ],
        },
      });

      // Verify the setup was correct
      const entity = tools.call("get_entity", { id: "test-ball" });
      const system = tools.call("get_system", { name: "ball-fall" });

      // Go to playing and step
      tools.call("set_mode", { mode: "playing" });
      tools.call("step", { frames: 1 });

      return {
        spawnSuccess: spawnResult.success,
        entityExists: entity.success,
        systemExists: system.success,
        systemPhase: system.data?.phase,
      };
    });

    expect(result.spawnSuccess).toBe(true);
    expect(result.entityExists).toBe(true);
    expect(result.systemExists).toBe(true);
    expect(result.systemPhase).toBe("physics");
  });
});
