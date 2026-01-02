# Co-Creation UX (AI Edits)

Goal: outline the player-facing UX for AI-proposed edits with fast application,
minimal UI, telemetry, and sandboxed safety.

## Core Flow

1. User enters a prompt.
2. AI applies the patch in a sandboxed runtime and returns a short explanation.
3. Applied changes appear immediately.

## Example Prompts (Fundamental Changes)

- "Create an enemy helicopter that I can shoot down."
- "Change the background to depict an 1800s motif."
- "Change the artwork to look like a cartoon."
- "I want sound to be turned off."
- "Change the main character to look like a pony."
- "Unlimited bullets."

## Design Principle

We are not limited to tuning predefined variables. The AI must be able to
change underlying scripts and assets to alter fundamental game rules.

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
