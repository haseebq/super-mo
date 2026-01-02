# Decision Memo: AI-First Sandboxed Modding

Date: 2026-01-02
Status: Approved

## Summary

We will build the game so an AI can modify nearly all gameplay logic and assets
as a first-class citizen. The AI operates inside a sandboxed runtime and uses
capability-scoped APIs. UX is minimal and fast: AI applies changes after
validation, and rollback happens on request.

## Decisions

1. **AI-first scripting language**
   - Core gameplay logic and rules live in an AI-familiar language (JS subset).
   - Host kernel stays minimal: sandbox boundaries, capability APIs, safety.

2. **Sandboxed execution**
   - Run AI-authored code inside a Web Worker or sandboxed iframe.
   - No DOM access, no direct network, capability-scoped APIs only.

3. **Minimal UX**
   - Apply after validation; no previews or diff summaries.
   - Rollback is prompt-driven (optional undo shortcut).

4. **Practical stack**
   - Default runtime: QuickJS-in-WASM in a Web Worker (`quickjs-emscripten`).
   - JS subset validated via AST allowlist (Acorn/Esprima).
   - Asset safety: SVG sanitation (SVGO) + JSON schema validation.
   - Storage: OPFS with hash manifest for scripts/assets.
   - Rendering hooks: Pixi filters for shader-style changes.

## Constraints

- Permissive licenses only (MIT/BSD/CC0/OFL).
- No direct network access from untrusted code by default.
- Deterministic logging and rollback support.

## Non-Goals (for now)

- Full collaborative editing.
- Complex AI approval flows or rich previews.
- Server-side execution of untrusted game code.

## Execution Plan (Issues)

Epic: Implement AI-first sandboxed modding engine (`mario-2b5s`)

Core runtime and safety
- Select QuickJS WASM wrapper + license verification (`mario-k3mi`).
- Implement sandbox worker runtime + capability APIs (`mario-u5hm`).
- Implement JS subset validator (AST allowlist) (`mario-vb72`).
- Enforce sandbox isolation (CSP/network blocking) (`mario-8205`).

Modding pipeline
- Build sandbox script module loader + hot reload (`mario-3cfb`).
- Expand modding ops for scripts/rendering/audio/assets (`mario-qz4y`).
- Implement patch log + rollback (`mario-h5nz`).

Assets and rendering
- Asset pipeline: SVG sanitation + OPFS manifest (`mario-l87d`).
- Pixi filter pipeline for shader/post-processing (`mario-ubc7`).

UX + integration
- Minimal AI command UI + explanation surface (`mario-baf6`).
- AI gateway/tool-call integration stub (`mario-bvrp`).

Quality
- Tests for sandbox execution, validation, rollback (`mario-b9p4`).
- Docs: AI sandbox runtime + API reference (`mario-qqnb`).

## References

- docs/spikes/ai-sandbox-tech.md
- docs/spikes/live-modding-api.md
- docs/spikes/ai-control-loop.md
- docs/spikes/co-creation-ux.md
