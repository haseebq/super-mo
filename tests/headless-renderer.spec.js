import { test, expect } from "@playwright/test";

/**
 * Phase 11: Headless Renderer Tests
 *
 * Tests the headless renderer that logs what would be drawn.
 * Used for testing without visual output.
 */

test.describe("Headless Renderer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("can create headless renderer", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();
      return {
        hasRender: typeof renderer.render === "function",
        hasGetRenderLog: typeof renderer.getRenderLog === "function",
        hasGetRenderedEntities: typeof renderer.getRenderedEntities === "function",
        hasGetRenderedScreen: typeof renderer.getRenderedScreen === "function",
      };
    });

    expect(result.hasRender).toBe(true);
    expect(result.hasGetRenderLog).toBe(true);
    expect(result.hasGetRenderedEntities).toBe(true);
    expect(result.hasGetRenderedScreen).toBe(true);
  });

  test("render receives state and logs entries", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Render current state
      renderer.render(engine.getState());

      const log = renderer.getRenderLog();
      return {
        logLength: log.length,
        hasHudEntry: log.some(e => e.type === "hud"),
      };
    });

    expect(result.logLength).toBeGreaterThan(0);
    expect(result.hasHudEntry).toBe(true);
  });

  test("logs screen for non-playing modes", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Should start in "title" mode
      renderer.render(engine.getState());

      const screen = renderer.getRenderedScreen();
      return {
        hasScreen: screen !== null,
        screenType: screen?.screenType,
        mode: screen?.mode,
        hasConfig: screen?.config !== undefined,
      };
    });

    expect(result.hasScreen).toBe(true);
    expect(result.screenType).toBe("title");
    expect(result.mode).toBe("title");
    expect(result.hasConfig).toBe(true);
  });

  test("no screen logged in playing mode", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Switch to playing mode
      tools.call("set_mode", { mode: "playing" });

      renderer.render(engine.getState());

      return {
        screen: renderer.getRenderedScreen(),
        mode: engine.getMode(),
      };
    });

    expect(result.mode).toBe("playing");
    expect(result.screen).toBeNull();
  });

  test("logs entities with position", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Create entity with Position
      tools.call("create_entity", {
        id: "test-entity-1",
        tags: ["test"],
        components: {
          Position: { x: 100, y: 200 },
        },
      });

      renderer.render(engine.getState());

      const entities = renderer.getRenderedEntities();
      const testEntity = entities.find(e => e.id === "test-entity-1");

      return {
        entityCount: entities.length,
        hasTestEntity: testEntity !== undefined,
        position: testEntity?.position,
        tags: testEntity?.tags,
      };
    });

    expect(result.entityCount).toBeGreaterThan(0);
    expect(result.hasTestEntity).toBe(true);
    expect(result.position).toEqual({ x: 100, y: 200 });
    expect(result.tags).toEqual(["test"]);
  });

  test("logs entities with sprite component", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Create entity with Position and Sprite
      tools.call("create_entity", {
        id: "sprite-entity",
        tags: ["player"],
        components: {
          Position: { x: 50, y: 50 },
          Sprite: { sheet: "player", animation: "idle", frame: 0 },
        },
      });

      renderer.render(engine.getState());

      const entities = renderer.getRenderedEntities();
      const spriteEntity = entities.find(e => e.id === "sprite-entity");

      return {
        hasSprite: spriteEntity?.sprite !== undefined,
        sprite: spriteEntity?.sprite,
      };
    });

    expect(result.hasSprite).toBe(true);
    expect(result.sprite).toEqual({
      sheet: "player",
      animation: "idle",
      frame: 0,
    });
  });

  test("logs entities with collider component", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Create entity with Collider
      tools.call("create_entity", {
        id: "collider-entity",
        tags: ["solid"],
        components: {
          Position: { x: 0, y: 0 },
          Collider: { width: 16, height: 32, layer: "player" },
        },
      });

      renderer.render(engine.getState());

      const entities = renderer.getRenderedEntities();
      const colliderEntity = entities.find(e => e.id === "collider-entity");

      return {
        hasCollider: colliderEntity?.collider !== undefined,
        collider: colliderEntity?.collider,
      };
    });

    expect(result.hasCollider).toBe(true);
    expect(result.collider).toEqual({ width: 16, height: 32 });
  });

  test("clearRenderLog clears the log", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // First render
      renderer.render(engine.getState());
      const logAfterRender = renderer.getRenderLog().length;

      // Clear
      renderer.clearRenderLog();
      const logAfterClear = renderer.getRenderLog().length;
      const entitiesAfterClear = renderer.getRenderedEntities().length;
      const screenAfterClear = renderer.getRenderedScreen();

      return {
        logAfterRender,
        logAfterClear,
        entitiesAfterClear,
        screenAfterClear,
      };
    });

    expect(result.logAfterRender).toBeGreaterThan(0);
    expect(result.logAfterClear).toBe(0);
    expect(result.entitiesAfterClear).toBe(0);
    expect(result.screenAfterClear).toBeNull();
  });

  test("wasEntityRendered helper works", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      tools.call("create_entity", {
        id: "check-entity",
        tags: ["test"],
        components: { Position: { x: 0, y: 0 } },
      });

      renderer.render(engine.getState());

      return {
        existingEntity: renderer.wasEntityRendered("check-entity"),
        nonExistingEntity: renderer.wasEntityRendered("non-existing"),
      };
    });

    expect(result.existingEntity).toBe(true);
    expect(result.nonExistingEntity).toBe(false);
  });

  test("wasScreenRendered helper works", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Render in title mode
      renderer.render(engine.getState());

      return {
        titleRendered: renderer.wasScreenRendered("title"),
        introRendered: renderer.wasScreenRendered("intro"),
        completeRendered: renderer.wasScreenRendered("complete"),
      };
    });

    expect(result.titleRendered).toBe(true);
    expect(result.introRendered).toBe(false);
    expect(result.completeRendered).toBe(false);
  });

  test("getSummary returns render summary", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Add some entities
      tools.call("create_entity", {
        id: "summary-entity-1",
        tags: [],
        components: { Position: { x: 0, y: 0 } },
      });
      tools.call("create_entity", {
        id: "summary-entity-2",
        tags: [],
        components: { Position: { x: 10, y: 10 } },
      });

      renderer.render(engine.getState());

      return renderer.getSummary();
    });

    expect(result.entityCount).toBe(2);
    expect(result.screen).toBe("title");
    expect(result.mode).toBe("title");
    expect(result.frame).toBe(0);
  });

  test("getLogEntriesOfType filters by type", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      tools.call("create_entity", {
        id: "type-test-entity",
        tags: [],
        components: { Position: { x: 0, y: 0 } },
      });

      renderer.render(engine.getState());

      return {
        entityEntries: renderer.getLogEntriesOfType("entity").length,
        screenEntries: renderer.getLogEntriesOfType("screen").length,
        hudEntries: renderer.getLogEntriesOfType("hud").length,
        levelEntries: renderer.getLogEntriesOfType("level").length,
      };
    });

    expect(result.entityEntries).toBe(1);
    expect(result.screenEntries).toBe(1); // Title screen
    expect(result.hudEntries).toBe(1);
    expect(result.levelEntries).toBe(0); // No level tiles
  });

  test("logs level data when tiles present", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Get state and modify level directly for testing
      const state = engine.getState();
      state.level = {
        tiles: [[1, 1, 1], [0, 0, 0], [1, 0, 1]],
        width: 3,
        height: 3,
      };
      tools.call("load_state", { state });

      renderer.render(engine.getState());

      const levelEntries = renderer.getLogEntriesOfType("level");
      return {
        hasLevelEntry: levelEntries.length > 0,
        levelData: levelEntries[0]?.data,
      };
    });

    expect(result.hasLevelEntry).toBe(true);
    expect(result.levelData).toEqual({
      width: 3,
      height: 3,
      tileCount: 5, // Five non-zero tiles
    });
  });

  test("logs HUD with player stats", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Create player with stats
      tools.call("create_entity", {
        id: "player-1",
        tags: ["player"],
        components: {
          Position: { x: 50, y: 100 },
          Stats: { score: 1000, coins: 5 },
          Health: { lives: 3 },
        },
      });

      renderer.render(engine.getState());

      const hudEntries = renderer.getLogEntriesOfType("hud");
      return {
        hasHudEntry: hudEntries.length > 0,
        hudData: hudEntries[0]?.data,
      };
    });

    expect(result.hasHudEntry).toBe(true);
    expect(result.hudData.score).toBe(1000);
    expect(result.hudData.coins).toBe(5);
    expect(result.hudData.lives).toBe(3);
  });

  test("screen config includes screen data", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      // Set custom screen config
      tools.call("set_screen", {
        screen: "title",
        config: { text: "My Custom Game", prompt: "Click to Play" },
      });

      renderer.render(engine.getState());

      const screen = renderer.getRenderedScreen();
      return {
        screenConfig: screen?.config,
      };
    });

    expect(result.screenConfig).toEqual({
      text: "My Custom Game",
      prompt: "Click to Play",
    });
  });

  test("destroy clears all state", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();

      tools.call("create_entity", {
        id: "destroy-test",
        tags: [],
        components: { Position: { x: 0, y: 0 } },
      });

      renderer.render(engine.getState());
      const beforeDestroy = renderer.getRenderLog().length;

      renderer.destroy();

      return {
        beforeDestroy,
        afterDestroy: renderer.getRenderLog().length,
      };
    });

    expect(result.beforeDestroy).toBeGreaterThan(0);
    expect(result.afterDestroy).toBe(0);
  });
});

test.describe("Headless Renderer - Mode Screens", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("renders correct screen for each mode", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createHeadlessRenderer, engine, tools } = window.__SUPER_MO__;
      const renderer = createHeadlessRenderer();
      const screens = {};

      // Test each mode
      const modes = ["title", "intro", "playing", "complete", "paused", "gameover"];

      for (const mode of modes) {
        tools.call("set_mode", { mode });
        renderer.render(engine.getState());
        screens[mode] = renderer.getRenderedScreen()?.screenType ?? null;
      }

      return screens;
    });

    expect(result.title).toBe("title");
    expect(result.intro).toBe("intro");
    expect(result.playing).toBeNull(); // No screen in playing mode
    expect(result.complete).toBe("complete");
    // paused maps to "playing" screen which doesn't exist, so null
    // gameover maps to "complete" screen
    expect(result.paused).toBeNull(); // "playing" screen doesn't exist
    expect(result.gameover).toBe("complete");
  });
});
