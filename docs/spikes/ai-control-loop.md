# External AI Control Loop Architecture

Goal: design a safe, user-approved flow where a remote AI service proposes
changes to the in-browser engine, assets, or rules without direct code execution.

## Actors

- **Client (Game UI)**: owns state, renders previews, applies patches.
- **AI Gateway (Cloudflare Functions)**: rate limits + policy enforcement.
- **AI Model (Remote)**: returns tool calls and explanations.

## Core Principles

- No client secrets, no system prompts on the client.
- All AI changes are proposals until the user approves.
- Every change is logged and reversible.

## Protocol Options

### Streaming Patches (SSE/WebSocket)

Pros:
- Early feedback in UI, faster perceived latency.
- Enables progressive previews.

Cons:
- More complex to secure and replay.
- Requires stateful sessions and backpressure.

### Bundled Responses (Single JSON)

Pros:
- Simple to secure and validate.
- Easy to record and replay for rollback.

Cons:
- Slower perceived response time.
- No partial preview until complete.

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

No system prompts or tool schemas accepted from the client.

## Auth + Abuse Protection

- Short-lived, origin-bound session tokens minted by the AI gateway.
- Per-IP + per-session rate limits at the gateway.
- Request size and max token caps enforced server-side.

## Patch Application + Rollback

- Apply patches in a transaction with validation.
- Log every patch (with timestamp, prompt, model, internal diff).
- Support undo/redo with a bounded patch history.

## Testing Hooks

- Lightweight invariant checks before apply (bounds, missing assets).
- Optional "dry run" that returns validation errors without applying.
- Smoke tests after apply (start level, render frame, input sanity).

## Observability

- Correlation IDs per AI request and per patch.
- Client logs stored locally and optionally exported.
- Server logs include rate-limit hits, failures, and model latency.

## User Approval UX

- Show a plain-language change summary (rules changed, entities removed, assets added).
- Offer "Preview", "Apply", and "Undo" buttons.
- Show model explanation plus any validation warnings.
