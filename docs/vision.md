# Super Mo - Vision and Scope

## Vision
Super Mo is a polished, joyful, HTML5 platformer inspired by the tight feel and clarity of classic 16-bit games, with a fresh visual identity and modern responsiveness. It should feel instantly readable, fun in the first 10 seconds, and rewarding to master. The game is lightweight, loads fast, and runs smoothly in modern browsers without plugins.

## Pillars
1. **Crisp Movement**: Responsive controls, consistent physics, and forgiving but skillful jumps.
2. **Readable World**: Clear silhouettes, strong contrast, and predictable interactions.
3. **Playful Surprise**: Small moments of delight (bounces, secret blocks, hidden paths).
4. **Polish First**: Smooth animations, juicy feedback, and cohesive sound/visuals.

## Scope (Phase 1)
- One complete world with 3-5 short levels.
- Core movement: run, jump, short hop, and stomp.
- Enemies: 2-3 classic types with simple behaviors.
- Collectibles: coins + 1 rare collectible per level.
- Simple UI: title screen, level select (or linear progression), HUD, pause.
- Sound: basic SFX + 1-2 looping tracks.

## Out of Scope (Phase 1)
- Multiplayer or online leaderboards.
- Procedural level generation.
- Complex power-up trees or RPG systems.
- Advanced cutscenes or cinematic storytelling.

## Success Criteria
- First-time player reaches the goal in under 5 minutes.
- Input latency feels immediate; no noticeable lag at 60 FPS on mid-tier laptops.
- Visual clarity: player/enemies/interactive blocks are instantly distinct.
- A complete, enjoyable 5-10 minute play session.

## Target Audience
Casual players and nostalgic platformer fans who want a quick, polished experience in the browser.

## Platforms
- Desktop and mobile browsers (touch controls optional in Phase 1).

## AI-Driven Modding Vision (Future)
Enable a secure, browser-contained modding surface that an external AI can live-edit on behalf of the player. The AI runs elsewhere, but only interacts through a tightly scoped, in-browser sandbox that owns all engine code, game content, and assets.

Principles:
- User-directed, reversible: previews, approvals, and rollbacks guard every AI change.
- Sandboxed by default: AI-authored code/assets execute in isolated WASM/Worker/SES-style realms with capability-scoped APIs and no raw network access.
- Whole-stack editable: engine systems, gameplay scripts, scenes, and assets can be patched hot without a full reload; fast state save/restore supports iteration.
- Safety gates: validation, lint/type checks, and smoke tests run before applying changes; runtime kill-switches and quotas prevent abuse.
- Clear provenance: every change is attributed to the AI session with diffs and logs visible to the player.

See `docs/spikes/ai-sandbox-tech.md` for a survey of candidate sandbox tech.
See `docs/spikes/ai-control-loop.md` for the external AI control loop design.
See `docs/spikes/ai-threat-model.md` for abuse cases and mitigations.
See `docs/spikes/hot-reload-scaffolding.md` for patchability assessment.
See `docs/spikes/co-creation-ux.md` for the user-facing flow.

## References
- Classic 16-bit platformer pacing and readability.
- Modern HTML5 indie polish standards (smooth animations, subtle particles).
