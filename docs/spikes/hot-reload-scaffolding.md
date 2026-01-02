# Hot-Reloadable Engine Scaffolding (Assessment)

Goal: assess runtime patchability and identify safe injection points for AI
diffs without a full reload.

## Current Module Graph

- Single entry: `src/main.ts`.
- Core modules: loop, renderer, input, audio, assets.
- Game modules: level, player, enemies, particles, rockets.
- Modding API already applies limited patches (rules/entities/abilities).

This is a monolithic bundle (esbuild), so hot swapping modules requires a
runtime patch layer rather than true module reload.

## State Serialization

- Full engine state contains non-serializable objects (Pixi renderer, audio).
- `ModdingAPI.getSnapshot()` already provides a JSON-safe subset.
- No built-in full save/restore pipeline for all state.

## Injection Points (Safe)

- **Rules**: `src/game/modding/rules.ts` + `updateRule`.
- **Entities**: removal via `ModdingAPI` adapters.
- **Abilities**: toggles already exist for player flags.
- **Assets**: `loadVectorAssets()` can be re-run to refresh SVGs.
- **Level reset**: `resetLevel()` + `resetRun()` can rehydrate state.

## Missing Hooks

- No formal "apply patch" transaction for assets + levels.
- No snapshot/restore across renderer/audio state.
- No diff validation for non-rule patches.

## Minimal Scaffolding Plan

1. Add a `PatchTransaction` wrapper that groups rule + entity + asset ops.
2. Introduce a lightweight `StateSnapshot` for reloading levels + HUD state.
3. Add `reloadAssets()` that swaps vector assets and rebinds sprites safely.
4. Add a test hook to re-run a short smoke update/render after apply.
