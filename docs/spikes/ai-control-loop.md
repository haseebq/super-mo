# External AI Control Loop Architecture

Goal: design a safe, fast flow where a remote AI service proposes
changes to the in-browser engine, assets, or rules without direct code execution.

## Actors

- **Client (Game UI)**: owns state, applies patches inside a sandbox boundary.
- **AI Gateway (Cloudflare Functions)**: rate limits + policy enforcement.
- **AI Model (Remote)**: returns tool calls and explanations.

## Core Principles

- No client secrets, no system prompts on the client.
- All AI changes are validated before apply.
- Every change is logged for audit and rollback.
- Changes run inside a sandboxed runtime (Web Worker or sandboxed iframe) with
  capability-scoped APIs and no direct network access.
- Core gameplay logic lives in the same scripting runtime so AI edits are
  first-class and broad in scope.

## Protocol Options

### Streaming Patches (SSE/WebSocket)

Pros:
- Early feedback in UI, faster perceived latency.
- Enables progress updates.

Cons:
- More complex to secure and replay.
- Requires stateful sessions and backpressure.

### Bundled Responses (Single JSON)

Pros:
- Simple to secure and validate.
- Easy to record and replay for rollback.

Cons:
- Slower perceived response time.
- No partial feedback until complete.

Recommendation: start with bundled JSON responses; add streaming later only if
latency becomes a UX blocker.

## Request/Response Shape

Client request:
- `prompt`: user text
- `state`: serialized game snapshot
- `model`: allowlisted model id

Server response:
- `tool_calls`: list of patch operations
- `response`: user-facing explanation

Tool calls must support flexible script and asset edits so the AI can change
fundamental game rules, not just tweak predefined variables.

No system prompts or tool schemas accepted from the client.

## Auth + Abuse Protection

- Short-lived, origin-bound session tokens minted by the AI gateway.
- Per-IP + per-session rate limits at the gateway.
- Request size and max token caps enforced server-side.

## Patch Application + Rollback

- Apply patches in a transaction with validation inside the sandbox boundary.
- Log every patch (with timestamp, prompt, model, internal diff).
- Support undo/redo with a bounded patch history.

## Intent Examples

- "Create an enemy helicopter that I can shoot down."
- "Change the background to depict an 1800s motif."
- "Change the artwork to look like a cartoon."
- "I want sound to be turned off."
- "Change the main character to look like a pony."
- "Unlimited bullets."

## Testing Hooks

- Lightweight invariant checks before apply (bounds, missing assets).
- Optional "dry run" that returns validation errors without applying.
- Smoke tests after apply (start level, render frame, input sanity).

## Observability

- Correlation IDs per AI request and per patch.
- Client logs stored locally and optionally exported.
- Server logs include rate-limit hits, failures, and model latency.

## Minimal UX

- Show a brief explanation and any validation warnings.
- Changes apply immediately after validation.
- Rollbacks are requested via prompt (with optional undo shortcut).
