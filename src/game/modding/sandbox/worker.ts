import { getQuickJS } from "quickjs-emscripten";
import type {
  SandboxModuleMap,
  SandboxOp,
  SandboxRequest,
  SandboxResponse,
} from "./types.js";

type QuickJSModule = Awaited<ReturnType<typeof getQuickJS>>;

const ctx = self;
let quickjs: QuickJSModule | null = null;
let initPromise: Promise<void> | null = null;

function disableNetworkAccess(): void {
  const blocked = ["fetch", "XMLHttpRequest", "WebSocket", "EventSource"];
  for (const key of blocked) {
    try {
      Object.defineProperty(ctx, key, {
        value: undefined,
        configurable: false,
        writable: false,
      });
    } catch {
      (ctx as unknown as Record<string, unknown>)[key] = undefined;
    }
  }
}

disableNetworkAccess();

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

function collectOpsFromOutput(output: unknown, ops: SandboxOp[]): void {
  if (!output || typeof output !== "object") return;
  const record = output as { ops?: unknown; default?: unknown };
  if (Array.isArray(record.ops)) {
    for (const op of record.ops) {
      const normalized = normalizeOp(op);
      if (normalized) ops.push(normalized);
    }
  }
  if (record.default && typeof record.default === "object") {
    const maybeOps = (record.default as { ops?: unknown }).ops;
    if (Array.isArray(maybeOps)) {
      for (const op of maybeOps) {
        const normalized = normalizeOp(op);
        if (normalized) ops.push(normalized);
      }
    }
  }
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

function normalizeModuleKey(name: string): string {
  const normalized = name.replace(/\\/g, "/");
  if (normalized.startsWith("./")) return normalized.slice(2);
  if (normalized.startsWith("/")) return normalized.slice(1);
  return normalized;
}

function resolveModuleName(baseName: string, requestName: string): string {
  const normalizedRequest = requestName.replace(/\\/g, "/");
  if (
    !normalizedRequest.startsWith(".") &&
    !normalizedRequest.startsWith("/")
  ) {
    return normalizeModuleKey(normalizedRequest);
  }

  const baseParts = baseName.replace(/\\/g, "/").split("/");
  baseParts.pop();

  const requestParts = normalizedRequest.split("/");
  const combined = normalizedRequest.startsWith("/")
    ? requestParts
    : baseParts.concat(requestParts);

  const resolved: string[] = [];
  for (const part of combined) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (resolved.length > 0) resolved.pop();
      continue;
    }
    resolved.push(part);
  }

  return normalizeModuleKey(resolved.join("/"));
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
    collectOpsFromOutput(output, ops);
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

async function runModule(
  entry: string,
  modules: SandboxModuleMap
): Promise<{ result?: SandboxResponse; error?: SandboxResponse }> {
  await ensureQuickJS();
  if (!quickjs) {
    return {
      error: { type: "error", id: "", error: "QuickJS failed to initialize." },
    };
  }

  const moduleSources = new Map<string, string>();
  for (const [name, source] of Object.entries(modules)) {
    moduleSources.set(normalizeModuleKey(name), source);
  }

  const entryName = normalizeModuleKey(entry);
  const entrySource = moduleSources.get(entryName);
  if (!entrySource) {
    return {
      error: {
        type: "error",
        id: "",
        error: `Entry module not found: ${entryName}`,
      },
    };
  }

  const runtime = quickjs.newRuntime();
  runtime.setModuleLoader(
    (moduleName) => {
      const normalized = normalizeModuleKey(moduleName);
      const source = moduleSources.get(normalized);
      if (source == null) {
        return { error: new Error(`Sandbox module not found: ${normalized}`) };
      }
      return source;
    },
    (baseName, requestName) => resolveModuleName(baseName, requestName)
  );

  const vm = runtime.newContext();
  const ops: SandboxOp[] = [];
  const logs: string[] = [];

  registerCapabilities(vm, ops);
  registerConsole(vm, logs);

  let output: unknown;
  let error: string | null = null;

  const evalResult = vm.evalCode(entrySource, entryName, { type: "module" });
  if (evalResult.error) {
    error = safeString(vm.dump(evalResult.error));
    evalResult.error.dispose();
  } else if (evalResult.value) {
    output = vm.dump(evalResult.value);
    evalResult.value.dispose();
    collectOpsFromOutput(output, ops);
  }
  evalResult.dispose();

  vm.dispose();
  runtime.dispose();

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

  if (message.type === "evalModule") {
    const { result, error } = await runModule(message.entry, message.modules);
    if (result) {
      ctx.postMessage({ ...result, id: message.id });
    } else if (error) {
      ctx.postMessage({ ...error, id: message.id });
    }
  }
});
