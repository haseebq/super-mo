import { test, expect } from "@playwright/test";

/**
 * Phase 7: Event System Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Events", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test.describe("define_event", () => {
    test("adds an event handler", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        const before = tools.call("get_events").data.length;

        tools.call("define_event", {
          event: "coin-collected",
          actions: [
            { type: "add", target: "rules.scoring.coinValue", value: "10" },
          ],
        });

        const after = tools.call("get_events").data.length;
        const handler = tools.call("get_event", { event: "coin-collected" });

        return { before, after, handler: handler.data };
      });

      expect(result.before).toBe(0);
      expect(result.after).toBe(1);
      expect(result.handler.event).toBe("coin-collected");
      expect(result.handler.actions.length).toBe(1);
    });

    test("replaces existing handler", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_event", {
          event: "test-event",
          actions: [{ type: "emit", event: "v1" }],
        });

        tools.call("define_event", {
          event: "test-event",
          actions: [{ type: "emit", event: "v2" }],
        });

        const handlers = tools.call("get_events").data;
        const handler = tools.call("get_event", { event: "test-event" }).data;

        return { count: handlers.length, action: handler.actions[0] };
      });

      expect(result.count).toBe(1);
      expect(result.action.event).toBe("v2");
    });
  });

  test.describe("remove_event", () => {
    test("removes an event handler", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_event", {
          event: "to-remove",
          actions: [],
        });

        const before = tools.call("get_events").data.length;
        tools.call("remove_event", { event: "to-remove" });
        const after = tools.call("get_events").data.length;

        return { before, after };
      });

      expect(result.before).toBe(1);
      expect(result.after).toBe(0);
    });
  });

  test.describe("trigger_event", () => {
    test("executes event handler actions", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Define an event that modifies rules
        tools.call("define_event", {
          event: "add-score",
          actions: [
            { type: "add", target: "rules.scoring.coinValue", value: "50" },
          ],
        });

        const before = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        // Trigger the event
        tools.call("trigger_event", { event: "add-score" });

        const after = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        return { before, after };
      });

      expect(result.before).toBe(100); // Initial value
      expect(result.after).toBe(150); // After adding 50
    });

    test("returns trigger result with emitted events", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_event", {
          event: "parent-event",
          actions: [
            { type: "emit", event: "child-event-1" },
            { type: "emit", event: "child-event-2" },
          ],
        });

        return tools.call("trigger_event", { event: "parent-event" }).data;
      });

      expect(result.triggered).toBe(true);
      expect(result.actionsExecuted).toBe(2);
      expect(result.eventsEmitted).toContain("child-event-1");
      expect(result.eventsEmitted).toContain("child-event-2");
    });

    test("returns not triggered for unknown event", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("trigger_event", { event: "unknown-event" }).data;
      });

      expect(result.triggered).toBe(false);
      expect(result.actionsExecuted).toBe(0);
    });
  });

  test.describe("process_events", () => {
    test("processes multiple events", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_event", {
          event: "event-a",
          actions: [{ type: "add", target: "rules.scoring.coinValue", value: "10" }],
        });

        tools.call("define_event", {
          event: "event-b",
          actions: [{ type: "add", target: "rules.scoring.coinValue", value: "20" }],
        });

        const before = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        tools.call("process_events", {
          events: [
            { event: "event-a" },
            { event: "event-b" },
          ],
        });

        const after = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        return { before, after };
      });

      expect(result.before).toBe(100);
      expect(result.after).toBe(130); // 100 + 10 + 20
    });

    test("supports event chaining", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // First event emits second event
        tools.call("define_event", {
          event: "chain-start",
          actions: [
            { type: "add", target: "rules.scoring.coinValue", value: "1" },
            { type: "emit", event: "chain-middle" },
          ],
        });

        // Second event emits third event
        tools.call("define_event", {
          event: "chain-middle",
          actions: [
            { type: "add", target: "rules.scoring.coinValue", value: "10" },
            { type: "emit", event: "chain-end" },
          ],
        });

        // Third event
        tools.call("define_event", {
          event: "chain-end",
          actions: [
            { type: "add", target: "rules.scoring.coinValue", value: "100" },
          ],
        });

        const before = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        const processResult = tools.call("process_events", {
          events: [{ event: "chain-start" }],
        });

        const after = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        return { before, after, processed: processResult.data };
      });

      expect(result.before).toBe(100);
      expect(result.after).toBe(211); // 100 + 1 + 10 + 100
      expect(result.processed.eventsProcessed.length).toBe(3);
    });
  });

  test.describe("when action in events", () => {
    test("conditional branching works", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_event", {
          event: "conditional-event",
          actions: [
            {
              type: "when",
              condition: "data.value > 50",
              then: [{ type: "set", target: "rules.scoring.coinValue", value: "999" }],
              else: [{ type: "set", target: "rules.scoring.coinValue", value: "1" }],
            },
          ],
        });

        // Trigger with value > 50
        tools.call("trigger_event", { event: "conditional-event", data: { value: 100 } });
        const high = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        // Trigger with value <= 50
        tools.call("trigger_event", { event: "conditional-event", data: { value: 10 } });
        const low = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        return { high, low };
      });

      expect(result.high).toBe(999);
      expect(result.low).toBe(1);
    });
  });

  test.describe("step() integration", () => {
    test("step() processes emitted events", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create entity and system that emits event
        tools.call("create_entity", {
          id: "player",
          tags: ["player"],
          components: {},
        });

        tools.call("define_system", {
          system: {
            name: "emit-score",
            phase: "update",
            query: { tag: "player" },
            actions: [{ type: "emit", event: "score-event" }],
          },
        });

        // Define event handler
        tools.call("define_event", {
          event: "score-event",
          actions: [
            { type: "add", target: "rules.scoring.coinValue", value: "1" },
          ],
        });

        const before = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        // Step should emit and process the event
        const stepResult = tools.call("step", { frames: 1 });

        const after = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        return { before, after, stepResult: stepResult.data };
      });

      expect(result.before).toBe(100);
      expect(result.after).toBe(101);
      expect(result.stepResult.eventsProcessed).toBeGreaterThan(0);
    });

    test("collision events trigger handlers", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        // Create overlapping entities
        tools.call("create_entity", {
          id: "player",
          tags: [],
          components: {
            Position: { x: 0, y: 0 },
            Collider: { width: 32, height: 32, layer: "player" },
          },
        });

        tools.call("create_entity", {
          id: "coin",
          tags: [],
          components: {
            Position: { x: 10, y: 10 },
            Collider: { width: 16, height: 16, layer: "collectible" },
          },
        });

        // Define collision that emits event
        tools.call("define_collision", {
          handler: { between: ["player", "collectible"], emit: "coin-touched" },
        });

        // Define event handler
        tools.call("define_event", {
          event: "coin-touched",
          actions: [
            { type: "add", target: "rules.scoring.coinValue", value: "100" },
          ],
        });

        const before = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        // Step should detect collision, emit event, and process it
        tools.call("step", { frames: 1 });

        const after = tools.call("query_state", { path: "rules.scoring.coinValue" }).data;

        return { before, after };
      });

      expect(result.before).toBe(100);
      expect(result.after).toBe(200);
    });
  });

  test.describe("get_events_log", () => {
    test("returns event handler summary", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;

        tools.call("define_event", {
          event: "event-1",
          actions: [{ type: "emit", event: "x" }],
        });

        tools.call("define_event", {
          event: "event-2",
          actions: [
            { type: "emit", event: "x" },
            { type: "emit", event: "y" },
            { type: "emit", event: "z" },
          ],
        });

        return tools.call("get_events_log").data;
      });

      expect(result.length).toBe(2);
      expect(result.find((e) => e.event === "event-1").actionCount).toBe(1);
      expect(result.find((e) => e.event === "event-2").actionCount).toBe(3);
    });
  });

  test("event tools are listed", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map((t) => t.name);
    });

    expect(tools).toContain("define_event");
    expect(tools).toContain("remove_event");
    expect(tools).toContain("get_event");
    expect(tools).toContain("get_events");
    expect(tools).toContain("trigger_event");
    expect(tools).toContain("process_events");
    expect(tools).toContain("get_events_log");
  });
});
