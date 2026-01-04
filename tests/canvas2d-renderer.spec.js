import { test, expect } from "@playwright/test";

/**
 * Phase 12: Canvas2D Renderer Tests
 *
 * Tests the visual Canvas2D renderer.
 * Verifies that entities appear on screen and overlays work.
 */

test.describe("Canvas2D Renderer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("can create Canvas2D renderer from canvas element", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");
      return {
        hasRender: typeof renderer.render === "function",
        hasSetCamera: typeof renderer.setCamera === "function",
        hasFollowEntity: typeof renderer.followEntity === "function",
        hasDestroy: typeof renderer.destroy === "function",
      };
    });

    expect(result.hasRender).toBe(true);
    expect(result.hasSetCamera).toBe(true);
    expect(result.hasFollowEntity).toBe(true);
    expect(result.hasDestroy).toBe(true);
  });

  test("throws error for non-existent canvas", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById } = window.__SUPER_MO__;
      try {
        createCanvas2DRendererById("non-existent-canvas");
        return { threw: false };
      } catch (e) {
        return { threw: true, message: e.message };
      }
    });

    expect(result.threw).toBe(true);
    expect(result.message).toContain("not found");
  });

  test("render does not throw", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");
      try {
        renderer.render(engine.getState());
        return { success: true };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    expect(result.success).toBe(true);
  });

  test("renders entities with position", async ({ page }) => {
    // Render entities and verify canvas has non-blank pixels
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      // Create an entity
      tools.call("create_entity", {
        id: "render-test-entity",
        tags: ["player"],
        components: {
          Position: { x: 100, y: 50 },
          Collider: { width: 16, height: 16 },
        },
      });

      // Switch to playing mode (no overlay)
      tools.call("set_mode", { mode: "playing" });

      // Render
      renderer.render(engine.getState());

      // Check that canvas has content
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Count non-black pixels
      let nonBlackPixels = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i];
        const g = imageData.data[i + 1];
        const b = imageData.data[i + 2];
        const a = imageData.data[i + 3];
        if (a > 0 && (r > 30 || g > 30 || b > 30)) {
          nonBlackPixels++;
        }
      }

      return {
        hasContent: nonBlackPixels > 100,
        nonBlackPixels,
      };
    });

    expect(result.hasContent).toBe(true);
  });

  test("renders screen overlay for title mode", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      // Ensure in title mode
      tools.call("set_mode", { mode: "title" });

      // Render
      renderer.render(engine.getState());

      // Check canvas has dark overlay
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");

      // Sample center pixel - should be dark (overlay)
      const centerData = ctx.getImageData(
        canvas.width / 2,
        canvas.height / 2,
        1,
        1
      );
      const r = centerData.data[0];
      const g = centerData.data[1];
      const b = centerData.data[2];

      // Check corners for dark overlay
      const cornerData = ctx.getImageData(10, 10, 1, 1);

      return {
        centerIsDark: r < 50 && g < 50 && b < 50,
        hasContent: true,
      };
    });

    expect(result.centerIsDark).toBe(true);
  });

  test("getDimensions returns canvas size", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");
      return renderer.getDimensions();
    });

    expect(result.width).toBe(320);
    expect(result.height).toBe(180);
  });

  test("getCamera returns camera state", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");
      const camera = renderer.getCamera();
      return {
        hasX: typeof camera.x === "number",
        hasY: typeof camera.y === "number",
        hasWidth: typeof camera.width === "number",
        hasHeight: typeof camera.height === "number",
        hasScale: typeof camera.scale === "number",
      };
    });

    expect(result.hasX).toBe(true);
    expect(result.hasY).toBe(true);
    expect(result.hasWidth).toBe(true);
    expect(result.hasHeight).toBe(true);
    expect(result.hasScale).toBe(true);
  });

  test("setCamera updates camera position", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      renderer.setCamera(100, 50);
      const camera = renderer.getCamera();

      return { x: camera.x, y: camera.y };
    });

    expect(result.x).toBe(100);
    expect(result.y).toBe(50);
  });

  test("setScale updates camera zoom", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      renderer.setScale(2);
      const camera = renderer.getCamera();

      return { scale: camera.scale };
    });

    expect(result.scale).toBe(2);
  });

  test("setScale clamps to valid range", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      renderer.setScale(100); // Too large
      const tooLarge = renderer.getCamera().scale;

      renderer.setScale(0.001); // Too small
      const tooSmall = renderer.getCamera().scale;

      return { tooLarge, tooSmall };
    });

    expect(result.tooLarge).toBe(10); // Clamped to max
    expect(result.tooSmall).toBe(0.1); // Clamped to min
  });

  test("followEntity centers camera on entity", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      // Create entity at specific position
      tools.call("create_entity", {
        id: "camera-target",
        tags: [],
        components: {
          Position: { x: 200, y: 100 },
        },
      });

      // Get entity and follow it
      const entities = tools.call("get_entities", {}).data;
      const target = entities.find(e => e.id === "camera-target");

      renderer.followEntity(target);
      const camera = renderer.getCamera();

      // Camera should be centered on entity
      // With 320x180 canvas, camera x should be 200 - 160 = 40
      return {
        x: camera.x,
        y: camera.y,
      };
    });

    // Entity at 200,100 with canvas 320x180
    // Camera should be at: 200 - 160 = 40, 100 - 90 = 10
    expect(result.x).toBe(40);
    expect(result.y).toBe(10);
  });

  test("destroy clears the canvas", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      // Render something
      renderer.render(engine.getState());

      // Get pixel data before destroy
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");

      // Destroy
      renderer.destroy();

      // Check if canvas is cleared (all pixels should be transparent/black)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonClearPixels = 0;
      for (let i = 0; i < imageData.data.length; i += 4) {
        if (imageData.data[i + 3] > 0) { // alpha > 0
          nonClearPixels++;
        }
      }

      return { cleared: nonClearPixels === 0 };
    });

    expect(result.cleared).toBe(true);
  });
});

test.describe("Canvas2D Renderer - Level Tiles", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("renders level tiles", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      // Set up a level with tiles
      const state = engine.getState();
      state.level = {
        tiles: [
          [0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0],
          [1, 1, 1, 1, 1], // Ground row
        ],
        width: 5,
        height: 3,
      };
      tools.call("load_state", { state });

      // Switch to playing mode
      tools.call("set_mode", { mode: "playing" });

      // Render
      renderer.render(engine.getState());

      // Check that tiles are rendered (brown color at bottom)
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");

      // Sample tile area (around y=32 for third row of 16px tiles)
      const tileData = ctx.getImageData(8, 36, 1, 1);
      const r = tileData.data[0];
      const g = tileData.data[1];
      const b = tileData.data[2];

      // Tile color is #6b4423 (brown)
      const isBrown = r > 80 && r < 120 && g > 50 && g < 90 && b > 20 && b < 50;

      return { hasTiles: isBrown, rgb: [r, g, b] };
    });

    expect(result.hasTiles).toBe(true);
  });
});

test.describe("Canvas2D Renderer - Screen Types", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("renders intro screen", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      tools.call("set_mode", { mode: "intro" });
      renderer.render(engine.getState());

      return { success: true };
    });

    expect(result.success).toBe(true);
  });

  test("renders complete screen", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      tools.call("set_mode", { mode: "complete" });
      renderer.render(engine.getState());

      return { success: true };
    });

    expect(result.success).toBe(true);
  });

  test("renders gameover screen", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      tools.call("set_mode", { mode: "gameover" });
      renderer.render(engine.getState());

      return { success: true };
    });

    expect(result.success).toBe(true);
  });

  test("renders HUD in playing mode", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      // Create player with stats
      tools.call("create_entity", {
        id: "hud-test-player",
        tags: ["player"],
        components: {
          Position: { x: 50, y: 50 },
          Stats: { score: 1234, coins: 10 },
          Health: { lives: 2 },
        },
      });

      tools.call("set_mode", { mode: "playing" });
      renderer.render(engine.getState());

      // Check HUD bar area (top of screen)
      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");

      // Sample HUD area
      const hudData = ctx.getImageData(10, 5, 1, 1);

      // HUD should have some content (not pure background)
      return {
        hasHUD: hudData.data[3] > 0, // Has alpha
      };
    });

    expect(result.hasHUD).toBe(true);
  });
});

test.describe("Canvas2D Renderer - Entity Colors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("player entity renders with blue color", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      tools.call("create_entity", {
        id: "color-test-player",
        tags: ["player"],
        components: {
          Position: { x: 50, y: 50 },
          Collider: { width: 16, height: 16 },
        },
      });

      tools.call("set_mode", { mode: "playing" });
      renderer.render(engine.getState());

      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");

      // Sample entity area
      const data = ctx.getImageData(55, 55, 1, 1);
      const r = data.data[0];
      const g = data.data[1];
      const b = data.data[2];

      // Player color is #4a90d9 (blue)
      const isBlue = b > r && b > g;

      return { isBlue, rgb: [r, g, b] };
    });

    expect(result.isBlue).toBe(true);
  });

  test("enemy entity renders with red color", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      tools.call("create_entity", {
        id: "color-test-enemy",
        tags: ["enemy"],
        components: {
          Position: { x: 100, y: 50 },
          Collider: { width: 16, height: 16 },
        },
      });

      tools.call("set_mode", { mode: "playing" });
      renderer.render(engine.getState());

      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");

      // Sample entity area
      const data = ctx.getImageData(105, 55, 1, 1);
      const r = data.data[0];
      const g = data.data[1];
      const b = data.data[2];

      // Enemy color is #d94a4a (red)
      const isRed = r > g && r > b;

      return { isRed, rgb: [r, g, b] };
    });

    expect(result.isRed).toBe(true);
  });

  test("coin entity renders with gold color", async ({ page }) => {
    const result = await page.evaluate(() => {
      const { createCanvas2DRendererById, engine, tools } = window.__SUPER_MO__;
      const renderer = createCanvas2DRendererById("game");

      tools.call("create_entity", {
        id: "color-test-coin",
        tags: ["coin"],
        components: {
          Position: { x: 150, y: 50 },
          Collider: { width: 8, height: 8 },
        },
      });

      tools.call("set_mode", { mode: "playing" });
      renderer.render(engine.getState());

      const canvas = document.getElementById("game");
      const ctx = canvas.getContext("2d");

      // Sample entity area
      const data = ctx.getImageData(152, 52, 1, 1);
      const r = data.data[0];
      const g = data.data[1];
      const b = data.data[2];

      // Coin color is #ffd700 (gold - high R, high G, low B)
      const isGold = r > 200 && g > 150 && b < 50;

      return { isGold, rgb: [r, g, b] };
    });

    expect(result.isGold).toBe(true);
  });
});
