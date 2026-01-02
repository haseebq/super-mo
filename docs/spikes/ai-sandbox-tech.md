# AI Sandbox Tech Survey

Goal: identify reusable, permissive-licensed building blocks for an AI-in-browser
sandbox (runtime + FS + collab + hot-reload) and note gaps that need new work.

## Constraints

- Must run in the browser; no native extensions or server-side execution.
- Must not allow raw network access from untrusted code by default.
- Must work under the project's license policy (MIT/BSD/CC0/OFL only).
- Must be capable of deterministic replay or snapshotting for safe rollback.

## Isolation Primitives (Web Platform)

- Web Workers: baseline isolation, message-passing only.
- sandboxed iframes: stricter origin isolation; combine with CSP to block network.
- Service Worker: optional guardrail for network mediation (still needs careful design).

These are standards, so licensing is not a concern. They provide process-level
isolation, but not capability scoping by themselves.

## Options: Pros / Cons

### Origin-Partitioned Workers

Pros:
- Strong isolation, no DOM access, easy to terminate.
- Natural message boundary for capability gating.

Cons:
- Network access still exists unless explicitly blocked.
- No hard CPU/memory limits; requires watchdogs/timeouts.

### Sandboxed iframes + postMessage

Pros:
- Strong origin isolation with sandbox flags.
- Can render UI inside the sandbox if needed.

Cons:
- Network access still exists unless CSP blocks it.
- Heavier than Workers; more complex lifecycle.

### WASM Sandboxes

Pros:
- Deterministic execution with explicit memory sizing.
- Easy to expose a minimal host API surface.

Cons:
- Requires language/runtime embedding (QuickJS/Lua/etc).
- Tooling/debugging overhead vs native JS.

### Realms / SES-Style Guards

Pros:
- Fine-grained capability control in JS.
- Easier to integrate with existing JS code.

Cons:
- SES/Endo is Apache-2.0 (not allowed by policy).
- Realms are not broadly available; shims required.

### FS Emulation (OPFS + shim)

Pros:
- Snapshot-friendly storage for sandboxed edits.
- Works offline and can be per-origin isolated.

Cons:
- Quota limits and async access add complexity.
- Performance varies by browser.

### Capability Scoping

Pros:
- Explicitly auditable surface area for AI actions.
- Works with Workers, iframes, or WASM.

Cons:
- Requires discipline and a robust review model.
- Needs guardrails to prevent accidental privilege leaks.

## Capability Runtimes / SES-Style Guards

- SES/Endo: strong capability model, but Apache-2.0 (not in the allowed list).
  This is a non-starter unless the license policy changes.
- Realms proposal: not broadly available; would still need a shim.

## AI-Familiar Scripting Runtime (Decision)

Primary goal: use a scripting surface any capable AI already knows.

- **Default language:** JavaScript subset (strict mode, no `eval`/`Function`).
- **Execution:** sandboxed Web Worker or sandboxed iframe with CSP blocking
  network and no direct DOM access.
- **Validation:** AST parse + allowlist rules (ex: Acorn/Esprima; MIT/BSD).
- **API surface:** capability-scoped host APIs only (no raw globals).
- **Fallback option:** Lua 5.4 (MIT) via a JS or WASM runtime when we want a
  smaller, more constrained language; AIs typically know Lua as well.
- **Engine policy:** gameplay rules and engine behaviors should live in the same
  scripting runtime so the AI can modify nearly all game logic.

## Practical Tech Stack Recommendation (Decision)

- **Language:** JavaScript subset (strict mode, no dynamic code execution).
- **Runtime:** QuickJS-in-WASM (MIT) running inside a Web Worker.
- **Sandbox boundary:** Worker + capability-scoped host APIs; no DOM or network.
- **Validation:** Acorn (MIT) AST parse + allowlist rules before execution.
- **Storage:** OPFS for scripts/assets + a hash-based manifest (no third-party).
- **Rendering hooks:** Pixi.js filter pipeline for shader-style changes.
- **Assets:** SVGO (MIT) for SVG sanitation + JSON schema for data.
- **Build:** esbuild (MIT) for bundling script modules.

Fallback if QuickJS is not viable: sandboxed iframe with strict CSP and the same
JS subset validator, still gated by capability APIs.

### Selected QuickJS Wrapper (Decision)

- **Package:** `quickjs-emscripten` (MIT).
- **Reason:** widely used, browser-ready WASM build, direct JS API, permissive
  license, and extensive documentation/examples.

### Integration Notes

- Import `getQuickJS()` and create a context per AI session.
- Register capability APIs as host functions (no raw globals).
- Validate source with AST allowlist before `evalCode`.
- Enforce timeouts by killing the Worker (no preemptive CPU limits).
- Dispose values/contexts to avoid leaks (QuickJS requires manual cleanup).

## JS-in-WASM Sandboxes (Potentially MIT)

- QuickJS (WASM builds exist): small and embeddable; can run untrusted JS with a
  host-defined API surface. Verify wrapper license is MIT/BSD/CC0/OFL.
- WASM interpreters (ex: wasm3): useful for deterministic execution, but not a
  full JS environment. Verify license fit and browser suitability.

## In-Browser File Systems

- OPFS (Origin Private File System): built-in, permissioned, per-origin storage.
- BrowserFS / LightningFS / memfs: common in-browser FS shims (often MIT; verify).

## CRDT / Collaboration

- Yjs: commonly MIT; verify license before adoption.
- Automerge: commonly MIT; verify license before adoption.
- Liveblocks / Replicache: commercial/proprietary; not allowed under policy.

## Bundling / Hot-Reload

- esbuild + Vite: commonly MIT; verify license before adoption.
- Sandpack: possible runtime bundling; verify license and dependency terms.
- WebContainers: proprietary; not allowed under policy.

## Gaps Needing New Work

- Capability enforcement: Workers/iframes do not restrict access to globals on
  their own; we need a hardened host API and explicit denylist/allowlist model.
- Resource control: no strong CPU/memory limits; must add timeouts, watchdogs,
  and cooperative yields for safe preemption.
- Deterministic replay: need snapshot/patch logging for rollback and audits.
- Tooling UX: live reload + state diffs + approvals are not provided by any one
  library under the current license constraints.

## Suggested Path (Within Policy)

1. Start with Web Worker isolation + strict message API + CSP to block network.
2. Choose a JS subset runtime (QuickJS-in-WASM or iframe/Worker + validator).
3. Use OPFS + a lightweight FS shim for snapshotting (license check required).
4. Use Yjs or Automerge for collaborative state diffs (license check required).
5. Build a minimal patch log + approval UI for deterministic rollback.

## Recommended Stack (Policy-Compliant, Minimal Viable)

- Host isolation: Web Worker per AI session.
- API boundary: capability-scoped message protocol (no raw fetch).
- Runtime: JS subset (QuickJS-in-WASM or sandboxed iframe/Worker + validator).
- Language: JavaScript subset by default; Lua as an optional fallback.
- Storage: OPFS + small MIT-licensed FS shim (verify license).
- Collab: Yjs or Automerge (verify license).
- Safety: timeouts, op rate limits, and patch validation on every apply.
