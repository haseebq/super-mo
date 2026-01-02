# AI Sandbox Runtime

This document describes the in-browser sandbox runtime used for AI-authored
scripts and how those scripts communicate with the game engine.

## Runtime Boundary

- Execution happens in a Web Worker running QuickJS-in-WASM.
- No DOM access is available inside the sandbox.
- Network APIs are explicitly blocked (`fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`).
- The host exposes a small capability API; everything else is unavailable.
- The host can terminate the worker to enforce timeouts or reset state.

## Execution Modes

Scripts are executed via the `runScript` operation:

- **Script mode:** `runScript.code` executes as a plain script.
- **Module mode:** `runScript.module` executes an entry module plus a module map.
  Module paths are normalized by stripping leading `./` or `/` and resolving
  relative imports.

Scripts return operations in either of these forms:

```js
({
  ops: [
    { op: "setRule", path: "physics.gravity", value: 120 }
  ]
})
```

```js
export default {
  ops: [
    { op: "removeEntities", filter: { kind: "enemy" } }
  ]
};
```

## JS Subset Rules

The sandbox validates code before execution.

### Disallowed Syntax

- `import()` (dynamic imports)
- `with`
- `debugger`
- `new.target` and other meta properties
- `import`/`export` in script mode (modules are allowed in module mode)

### Disallowed Calls

- `eval`
- `Function`
- `AsyncFunction`

### Strict Mode

Script mode requires `'use strict'` as the first statement.

## Capability API Reference

The sandbox injects a global `capabilities` object with the following methods.
All calls are converted into patch operations which are validated by the host.

```ts
capabilities.setRule(path: string, value: number): void;
capabilities.setAbility(ability: "fly" | "noclip" | "invincible", active: boolean): void;
capabilities.removeEntities(filter: {
  kind: "coin" | "enemy" | "projectile";
  area?: { x: number; y: number; w: number; h: number };
}): void;
capabilities.emit(op: Record<string, unknown>): void;
```

Additional globals:

- `console.log(...args)` forwards logs to the host for inspection.

## Notes

- Capability calls are batched and returned as operations to the host.
- If validation fails, the script is rejected and no operations are applied.
- The host applies returned operations in order and reports any errors.
