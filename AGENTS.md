# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. This repo is local-only, so do not push.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Sync metadata** - Keep bd in sync:
   ```bash
   bd sync
   ```
5. **Clean up** - Clear stashes
6. **Verify** - All changes committed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- This repo is local-only; do not configure or use a remote

## Commits Per Issue

- Commit changes as you complete and close each bd issue
- Prefer one commit per issue with a clear message that references the issue id

## Pre-Commit Checks

- Run the quick test script before every commit (P0 requirement)
- Keep the quick test fast: typecheck + smoke test where possible

## Handoff Notes

- Run the game via `npm run serve` (esbuild transpiles TS on the fly). `build/` is removed and no longer used.
- Playwright runs against `scripts/serve.js`; if port 4173 is busy, tests fail—kill existing server first.
- Title screen now renders a full-scale scrolling camera (implemented in `mario-0mi`).
- Animation system implemented (core + player/enemy states).
- P1/P2 backlog includes level select + 3 levels, placeholder music/SFX, and expanded powerups.
