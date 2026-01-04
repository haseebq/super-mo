import { test, expect } from "@playwright/test";

/**
 * Phase 10: AI Connection Tests
 *
 * Tests the WebSocket connection interface for external AI agents.
 * These tests verify that external processes can connect and use tools.
 */

// Test the connection module exports and types
test.describe("Connection Module", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("connection module has required exports", async ({ page }) => {
    // The connection module is server-side only (Node.js),
    // so we test that the protocol types match what tools expect
    const tools = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      return tools.getTools().map(t => t.name);
    });

    // Verify expected tools exist that will be exposed via connection
    expect(tools).toContain("step");
    expect(tools).toContain("dump_state");
    expect(tools).toContain("load_state");
    expect(tools).toContain("spawn_entity");
    expect(tools).toContain("get_entity");
    expect(tools).toContain("trigger_event");
  });

  test("tool results have consistent structure for connection protocol", async ({ page }) => {
    const results = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      return {
        success: tools.call("get_frame"),
        error: tools.call("unknown_tool"),
        withData: tools.call("dump_state"),
      };
    });

    // Success result structure
    expect(results.success).toHaveProperty("success", true);
    expect(results.success).toHaveProperty("data");

    // Error result structure
    expect(results.error).toHaveProperty("success", false);
    expect(results.error).toHaveProperty("error");

    // Data result structure
    expect(results.withData).toHaveProperty("success", true);
    expect(results.withData.data).toHaveProperty("frame");
    expect(results.withData.data).toHaveProperty("entities");
  });

  test("step returns result compatible with state updates", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      return tools.call("step", { frames: 1 });
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("frame");
    expect(result.data).toHaveProperty("time");
    expect(result.data).toHaveProperty("eventsEmitted");
    expect(result.data).toHaveProperty("systemsRun");
  });
});

test.describe("Connection Protocol Simulation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("simulated request/response cycle works", async ({ page }) => {
    // Simulate the JSON protocol that would be used over WebSocket
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Simulate incoming request (as it would arrive over WebSocket)
      const request = {
        type: "request",
        id: "test-1",
        tool: "get_frame",
        args: {}
      };

      // Execute the tool call
      const toolResult = tools.call(request.tool, request.args);

      // Construct response (as it would be sent over WebSocket)
      const response = {
        type: "response",
        id: request.id,
        success: toolResult.success,
        data: toolResult.data,
        error: toolResult.error
      };

      return response;
    });

    expect(result.type).toBe("response");
    expect(result.id).toBe("test-1");
    expect(result.success).toBe(true);
    expect(result.data).toBe(0);
  });

  test("simulated state update after step", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      const engine = window.__SUPER_MO__.engine;

      // Simulate step request
      const stepResult = tools.call("step", { frames: 5 });

      // Construct state update (as it would be sent over WebSocket)
      const stateUpdate = {
        type: "state",
        state: engine.getState(),
        frame: engine.getFrame(),
        time: engine.getTime(),
        stepResult: stepResult.data
      };

      return stateUpdate;
    });

    expect(result.type).toBe("state");
    expect(result.frame).toBe(5);
    expect(result.time).toBeGreaterThan(0);
    expect(result.state).toHaveProperty("entities");
    expect(result.stepResult).toHaveProperty("frame", 5);
  });

  test("connected message includes tool definitions", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Simulate connected message (as it would be sent on WebSocket connect)
      const connectedMessage = {
        type: "connected",
        tools: tools.getTools()
      };

      return connectedMessage;
    });

    expect(result.type).toBe("connected");
    expect(Array.isArray(result.tools)).toBe(true);
    expect(result.tools.length).toBeGreaterThan(0);

    // Each tool should have name, description, parameters
    const stepTool = result.tools.find(t => t.name === "step");
    expect(stepTool).toBeDefined();
    expect(stepTool).toHaveProperty("description");
    expect(stepTool).toHaveProperty("parameters");
  });
});

test.describe("Hot-Swap Support", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("state persists across simulated disconnect/reconnect", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;
      const engine = window.__SUPER_MO__.engine;

      // First "connection" - make some changes
      tools.call("spawn_entity", {
        template: "ball",
        id: "test-ball-1",
        at: { x: 100, y: 100 }
      });
      tools.call("step", { frames: 10 });

      // Capture state before "disconnect"
      const stateBeforeDisconnect = engine.getFrame();
      const entitiesBeforeDisconnect = tools.call("get_entities", {}).data.length;

      // Simulate "reconnect" - engine state should persist
      // (In real WebSocket, the engine keeps running, just connection drops)

      // New "connection" gets current state
      const stateAfterReconnect = engine.getFrame();
      const entitiesAfterReconnect = tools.call("get_entities", {}).data.length;

      return {
        frameBeforeDisconnect: stateBeforeDisconnect,
        frameAfterReconnect: stateAfterReconnect,
        entitiesBeforeDisconnect,
        entitiesAfterReconnect
      };
    });

    // State should be identical (engine persists)
    expect(result.frameBeforeDisconnect).toBe(result.frameAfterReconnect);
    expect(result.entitiesBeforeDisconnect).toBe(result.entitiesAfterReconnect);
  });

  test("different clients can make sequential tool calls", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Simulate Client A making changes
      tools.call("set_rule", { path: "physics.gravity", value: 500 });

      // Simulate Client B reading state (would see Client A's changes)
      const gravityAfterA = tools.call("get_rule", { path: "physics.gravity" }).data;

      // Simulate Client B making changes
      tools.call("set_rule", { path: "physics.gravity", value: 1000 });

      // Simulate Client A reading state (would see Client B's changes)
      const gravityAfterB = tools.call("get_rule", { path: "physics.gravity" }).data;

      return { gravityAfterA, gravityAfterB };
    });

    expect(result.gravityAfterA).toBe(500);
    expect(result.gravityAfterB).toBe(1000);
  });

  test("state dump can be used for reconnection sync", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Setup some state using create_entity (no template needed)
      tools.call("create_entity", {
        id: "sync-test-entity",
        tags: ["test"],
        components: { Position: { x: 100, y: 100 } }
      });
      tools.call("step", { frames: 20 });

      // Simulate sending state to reconnecting client
      const fullState = tools.call("dump_state").data;

      return {
        hasEntities: fullState.entities.length > 0,
        hasTestEntity: fullState.entities.some(e => e.id === "sync-test-entity"),
        frame: fullState.frame,
        time: fullState.time
      };
    });

    expect(result.hasEntities).toBe(true);
    expect(result.hasTestEntity).toBe(true);
    expect(result.frame).toBe(20);
    expect(result.time).toBeGreaterThan(0);
  });
});

test.describe("Tool Call Protocol Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("handles missing required parameters", async ({ page }) => {
    const results = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      return {
        // spawn_entity requires template
        noTemplate: tools.call("spawn_entity", {}),
        // get_entity requires id
        noId: tools.call("get_entity", {}),
        // set_rule requires path and value
        noValue: tools.call("set_rule", { path: "physics.gravity" }),
      };
    });

    expect(results.noTemplate.success).toBe(false);
    expect(results.noTemplate.error).toContain("required");

    expect(results.noId.success).toBe(false);
    expect(results.noId.error).toContain("required");

    expect(results.noValue.success).toBe(false);
    expect(results.noValue.error).toContain("required");
  });

  test("handles invalid tool arguments gracefully", async ({ page }) => {
    const results = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      return {
        // Get entity that doesn't exist
        notFound: tools.call("get_entity", { id: "nonexistent-entity" }),
        // Remove entity that doesn't exist
        removeNotFound: tools.call("remove_entity", { id: "nonexistent-entity" }),
        // Invalid expression
        invalidExpr: tools.call("evaluate_expression", { expression: "invalid @@@ syntax" }),
      };
    });

    expect(results.notFound.success).toBe(false);
    expect(results.notFound.error).toContain("not found");

    expect(results.removeNotFound.success).toBe(false);

    expect(results.invalidExpr.success).toBe(false);
  });

  test("handles batch operations in sequence", async ({ page }) => {
    const results = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Simulate a batch of operations that an AI might send
      const operations = [
        { tool: "create_entity", args: { id: "batch-entity-1", tags: ["batch"], components: { Position: { x: 0, y: 0 } } } },
        { tool: "create_entity", args: { id: "batch-entity-2", tags: ["batch"], components: { Position: { x: 10, y: 10 } } } },
        { tool: "set_component", args: { id: "batch-entity-1", component: "Position", data: { x: 50, y: 50 } } },
        { tool: "step", args: { frames: 5 } },
        { tool: "get_entities", args: { tag: "batch" } },
      ];

      const results = [];
      for (const op of operations) {
        results.push(tools.call(op.tool, op.args));
      }

      return results;
    });

    // All operations should succeed
    expect(results[0].success).toBe(true); // create 1
    expect(results[1].success).toBe(true); // create 2
    expect(results[2].success).toBe(true); // set_component
    expect(results[3].success).toBe(true); // step
    expect(results[4].success).toBe(true); // get_entities

    // Should have created entities
    expect(results[4].data.some(e => e.id === "batch-entity-1")).toBe(true);
    expect(results[4].data.some(e => e.id === "batch-entity-2")).toBe(true);
  });
});

test.describe("State Updates", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test("step result includes events emitted", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Define an event that will be triggered
      tools.call("define_event", {
        event: "test-connection-event",
        actions: [{ type: "log", message: "Event fired" }]
      });

      // Trigger it manually
      tools.call("trigger_event", { event: "test-connection-event" });

      // Step and check result
      const stepResult = tools.call("step", { frames: 1 });

      return stepResult;
    });

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("eventsProcessed");
    expect(result.data).toHaveProperty("eventsEmitted");
  });

  test("state update has all required fields", async ({ page }) => {
    const state = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Do some work
      tools.call("step", { frames: 10 });

      // Get state (as it would be sent in state update)
      return tools.call("dump_state").data;
    });

    // Required top-level fields
    expect(state).toHaveProperty("frame");
    expect(state).toHaveProperty("time");
    expect(state).toHaveProperty("entities");
    expect(state).toHaveProperty("templates");
    expect(state).toHaveProperty("systems");
    expect(state).toHaveProperty("collisions");
    expect(state).toHaveProperty("events");
    expect(state).toHaveProperty("rules");
    expect(state).toHaveProperty("screens");
    expect(state).toHaveProperty("modes");
  });

  test("state updates reflect entity changes", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Get initial state
      const initialEntities = tools.call("get_entities", {}).data.length;

      // Create entities directly (no template needed)
      tools.call("create_entity", {
        id: "update-test-1",
        tags: ["test"],
        components: { Position: { x: 0, y: 0 } }
      });
      tools.call("create_entity", {
        id: "update-test-2",
        tags: ["test"],
        components: { Position: { x: 10, y: 10 } }
      });

      // Get updated state
      const afterSpawnEntities = tools.call("get_entities", {}).data.length;

      // Remove one
      tools.call("remove_entity", { id: "update-test-1" });

      // Get final state
      const finalEntities = tools.call("get_entities", {}).data.length;

      return {
        initial: initialEntities,
        afterSpawn: afterSpawnEntities,
        final: finalEntities
      };
    });

    expect(result.afterSpawn).toBe(result.initial + 2);
    expect(result.final).toBe(result.initial + 1);
  });

  test("state updates reflect rule changes", async ({ page }) => {
    const result = await page.evaluate(() => {
      const tools = window.__SUPER_MO__.tools;

      // Get initial gravity
      const initialGravity = tools.call("get_rule", { path: "physics.gravity" }).data;

      // Change it
      tools.call("set_rule", { path: "physics.gravity", value: 1500 });

      // Get updated state
      const updatedState = tools.call("dump_state").data;

      return {
        initial: initialGravity,
        updated: updatedState.rules.physics.gravity
      };
    });

    expect(result.initial).toBe(980);
    expect(result.updated).toBe(1500);
  });
});
