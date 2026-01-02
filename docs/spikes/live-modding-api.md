# Live Modding API + Permission Model

Goal: define a safe, granular runtime API for AI-driven edits to engine systems
with validation, sandbox isolation, and fast rollback.

## Capability Model

Capabilities grant access to specific domains. Every request must declare the
capability it needs, and the client validates before apply in a sandbox boundary.
Ops execute inside a sandboxed runtime (Web Worker or sandboxed iframe) with
no direct DOM or network access.

- `rules`: tweak physics/scoring parameters.
- `entities`: remove/spawn entities.
- `assets`: add/replace sprites and rigs (with validation).
- `scenes`: edit level layouts or triggers.
- `rendering`: change shaders or post-processing.
- `audio`: toggle/mix SFX and music behavior.
- `scripts`: edit gameplay logic and engine behaviors within the sandbox.

## Request Lifecycle

1. **Propose**: AI sends a patch with `capability` + `ops`.
2. **Validate**: client runs schema + bounds checks.
3. **Apply**: patch applied in a transaction inside the sandbox; log created.
4. **Rollback**: user can request revert via prompt.

## Intent Examples (Fundamental Changes)

- "Create an enemy helicopter that I can shoot down."
- "Change the background to depict an 1800s motif."
- "Change the artwork to look like a cartoon."
- "I want sound to be turned off."
- "Change the main character to look like a pony."
- "Unlimited bullets."

## Patch Schema (High-Level)

```json
{
  "capability": "rules",
  "ops": [
    { "op": "setRule", "path": "physics.gravity", "value": 120 }
  ],
  "explanation": "Lower gravity for floatier jumps."
}
```

## Validation + Guardrails

- Schema validation per capability.
- Numeric bounds and type checks.
- Denylist high-risk paths (ex: core engine loops).
- Dry-run mode that returns validation errors without applying.

## Scripts and Engine Changes

- Fundamental rule changes are implemented by editing scripts and assets.
- Script edits execute only inside the sandbox runtime with restricted APIs.
- Apply only if validation passes and no forbidden APIs are used.
- Core gameplay logic should be authored in the same sandboxed scripting
  language so the AI can modify nearly all rules and behaviors.

## Scripting Runtime (AI-Familiar)

- Default: JavaScript subset (strict mode, no dynamic code execution).
- Recommended runtime: QuickJS-in-WASM in a Web Worker with capability-scoped APIs.
- Optional fallback: Lua 5.4 via JS/WASM runtime when we want a smaller surface.

## Minimal UX

- Show brief explanation and any warnings.
- Keep diffs internal for audit and rollback.
- Offer prompt-driven rollback (optional undo shortcut).

## Audit + Rollback

- Log every patch with prompt, model, and result.
- Allow undo/redo with bounded history.
- Export log for provenance and debugging.
