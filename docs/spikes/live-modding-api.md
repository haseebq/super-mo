# Live Modding API + Permission Model

Goal: define a safe, granular runtime API for AI-driven edits to engine systems
with validation, dry-run, and fast rollback.

## Capability Model

Capabilities grant access to specific domains. Every request must declare the
capability it needs, and the client validates before apply.

- `rules`: tweak physics/scoring parameters.
- `entities`: remove/spawn entities.
- `assets`: add/replace sprites and rigs (with validation).
- `scenes`: edit level layouts or triggers.
- `scripts`: propose logic changes (restricted, not executable by default).

## Request Lifecycle

1. **Propose**: AI sends a patch with `capability` + `ops`.
2. **Validate**: client runs schema + bounds checks.
3. **Apply**: patch applied in a transaction; log created.
4. **Rollback**: user can request revert via prompt.

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

- AI may only propose script diffs, not execute them.
- Script diffs require explicit approval and a sandboxed test run.
- Apply only if tests pass and no forbidden APIs are used.

## Minimal UX

- Show brief explanation and any warnings.
- Keep diffs internal for audit and rollback.
- Offer prompt-driven rollback (optional undo shortcut).

## Audit + Rollback

- Log every patch with prompt, model, and result.
- Allow undo/redo with bounded history.
- Export log for provenance and debugging.
