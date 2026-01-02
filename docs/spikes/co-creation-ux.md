# Co-Creation UX (AI Edits)

Goal: outline the player-facing UX for AI-proposed edits with fast application,
minimal UI, telemetry, and recovery.

## Core Flow

1. User enters a prompt.
2. AI applies the patch and returns a short explanation.
3. Applied changes appear immediately.
4. User can ask the AI to roll back if needed.

## UI Elements

- **Prompt Panel**: text input + presets (gravity, coins, enemies).
- **Status Line**: brief explanation and error feedback.

## Safety + Telemetry

- **Safe Mode** toggle: disables AI patches entirely.
- **Rate Limit Banner**: show cooldown or abuse blocks.
- **Telemetry Panel**: request latency, model used, token counts.

## Error Handling

- Validation errors show inline with guidance.
- Patch failures revert automatically with a notice.
- Missing assets prompt a retry or rollback.
