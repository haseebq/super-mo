import { getQuickJS } from "quickjs-emscripten";
import type { SandboxOp, SandboxRequest, SandboxResponse } from "./types.js";

type QuickJSModule = Awaited<ReturnType<typeof getQuickJS>>;

const ctx = self;
let quickjs: QuickJSModule | null = null;
let initPromise: Promise<void> | null = null;

function ensureQuickJS(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = getQuickJS().then((module) => {
    quickjs = module;
  });
  return initPromise;
}

function safeString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeOp(op: unknown): SandboxOp | null {
  if (!op || typeof op !== "object") return null;
  const record = op as Record<string, unknown>;
  if (typeof record.op !== "string") return null;
  return record as SandboxOp;
}

function registerCapabilities(
  vm: ReturnType<QuickJSModule["newContext"]>,
  ops: SandboxOp[]
) {
  const capHandle = vm.newObject();

  const emitHandle = vm.newFunction("emit", (opHandle) => {
    const op = normalizeOp(vm.dump(opHandle));
    if (op) ops.push(op);
  });

  const setRuleHandle = vm.newFunction("setRule", (pathHandle, valueHandle) => {
    const path = vm.dump(pathHandle);
    const value = vm.dump(valueHandle);
    if (typeof path === "string" && typeof value === "number") {
      ops.push({ op: "setRule", path, value });
    }
  });

  const setAbilityHandle = vm.newFunction(
    "setAbility",
    (abilityHandle, activeHandle) => {
      const ability = vm.dump(abilityHandle);
      const active = vm.dump(activeHandle);
      if (typeof ability === "string" && typeof active === "boolean") {
        ops.push({ op: "setAbility", ability, active });
      }
    }
  );

  const removeEntitiesHandle = vm.newFunction("removeEntities", (filterHandle) => {
    const filter = vm.dump(filterHandle);
    if (filter && typeof filter === "object") {
      ops.push({ op: "removeEntities", filter });
    }
  });

  vm.setProp(capHandle, "emit", emitHandle);
  vm.setProp(capHandle, "setRule", setRuleHandle);
  vm.setProp(capHandle, "setAbility", setAbilityHandle);
  vm.setProp(capHandle, "removeEntities", removeEntitiesHandle);

  emitHandle.dispose();
  setRuleHandle.dispose();
  setAbilityHandle.dispose();
  removeEntitiesHandle.dispose();

  vm.setProp(vm.global, "capabilities", capHandle);
  capHandle.dispose();
}

function registerConsole(
  vm: ReturnType<QuickJSModule["newContext"]>,
  logs: string[]
) {
  const consoleHandle = vm.newObject();
  const logHandle = vm.newFunction("log", (...args) => {
    const message = args.map((arg) => safeString(vm.dump(arg))).join(" ");
    logs.push(message);
  });

  vm.setProp(consoleHandle, "log", logHandle);
  logHandle.dispose();
  vm.setProp(vm.global, "console", consoleHandle);
  consoleHandle.dispose();
}

async function runCode(
  code: string
): Promise<{ result?: SandboxResponse; error?: SandboxResponse }> {
  await ensureQuickJS();
  if (!quickjs) {
    return {
      error: { type: "error", id: "", error: "QuickJS failed to initialize." },
    };
  }

  const vm = quickjs.newContext();
  const ops: SandboxOp[] = [];
  const logs: string[] = [];

  registerCapabilities(vm, ops);
  registerConsole(vm, logs);

  let output: unknown;
  let error: string | null = null;

  const evalResult = vm.evalCode(code, "sandbox.js");
  if (evalResult.error) {
    error = safeString(vm.dump(evalResult.error));
    evalResult.error.dispose();
  } else if (evalResult.value) {
    output = vm.dump(evalResult.value);
    evalResult.value.dispose();
    const maybeOps = (output as { ops?: unknown })?.ops;
    if (Array.isArray(maybeOps)) {
      for (const op of maybeOps) {
        const normalized = normalizeOp(op);
        if (normalized) ops.push(normalized);
      }
    }
  }
  evalResult.dispose();

  vm.dispose();

  if (error) {
    return {
      error: { type: "error", id: "", error, logs },
    };
  }

  return {
    result: {
      type: "result",
      id: "",
      result: { ops, logs, output },
    },
  };
}

ctx.addEventListener("message", async (event: MessageEvent<SandboxRequest>) => {
  const message = event.data;
  if (!message) return;

  if (message.type === "init") {
    await ensureQuickJS();
    const response: SandboxResponse = { type: "ready" };
    ctx.postMessage(response);
    return;
  }

  if (message.type === "eval") {
    const { result, error } = await runCode(message.code);
    if (result) {
      ctx.postMessage({ ...result, id: message.id });
    } else if (error) {
      ctx.postMessage({ ...error, id: message.id });
    }
  }
});
