# Co-Creation UX (AI Edits)

Goal: outline the player-facing UX for AI-proposed edits with fast application,
minimal UI, telemetry, and sandboxed safety.

## Core Flow

1. User enters a prompt.
2. AI applies the patch in a sandboxed runtime and returns a short explanation.
3. Applied changes appear immediately.

## UI Elements

- **Prompt Panel**: text input + presets (gravity, coins, enemies).
- **Status Line**: brief explanation and error feedback.
- **Sandbox Indicator**: shows that changes are isolated and gated by capabilities.

## Safety + Telemetry

- **Safe Mode** toggle: disables AI patches entirely.
- **Rate Limit Banner**: show cooldown or abuse blocks.
- **Telemetry Panel**: request latency, model used, token counts.

## Error Handling

- Validation errors show inline with guidance.
- Patch failures revert automatically with a notice.
- Missing assets prompt a retry or rollback.
