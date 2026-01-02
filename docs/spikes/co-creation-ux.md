# Co-Creation UX (AI Edits)

Goal: outline the player-facing UX for AI-proposed edits with clear approval,
plain-language change summaries, previews, telemetry, and recovery.

## Core Flow

1. User enters a prompt.
2. AI proposes a patch + explanation.
3. UI shows a change summary and visual preview.
4. User approves or rejects.
5. Applied changes appear with an easy undo.

## UI Elements

- **Prompt Panel**: text input + presets (gravity, coins, enemies).
- **Change Summary**: plain-language list of what changes and why.
- **Preview Toggle**: apply in a temporary sandbox before commit.
- **Approval Buttons**: Apply / Reject / Undo.

## Safety + Telemetry

- **Safe Mode** toggle: disables AI patches entirely.
- **Rate Limit Banner**: show cooldown or abuse blocks.
- **Telemetry Panel**: request latency, model used, token counts.

## Error Handling

- Validation errors show inline with guidance.
- Patch failures revert automatically with a notice.
- Missing assets prompt a retry or rollback.
