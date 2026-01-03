import { test, expect } from "@playwright/test";

/**
 * Phase 9: Screens and Modes Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Modes and Screens", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test.describe("get_mode", () => {
    test("returns current mode", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_mode").data;
      });

      expect(result).toBe("title"); // Default initial mode
    });
  });

  test.describe("set_mode", () => {
    test("changes current mode", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        const before = tools.call("get_mode").data;
        tools.call("set_mode", { mode: "playing" });
        const after = tools.call("get_mode").data;

        return { before, after };
      });

      expect(result.before).toBe("title");
      expect(result.after).toBe("playing");
    });
  });

  test.describe("define_transition", () => {
    test("adds a transition rule", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_transition", {
          from: "custom-mode",
          trigger: "custom-trigger",
          to: "custom-dest",
        });

        return tools.call("get_transitions", { from: "custom-mode" }).data;
      });

      expect(result["custom-trigger"]).toBe("custom-dest");
    });

    test("replaces existing transition", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_transition", { from: "a", trigger: "go", to: "b" });
        tools.call("define_transition", { from: "a", trigger: "go", to: "c" });

        return tools.call("get_transitions", { from: "a" }).data;
      });

      expect(result.go).toBe("c");
    });
  });

  test.describe("remove_transition", () => {
    test("removes a transition rule", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_transition", { from: "x", trigger: "y", to: "z" });
        const before = tools.call("get_transitions", { from: "x" }).data;

        tools.call("remove_transition", { from: "x", trigger: "y" });
        const after = tools.call("get_transitions", { from: "x" }).data;

        return { before, after };
      });

      expect(result.before.y).toBe("z");
      expect(result.after.y).toBeUndefined();
    });
  });

  test.describe("trigger_transition", () => {
    test("transitions to new mode when valid", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Start in title mode (default)
        // Default transition: title -> start -> intro
        const result = tools.call("trigger_transition", { trigger: "start" });

        return {
          triggered: result.data.triggered,
          currentMode: result.data.currentMode,
        };
      });

      expect(result.triggered).toBe(true);
      expect(result.currentMode).toBe("intro");
    });

    test("returns false for invalid trigger", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("trigger_transition", { trigger: "invalid-trigger" }).data;
      });

      expect(result.triggered).toBe(false);
      expect(result.currentMode).toBe("title"); // Still in title
    });

    test("transitions chain correctly", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        const modes = [];

        modes.push(tools.call("get_mode").data);

        tools.call("trigger_transition", { trigger: "start" });
        modes.push(tools.call("get_mode").data);

        tools.call("trigger_transition", { trigger: "start" });
        modes.push(tools.call("get_mode").data);

        return modes;
      });

      expect(result).toEqual(["title", "intro", "playing"]);
    });
  });

  test.describe("get_transitions", () => {
    test("returns all transitions when no from specified", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_transitions").data;
      });

      expect(result.title).toBeDefined();
      expect(result.title.start).toBe("intro");
      expect(result.playing).toBeDefined();
    });

    test("returns transitions from specific mode", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_transitions", { from: "playing" }).data;
      });

      expect(result.pause).toBe("paused");
      expect(result.complete).toBe("complete");
      expect(result.die).toBe("gameover");
    });
  });

  test.describe("get_available_triggers", () => {
    test("returns available triggers from current mode", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // In title mode
        const titleTriggers = tools.call("get_available_triggers").data;

        // Move to playing mode
        tools.call("set_mode", { mode: "playing" });
        const playingTriggers = tools.call("get_available_triggers").data;

        return { titleTriggers, playingTriggers };
      });

      expect(result.titleTriggers).toContain("start");
      expect(result.playingTriggers).toContain("pause");
      expect(result.playingTriggers).toContain("complete");
      expect(result.playingTriggers).toContain("die");
    });
  });

  test.describe("get_screen", () => {
    test("returns screen configuration", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_screen", { screen: "title" }).data;
      });

      expect(result.text).toBe("Super Mo");
      expect(result.prompt).toBe("Press Enter to Start");
    });

    test("returns error for non-existent screen", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_screen", { screen: "nonexistent" });
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Screen not found");
    });
  });

  test.describe("set_screen", () => {
    test("sets screen configuration", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("set_screen", {
          screen: "custom",
          config: { title: "Custom Screen", description: "A custom screen" },
        });

        return tools.call("get_screen", { screen: "custom" }).data;
      });

      expect(result.title).toBe("Custom Screen");
      expect(result.description).toBe("A custom screen");
    });

    test("replaces existing screen", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("set_screen", {
          screen: "title",
          config: { text: "New Title", prompt: "New Prompt" },
        });

        return tools.call("get_screen", { screen: "title" }).data;
      });

      expect(result.text).toBe("New Title");
      expect(result.prompt).toBe("New Prompt");
    });
  });

  test.describe("update_screen", () => {
    test("updates a screen property", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        const before = tools.call("get_screen", { screen: "complete" }).data;
        tools.call("update_screen", {
          screen: "complete",
          property: "message",
          value: "You Won!",
        });
        const after = tools.call("get_screen", { screen: "complete" }).data;

        return { before: before.message, after: after.message };
      });

      expect(result.before).toBe("Level Complete!");
      expect(result.after).toBe("You Won!");
    });

    test("returns error for non-existent screen", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("update_screen", {
          screen: "nonexistent",
          property: "foo",
          value: "bar",
        });
      });

      expect(result.success).toBe(false);
    });
  });

  test.describe("get_screens", () => {
    test("returns all screens", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("get_screens").data;
      });

      expect(result.title).toBeDefined();
      expect(result.intro).toBeDefined();
      expect(result.complete).toBeDefined();
    });
  });

  test.describe("setMode action", () => {
    test("setMode action changes mode", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("execute_action", {
          action: { type: "setMode", mode: "gameover" },
        });

        return tools.call("get_mode").data;
      });

      expect(result).toBe("gameover");
    });
  });

  test("modes and screens tools are listed", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map((t) => t.name);
    });

    expect(tools).toContain("set_mode");
    expect(tools).toContain("define_transition");
    expect(tools).toContain("remove_transition");
    expect(tools).toContain("trigger_transition");
    expect(tools).toContain("get_transitions");
    expect(tools).toContain("get_available_triggers");
    expect(tools).toContain("get_screen");
    expect(tools).toContain("set_screen");
    expect(tools).toContain("update_screen");
    expect(tools).toContain("get_screens");
  });
});
