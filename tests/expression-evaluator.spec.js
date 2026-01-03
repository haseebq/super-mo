import { test, expect } from "@playwright/test";

/**
 * Phase 3: Expression Evaluator Tests
 *
 * Tests use the tool interface - same as AI would use.
 */

test.describe("Expression Evaluator", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => window.__SUPER_MO__?.tools != null, {
      timeout: 5000,
    });
  });

  test.describe("Math expressions", () => {
    test("evaluates basic arithmetic", async ({ page }) => {
      const results = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return {
          add: tools.call("evaluate_expression", { expression: "2 + 3" }).data,
          sub: tools.call("evaluate_expression", { expression: "10 - 4" }).data,
          mul: tools.call("evaluate_expression", { expression: "6 * 7" }).data,
          div: tools.call("evaluate_expression", { expression: "20 / 4" }).data,
          mod: tools.call("evaluate_expression", { expression: "17 % 5" }).data,
        };
      });

      expect(results.add).toBe(5);
      expect(results.sub).toBe(6);
      expect(results.mul).toBe(42);
      expect(results.div).toBe(5);
      expect(results.mod).toBe(2);
    });

    test("evaluates Math.* functions", async ({ page }) => {
      const results = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return {
          abs: tools.call("evaluate_expression", { expression: "Math.abs(-5)" }).data,
          floor: tools.call("evaluate_expression", { expression: "Math.floor(3.7)" }).data,
          ceil: tools.call("evaluate_expression", { expression: "Math.ceil(3.2)" }).data,
          max: tools.call("evaluate_expression", { expression: "Math.max(1, 5, 3)" }).data,
          min: tools.call("evaluate_expression", { expression: "Math.min(1, 5, 3)" }).data,
          sin: tools.call("evaluate_expression", { expression: "Math.sin(0)" }).data,
        };
      });

      expect(results.abs).toBe(5);
      expect(results.floor).toBe(3);
      expect(results.ceil).toBe(4);
      expect(results.max).toBe(5);
      expect(results.min).toBe(1);
      expect(results.sin).toBe(0);
    });

    test("evaluates unary operators", async ({ page }) => {
      const results = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return {
          neg: tools.call("evaluate_expression", { expression: "-5" }).data,
          pos: tools.call("evaluate_expression", { expression: "+5" }).data,
          not: tools.call("evaluate_expression", { expression: "!false" }).data,
        };
      });

      expect(results.neg).toBe(-5);
      expect(results.pos).toBe(5);
      expect(results.not).toBe(true);
    });
  });

  test.describe("Comparisons and logic", () => {
    test("evaluates comparisons", async ({ page }) => {
      const results = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return {
          lt: tools.call("evaluate_expression", { expression: "3 < 5" }).data,
          gt: tools.call("evaluate_expression", { expression: "5 > 3" }).data,
          lte: tools.call("evaluate_expression", { expression: "3 <= 3" }).data,
          gte: tools.call("evaluate_expression", { expression: "3 >= 3" }).data,
          eq: tools.call("evaluate_expression", { expression: "5 == 5" }).data,
          neq: tools.call("evaluate_expression", { expression: "5 != 3" }).data,
        };
      });

      expect(results.lt).toBe(true);
      expect(results.gt).toBe(true);
      expect(results.lte).toBe(true);
      expect(results.gte).toBe(true);
      expect(results.eq).toBe(true);
      expect(results.neq).toBe(true);
    });

    test("evaluates logical operators", async ({ page }) => {
      const results = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return {
          and: tools.call("evaluate_expression", { expression: "true && true" }).data,
          or: tools.call("evaluate_expression", { expression: "false || true" }).data,
          complex: tools.call("evaluate_expression", { expression: "5 > 3 && 2 < 4" }).data,
        };
      });

      expect(results.and).toBe(true);
      expect(results.or).toBe(true);
      expect(results.complex).toBe(true);
    });

    test("evaluates conditional expressions", async ({ page }) => {
      const results = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return {
          ifTrue: tools.call("evaluate_expression", { expression: "true ? 1 : 2" }).data,
          ifFalse: tools.call("evaluate_expression", { expression: "false ? 1 : 2" }).data,
        };
      });

      expect(results.ifTrue).toBe(1);
      expect(results.ifFalse).toBe(2);
    });
  });

  test.describe("Context references", () => {
    test("resolves entity references", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("evaluate_expression", {
          expression: "entity.Position.x + entity.Position.y",
          context: {
            entity: { Position: { x: 100, y: 200 } },
          },
        }).data;
      });

      expect(result).toBe(300);
    });

    test("resolves rules references", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        // Uses default rules from engine state
        return tools.call("evaluate_expression", {
          expression: "rules.physics.gravity",
        }).data;
      });

      expect(result).toBe(980);
    });

    test("resolves time and dt", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("evaluate_expression", {
          expression: "time + dt * 60",
          context: { time: 10, dt: 1 / 60 },
        }).data;
      });

      expect(result).toBeCloseTo(11, 5);
    });

    test("resolves data references", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("evaluate_expression", {
          expression: "data.player.Health.lives > 0",
          context: {
            data: { player: { Health: { lives: 3 } } },
          },
        }).data;
      });

      expect(result).toBe(true);
    });

    test("resolves input references", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("evaluate_expression", {
          expression: "input.horizontal * 150",
          context: { input: { horizontal: 1 } },
        }).data;
      });

      expect(result).toBe(150);
    });
  });

  test.describe("Security", () => {
    test("rejects eval", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("validate_expression", {
          expression: 'eval("alert(1)")',
        });
      });

      expect(result.data.valid).toBe(false);
    });

    test("rejects Function constructor", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("validate_expression", {
          expression: 'Function("return 1")()',
        });
      });

      expect(result.data.valid).toBe(false);
    });

    test("rejects window/document", async ({ page }) => {
      const results = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return {
          window: tools.call("validate_expression", { expression: "window.location" }),
          document: tools.call("validate_expression", { expression: "document.cookie" }),
        };
      });

      expect(results.window.data.valid).toBe(false);
      expect(results.document.data.valid).toBe(false);
    });

    test("rejects fetch", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("validate_expression", {
          expression: 'fetch("http://evil.com")',
        });
      });

      expect(result.data.valid).toBe(false);
    });

    test("rejects __proto__ access", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("validate_expression", {
          expression: "entity.__proto__",
        });
      });

      expect(result.data.valid).toBe(false);
    });

    test("rejects constructor access", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("validate_expression", {
          expression: "entity.constructor",
        });
      });

      expect(result.data.valid).toBe(false);
    });

    test("rejects non-Math function calls", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("validate_expression", {
          expression: "console.log(1)",
        });
      });

      expect(result.data.valid).toBe(false);
    });
  });

  test.describe("validate_expression tool", () => {
    test("validates safe expressions", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("validate_expression", {
          expression: "entity.x + Math.sin(time) * 10",
        });
      });

      expect(result.success).toBe(true);
      expect(result.data.valid).toBe(true);
    });

    test("rejects invalid syntax", async ({ page }) => {
      const result = await page.evaluate(() => {
        const tools = window.__SUPER_MO__.tools;
        return tools.call("validate_expression", {
          expression: "2 +* 3",
        });
      });

      expect(result.data.valid).toBe(false);
    });
  });

  test("expression tools are listed", async ({ page }) => {
    const tools = await page.evaluate(() => {
      return window.__SUPER_MO__.tools.getTools().map((t) => t.name);
    });

    expect(tools).toContain("evaluate_expression");
    expect(tools).toContain("validate_expression");
  });
});
