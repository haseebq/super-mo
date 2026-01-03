/**
 * Expression Evaluator
 *
 * Safe evaluation of math and logic expressions.
 * No arbitrary code execution - only validated operations.
 */

import * as acorn from "acorn";

export interface ExpressionContext {
  entity?: Record<string, unknown>;
  rules?: Record<string, unknown>;
  time?: number;
  dt?: number;
  input?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

const ALLOWED_MATH_FUNCTIONS = new Set([
  "abs", "ceil", "floor", "round", "sqrt",
  "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
  "min", "max", "pow", "log", "exp",
  "random", "sign", "trunc",
]);

const DANGEROUS_IDENTIFIERS = new Set([
  "eval", "Function", "constructor", "prototype", "__proto__",
  "window", "document", "globalThis", "self",
  "fetch", "XMLHttpRequest", "WebSocket",
  "require", "import", "module", "exports",
  "process", "Buffer",
]);

type AcornNode = acorn.Node & {
  type: string;
  left?: AcornNode;
  right?: AcornNode;
  operator?: string;
  argument?: AcornNode;
  test?: AcornNode;
  consequent?: AcornNode;
  alternate?: AcornNode;
  object?: AcornNode;
  property?: AcornNode;
  computed?: boolean;
  name?: string;
  value?: unknown;
  raw?: string;
  callee?: AcornNode;
  arguments?: AcornNode[];
  body?: AcornNode;
  expression?: AcornNode;
  elements?: AcornNode[];
};

export class ExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpressionError";
  }
}

/**
 * Parse an expression string into an AST.
 */
export function parseExpression(expr: string): AcornNode {
  try {
    const ast = acorn.parse(expr, {
      ecmaVersion: 2020,
      sourceType: "script",
    }) as unknown as { type: string; body: AcornNode[] };

    if (ast.type !== "Program" || !ast.body) {
      throw new ExpressionError("Invalid expression structure");
    }

    const body = ast.body;
    if (body.length !== 1 || body[0].type !== "ExpressionStatement") {
      throw new ExpressionError("Expression must be a single statement");
    }

    return body[0].expression!;
  } catch (err) {
    if (err instanceof ExpressionError) throw err;
    throw new ExpressionError(`Parse error: ${(err as Error).message}`);
  }
}

/**
 * Validate that an AST node is safe to evaluate.
 */
export function validateNode(node: AcornNode): void {
  switch (node.type) {
    case "Literal":
      // Numbers, strings, booleans are safe
      break;

    case "Identifier":
      if (DANGEROUS_IDENTIFIERS.has(node.name!)) {
        throw new ExpressionError(`Dangerous identifier: ${node.name}`);
      }
      break;

    case "BinaryExpression":
    case "LogicalExpression":
      validateNode(node.left!);
      validateNode(node.right!);
      break;

    case "UnaryExpression":
      if (!["-", "+", "!", "~"].includes(node.operator!)) {
        throw new ExpressionError(`Unsupported unary operator: ${node.operator}`);
      }
      validateNode(node.argument!);
      break;

    case "ConditionalExpression":
      validateNode(node.test!);
      validateNode(node.consequent!);
      validateNode(node.alternate!);
      break;

    case "MemberExpression":
      validateNode(node.object!);
      if (node.computed) {
        validateNode(node.property!);
      } else if (node.property!.type === "Identifier") {
        const propName = node.property!.name!;
        if (propName === "constructor" || propName === "__proto__") {
          throw new ExpressionError(`Dangerous property access: ${propName}`);
        }
      }
      break;

    case "CallExpression":
      validateCallExpression(node);
      break;

    case "ArrayExpression":
      for (const element of node.elements || []) {
        if (element) validateNode(element);
      }
      break;

    default:
      throw new ExpressionError(`Unsupported expression type: ${node.type}`);
  }
}

function validateCallExpression(node: AcornNode): void {
  const callee = node.callee!;

  // Only allow Math.* calls
  if (callee.type === "MemberExpression") {
    const obj = callee.object as AcornNode;
    const prop = callee.property as AcornNode;

    if (obj.type === "Identifier" && obj.name === "Math") {
      if (prop.type === "Identifier" && ALLOWED_MATH_FUNCTIONS.has(prop.name!)) {
        // Validate arguments
        for (const arg of node.arguments || []) {
          validateNode(arg);
        }
        return;
      }
    }
  }

  throw new ExpressionError("Only Math.* function calls are allowed");
}

/**
 * Evaluate a validated AST node with the given context.
 */
export function evaluateNode(node: AcornNode, context: ExpressionContext): unknown {
  switch (node.type) {
    case "Literal":
      return node.value;

    case "Identifier":
      return resolveIdentifier(node.name!, context);

    case "BinaryExpression":
      return evaluateBinary(node, context);

    case "LogicalExpression":
      return evaluateLogical(node, context);

    case "UnaryExpression":
      return evaluateUnary(node, context);

    case "ConditionalExpression":
      return evaluateNode(node.test!, context)
        ? evaluateNode(node.consequent!, context)
        : evaluateNode(node.alternate!, context);

    case "MemberExpression":
      return evaluateMember(node, context);

    case "CallExpression":
      return evaluateCall(node, context);

    case "ArrayExpression":
      return (node.elements || []).map((el) =>
        el ? evaluateNode(el, context) : undefined
      );

    default:
      throw new ExpressionError(`Cannot evaluate: ${node.type}`);
  }
}

function resolveIdentifier(name: string, context: ExpressionContext): unknown {
  switch (name) {
    case "entity":
      return context.entity;
    case "rules":
      return context.rules;
    case "time":
      return context.time ?? 0;
    case "dt":
      return context.dt ?? 1 / 60;
    case "input":
      return context.input;
    case "data":
      return context.data;
    case "true":
      return true;
    case "false":
      return false;
    case "null":
      return null;
    case "undefined":
      return undefined;
    case "Math":
      return Math;
    case "Infinity":
      return Infinity;
    case "NaN":
      return NaN;
    default:
      // Try to find in data first, then entity
      if (context.data && name in (context.data as Record<string, unknown>)) {
        return (context.data as Record<string, unknown>)[name];
      }
      if (context.entity && name in (context.entity as Record<string, unknown>)) {
        return (context.entity as Record<string, unknown>)[name];
      }
      return undefined;
  }
}

function evaluateBinary(node: AcornNode, context: ExpressionContext): unknown {
  const left = evaluateNode(node.left!, context) as number;
  const right = evaluateNode(node.right!, context) as number;

  switch (node.operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      return left / right;
    case "%":
      return left % right;
    case "**":
      return left ** right;
    case "<":
      return left < right;
    case ">":
      return left > right;
    case "<=":
      return left <= right;
    case ">=":
      return left >= right;
    case "==":
    case "===":
      return left === right;
    case "!=":
    case "!==":
      return left !== right;
    case "&":
      return left & right;
    case "|":
      return left | right;
    case "^":
      return left ^ right;
    case "<<":
      return left << right;
    case ">>":
      return left >> right;
    case ">>>":
      return left >>> right;
    default:
      throw new ExpressionError(`Unknown binary operator: ${node.operator}`);
  }
}

function evaluateLogical(node: AcornNode, context: ExpressionContext): unknown {
  const left = evaluateNode(node.left!, context);

  switch (node.operator) {
    case "&&":
      return left && evaluateNode(node.right!, context);
    case "||":
      return left || evaluateNode(node.right!, context);
    case "??":
      return left ?? evaluateNode(node.right!, context);
    default:
      throw new ExpressionError(`Unknown logical operator: ${node.operator}`);
  }
}

function evaluateUnary(node: AcornNode, context: ExpressionContext): unknown {
  const arg = evaluateNode(node.argument!, context);

  switch (node.operator) {
    case "-":
      return -(arg as number);
    case "+":
      return +(arg as number);
    case "!":
      return !arg;
    case "~":
      return ~(arg as number);
    default:
      throw new ExpressionError(`Unknown unary operator: ${node.operator}`);
  }
}

function evaluateMember(node: AcornNode, context: ExpressionContext): unknown {
  const obj = evaluateNode(node.object!, context) as Record<string, unknown>;
  if (obj === null || obj === undefined) return undefined;

  let key: string;
  if (node.computed) {
    key = String(evaluateNode(node.property!, context));
  } else {
    key = (node.property as AcornNode).name!;
  }

  return obj[key];
}

function evaluateCall(node: AcornNode, context: ExpressionContext): unknown {
  const callee = node.callee as AcornNode;

  // Math.* calls
  if (callee.type === "MemberExpression") {
    const obj = callee.object as AcornNode;
    const prop = callee.property as AcornNode;

    if (obj.type === "Identifier" && obj.name === "Math" && prop.type === "Identifier") {
      const args = (node.arguments || []).map((arg) => evaluateNode(arg, context));
      const fn = (Math as unknown as Record<string, unknown>)[prop.name!] as (...args: unknown[]) => unknown;
      return fn.apply(Math, args);
    }
  }

  throw new ExpressionError("Unsupported function call");
}

/**
 * Parse, validate, and evaluate an expression string.
 */
export function evaluate(expr: string, context: ExpressionContext = {}): unknown {
  const ast = parseExpression(expr);
  validateNode(ast);
  return evaluateNode(ast, context);
}

/**
 * Check if an expression is valid (parses and validates).
 */
export function isValidExpression(expr: string): boolean {
  try {
    const ast = parseExpression(expr);
    validateNode(ast);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compile an expression for repeated evaluation.
 */
export function compileExpression(expr: string): (context: ExpressionContext) => unknown {
  const ast = parseExpression(expr);
  validateNode(ast);
  return (context: ExpressionContext) => evaluateNode(ast, context);
}
