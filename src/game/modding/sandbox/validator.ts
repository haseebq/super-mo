import { parse } from "acorn";

type Node = {
  type: string;
  loc?: { start: { line: number; column: number } };
  [key: string]: unknown;
};

export type SandboxValidationResult = {
  ok: boolean;
  errors: string[];
};

const DISALLOWED_NODES = new Set([
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "ExportAllDeclaration",
  "ImportExpression",
  "WithStatement",
  "DebuggerStatement",
  "MetaProperty",
]);

const FORBIDDEN_CALLEES = new Set(["eval", "Function", "AsyncFunction"]);

function formatLoc(node: Node): string {
  if (!node.loc) return "";
  return `:${node.loc.start.line}:${node.loc.start.column + 1}`;
}

function hasUseStrict(program: Node): boolean {
  const body = program.body as Node[] | undefined;
  if (!Array.isArray(body) || body.length === 0) return false;
  const first = body[0];
  if (first?.type !== "ExpressionStatement") return false;
  const expr = (first as Node & { expression?: Node }).expression ?? null;
  if (expr?.type !== "Literal") return false;
  const literal = expr as Node & { value?: unknown };
  return literal.value === "use strict";
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const value of Object.values(node)) {
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child === "object" && "type" in child) {
          walk(child as Node, visit);
        }
      }
    } else if (typeof value === "object" && "type" in value) {
      walk(value as Node, visit);
    }
  }
}

export function validateSandboxScript(code: string): SandboxValidationResult {
  const errors: string[] = [];
  let ast: Node;

  try {
    ast = parse(code, {
      ecmaVersion: "latest",
      sourceType: "script",
      locations: true,
    }) as unknown as Node;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown parse error.";
    return { ok: false, errors: [`Parse error: ${message}`] };
  }

  if (!hasUseStrict(ast)) {
    errors.push("Missing 'use strict' directive at top of script.");
  }

  walk(ast, (node) => {
    if (DISALLOWED_NODES.has(node.type)) {
      errors.push(`Disallowed syntax: ${node.type}${formatLoc(node)}`);
      return;
    }

    if (node.type === "CallExpression" || node.type === "NewExpression") {
      const callee = (node as Node & { callee?: Node }).callee;
      if (callee?.type === "Identifier") {
        const name = String(callee.name ?? "");
        if (FORBIDDEN_CALLEES.has(name)) {
          errors.push(`Forbidden call: ${name}${formatLoc(node)}`);
        }
      }
    }
  });

  return { ok: errors.length === 0, errors };
}
