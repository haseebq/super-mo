import { test, expect } from "@playwright/test";

async function pressKey(page, code) {
  await page.evaluate((keyCode) => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: keyCode }));
    window.dispatchEvent(new KeyboardEvent("keyup", { code: keyCode }));
  }, code);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__SUPER_MO__?.modding != null);
  await page.waitForFunction(() => window.__SUPER_MO__?.state?.backgroundTime > 0, {
    timeout: 10000,
  });

  const startOverlay = page.locator(".start-overlay");
  await expect(startOverlay).toBeVisible();
  await pressKey(page, "Enter");

  const introOverlay = page.locator(".intro-overlay");
  await expect(introOverlay).toBeVisible();
  await pressKey(page, "Enter");
  await expect(introOverlay).toHaveClass(/is-hidden/);
});

test("modding prompt removes coins", async ({ page }) => {
  const moddingToggle = page.locator("#modding-toggle");
  await moddingToggle.click();

  const moddingOverlay = page.locator("#modding-overlay");
  await expect(moddingOverlay).not.toHaveClass(/is-hidden/);

  const initialCoins = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().entities.coins
  );
  expect(initialCoins).toBeGreaterThan(0);

  const input = page.locator("#modding-input");
  await input.fill("remove all coins");
  await page.locator("#modding-send").click();

  await page.waitForFunction(
    () => window.__SUPER_MO__.modding.getSnapshot().entities.coins === 0
  );
});

test("modding prompt updates gravity", async ({ page }) => {
  const moddingToggle = page.locator("#modding-toggle");
  await moddingToggle.click();

  const moddingOverlay = page.locator("#modding-overlay");
  await expect(moddingOverlay).not.toHaveClass(/is-hidden/);

  const input = page.locator("#modding-input");
  await input.fill("gravity off");
  await page.locator("#modding-send").click();

  await page.waitForFunction(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity === 0
  );
});

test("sandbox runScript applies ops", async ({ page }) => {
  const status = await page.evaluate(() => ({
    ready: window.__SANDBOX_READY__ === true,
    error: window.__SANDBOX_ERROR__ || null,
  }));
  expect(
    status.ready,
    `Sandbox not ready: ${status.error ?? "unknown"}`
  ).toBeTruthy();
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "runScript",
          code: '"use strict"; capabilities.setRule("physics.gravity", 0);',
        },
      ],
    });
  });

  expect(result.success).toBeTruthy();
  const gravity = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );
  expect(gravity).toBe(0);
});

test("sandbox validator rejects forbidden calls", async ({ page }) => {
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "runScript",
          code: '"use strict"; eval("2+2");',
        },
      ],
    });
  });

  expect(result.success).toBeFalsy();
  expect(result.errors?.some((error) => error.includes("Script error"))).toBeTruthy();
});

test("rollback restores last patch", async ({ page }) => {
  const original = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );

  await page.evaluate(async () => {
    await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "setRule",
          path: "physics.gravity",
          value: 0,
        },
      ],
    });
  });

  const updated = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );
  expect(updated).toBe(0);

  const rollback = await page.evaluate(
    () => window.__SUPER_MO__.modding.rollbackLastPatch()
  );
  expect(rollback.success).toBeTruthy();

  const restored = await page.evaluate(
    () => window.__SUPER_MO__.modding.getSnapshot().rules.physics.gravity
  );
  expect(restored).toBe(original);
});

test("setEntityScript applies sine wave to enemies", async ({ page }) => {
  const status = await page.evaluate(() => ({
    ready: window.__SANDBOX_READY__ === true,
    error: window.__SANDBOX_ERROR__ || null,
  }));
  expect(
    status.ready,
    `Sandbox not ready: ${status.error ?? "unknown"}`
  ).toBeTruthy();

  // Get initial enemy positions
  const initialPositions = await page.evaluate(() =>
    window.__SUPER_MO__.state.enemies.map((e) => ({ x: e.x, y: e.y }))
  );
  expect(initialPositions.length).toBeGreaterThan(0);

  // Apply setEntityScript via sandbox runScript
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "runScript",
          code: `"use strict";
            capabilities.setEntityScript(
              "enemy",
              "if (!entity.baseY) entity.baseY = entity.y; entity.y = entity.baseY + Math.sin(time * 2) * 20;"
            );`,
        },
      ],
    });
  });

  expect(result.success).toBeTruthy();
  // runScript counts as 1, plus the nested setEntityScript should make it 2
  expect(result.appliedOps).toBeGreaterThanOrEqual(2);

  // Check that entityScripts.enemy is now set
  const hasScript = await page.evaluate(
    () => window.__SUPER_MO__.state.entityScripts.enemy !== null
  );
  expect(hasScript).toBeTruthy();

  // Wait a bit for the script to execute during game updates
  await page.waitForTimeout(200);

  // Verify enemies have moved (sine wave should have affected their Y position)
  const finalPositions = await page.evaluate(() =>
    window.__SUPER_MO__.state.enemies.map((e) => ({ x: e.x, y: e.y, baseY: e.baseY }))
  );

  // At least one enemy should have baseY set by the script
  const hasBaseY = finalPositions.some((e) => e.baseY !== undefined);
  expect(hasBaseY).toBeTruthy();
});

test("setEntityScript can be applied directly without sandbox", async ({ page }) => {
  // Apply setEntityScript directly via applyPatch (no sandbox)
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "setEntityScript",
          target: "enemy",
          script: "entity.y += Math.sin(time) * 0.5;",
        },
      ],
    });
  });

  expect(result.success).toBeTruthy();
  expect(result.appliedOps).toBe(1);

  const hasScript = await page.evaluate(
    () => window.__SUPER_MO__.state.entityScripts.enemy !== null
  );
  expect(hasScript).toBeTruthy();
});

test("keyword provider handles sine wave enemy request", async ({ page }) => {
  // Open modding panel
  const moddingToggle = page.locator("#modding-toggle");
  await moddingToggle.click();

  const moddingOverlay = page.locator("#modding-overlay");
  await expect(moddingOverlay).not.toHaveClass(/is-hidden/);

  // Send sine wave request
  const input = page.locator("#modding-input");
  await input.fill("make enemies move in sine wave pattern");
  await page.locator("#modding-send").click();

  // Wait for entityScript to be applied
  await page.waitForFunction(
    () => window.__SUPER_MO__.state.entityScripts.enemy !== null
  );

  // Verify the history shows the operation was applied
  const historyText = await page.locator(".modding-history").textContent();
  expect(historyText).toContain("setEntityScript");
});

test("discovery tools provide operation docs", async ({ page }) => {
  const discovery = await page.evaluate(() => {
    const tools = window.__SUPER_MO__.discovery;
    return {
      operations: tools.listOperations(),
      setEntityScriptDocs: tools.getOperationDocs("setEntityScript"),
      enemySchema: tools.getEntitySchema("enemy"),
      scriptContext: tools.getScriptContext(),
    };
  });

  // Check operations list
  expect(discovery.operations.length).toBeGreaterThan(5);
  expect(discovery.operations.some((op) => op.op === "setEntityScript")).toBeTruthy();

  // Check setEntityScript docs
  expect(discovery.setEntityScriptDocs).not.toBeNull();
  expect(discovery.setEntityScriptDocs.examples.length).toBeGreaterThan(0);
  expect(discovery.setEntityScriptDocs.schema.target).toContain("enemy");

  // Check entity schema
  expect(discovery.enemySchema.properties.x).toBeDefined();
  expect(discovery.enemySchema.properties.vx).toBeDefined();

  // Check script context - blocked list approach
  expect(discovery.scriptContext.blocked).toContain("fetch");
  expect(discovery.scriptContext.blocked).toContain("eval");
  expect(discovery.scriptContext.variables.entity).toBeDefined();
  expect(discovery.scriptContext.variables.time).toBeDefined();
});

test("discovery tools handle multi-turn AI tool call workflow", async ({ page }) => {
  // Simulate multi-turn conversation where AI iteratively discovers capabilities
  // This mimics how a real AI would make sequential tool calls in a chat flow

  // TURN 1: User asks "make enemies move in sine wave"
  // AI doesn't know what operations exist, so it calls list_operations
  const turn1 = await page.evaluate(() => {
    const tools = window.__SUPER_MO__.discovery;
    return tools.listOperations();
  });
  expect(turn1.length).toBeGreaterThan(5);
  const entityScriptOp = turn1.find(op => op.op === "setEntityScript");
  expect(entityScriptOp).toBeDefined();
  expect(entityScriptOp.brief).toContain("per-frame");

  // TURN 2: AI sees setEntityScript looks relevant, requests docs
  const turn2 = await page.evaluate(() => {
    const tools = window.__SUPER_MO__.discovery;
    return tools.getOperationDocs("setEntityScript");
  });
  expect(turn2).not.toBeNull();
  expect(turn2.description).toContain("JavaScript");
  expect(turn2.schema.target).toContain("enemy");
  expect(turn2.examples.length).toBeGreaterThan(0);
  // AI sees there's a sine wave example!
  const sineExample = turn2.examples.find(ex => ex.prompt.includes("sine wave"));
  expect(sineExample).toBeDefined();

  // TURN 3: AI wants to write a custom script, asks about entity properties
  const turn3 = await page.evaluate(() => {
    const tools = window.__SUPER_MO__.discovery;
    return tools.getEntitySchema("enemy");
  });
  expect(turn3.properties.x).toBeDefined();
  expect(turn3.properties.y).toBeDefined();
  expect(turn3.properties.vx).toBeDefined();
  expect(turn3.properties.baseX).toContain("optional"); // AI learns it can store baseX

  // TURN 4: AI checks what JS is available in scripts
  const turn4 = await page.evaluate(() => {
    const tools = window.__SUPER_MO__.discovery;
    return tools.getScriptContext();
  });
  expect(turn4.variables.entity).toBeDefined();
  expect(turn4.variables.time).toBeDefined();
  expect(turn4.blocked).toContain("fetch"); // AI knows not to use fetch
  expect(turn4.blocked).toContain("eval");
  expect(turn4.notes).toContain("Math"); // AI learns Math is available

  // TURN 5: AI now has enough context to generate correct operation
  // It uses the example from docs and its understanding of entity schema
  const turn5 = await page.evaluate((exampleScript) => {
    // AI generates operation based on discovered docs
    const generatedOp = {
      op: "setEntityScript",
      target: "enemy",
      script: exampleScript,
    };

    // Apply it to verify it works
    return window.__SUPER_MO__.modding.applyPatch({ ops: [generatedOp] });
  }, sineExample.op.script);

  expect(turn5.success).toBeTruthy();
  expect(turn5.appliedOps).toBe(1);

  // Verify the script was actually applied
  const hasScript = await page.evaluate(
    () => window.__SUPER_MO__.state.entityScripts.enemy !== null
  );
  expect(hasScript).toBeTruthy();
});

test("sine wave enemy movement actually moves enemies", async ({ page }) => {
  // Get initial enemy positions
  const initialPositions = await page.evaluate(() =>
    window.__SUPER_MO__.state.enemies.map((e) => ({ x: e.x, y: e.y }))
  );
  expect(initialPositions.length).toBeGreaterThan(0);

  // Apply sine wave via setEntityScript directly
  const result = await page.evaluate(async () => {
    return await window.__SUPER_MO__.modding.applyPatch({
      ops: [
        {
          op: "setEntityScript",
          target: "enemy",
          script: "if (!entity.baseX) entity.baseX = entity.x; entity.x = entity.baseX + 30 * Math.sin(time * 2);",
        },
      ],
    });
  });
  expect(result.success).toBeTruthy();

  // Wait for script to execute during game updates
  await page.waitForTimeout(300);

  // Verify enemies have moved from their original X positions
  const finalPositions = await page.evaluate(() =>
    window.__SUPER_MO__.state.enemies.map((e) => ({ x: e.x, baseX: e.baseX }))
  );

  // At least one enemy should have baseX set and x should differ from baseX
  const hasMovement = finalPositions.some((e) => e.baseX !== undefined && Math.abs(e.x - e.baseX) > 0.1);
  expect(hasMovement).toBeTruthy();
});
