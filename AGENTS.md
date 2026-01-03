# Agent Instructions

## Issue Tracking

This project uses **bd (beads)** for issue tracking.
Run `bd prime` for workflow context, or install hooks (`bd hooks install`) for auto-injection.

**Quick reference:**
- `bd ready` - Find unblocked work
- `bd create "Title" --type task --priority 2` - Create issue
- `bd close <id>` - Complete work
- `bd sync` - Sync with git (run at session end)
- Use only permissive licenses (MIT/BSD/CC0/OFL) for code, assets, and dependencies; reject restrictive terms.
- All work flows through issues: any tangential idea or non-blocking decision gets a new beads issue and is deferred; issues can cover code, planning, or project management.
- Keep docs current: when architecture/process changes, update the relevant docs the same iteration.
- Before working, list open issues (`bd ready` / `bd list --status=open`), triage if priorities or ordering need updates, and then choose the next step; narrate the decision—do not ask the user what to do next.

When creating new issues, think through the dependency chain and add `bd dep` links (blocks or parent-child) so execution order is explicit.

## Getting Started

When a session begins, **automatically start working on open issues**:

1. Run `bd sync` first to pull any issues from upstream (someone else may have created issues in the remote repo)
2. Run `bd ready` to see available work
3. Pick issues in priority order (P0 → P1 → P2 → P3)
4. For same-priority issues, use your judgment on logical order (e.g., fix blockers first, group related work)
5. Mark the issue as in-progress: `bd update <id> --status in_progress`
6. Complete the work, commit, and close: `bd close <id>`
7. Move to the next issue

**Do not ask the user which issue to work on**—just start with the highest priority available work.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
bd sync               # Sync with git
```

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below.

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
- This repo uses a remote; push your commits when work is complete

## Commits Per Issue

- Commit changes as you complete and close each bd issue, then push
- Prefer one commit per issue with a clear message that references the issue id

## Pre-Commit Checks

- Run the quick test script before every commit (P0 requirement)
- Run Playwright tests before every commit: `npm run test`
- Keep the quick test fast: typecheck + smoke test where possible

## Post-Commit Testing

After each commit, verify the game works on both desktop and mobile:

**Treat mobile and desktop as equally important targets.** Always think about impact on both, with extra care for mobile UX.

### Desktop Testing

```bash
# Run automated tests
npm run test:quick

# Manual verification (if UI changed)
npm run serve
# Open http://localhost:4173 in browser
# Verify: title screen loads, game starts on Enter, controls work
```

### Mobile Testing

Mobile testing requires manual verification or device emulation:

1. **Browser DevTools (Quick Check)**
   - Open http://localhost:4173 in Chrome/Firefox
   - Open DevTools (F12) → Toggle Device Toolbar (Ctrl+Shift+M)
   - Select a mobile device preset (iPhone, Pixel, etc.)
   - Verify:
     - Touch controls appear (D-pad on left, Jump/Dash on right)
     - "Tap to Start" text shows instead of "Press Enter"
     - Layout fits screen without horizontal scroll
     - Tap on overlays advances game state

2. **Touch Control Checklist**
   - [ ] D-pad left/right moves player
   - [ ] Jump button makes player jump
   - [ ] Dash button triggers dash
   - [ ] Pause button (top-right) pauses game
   - [ ] Tapping overlays (start, story, intro, complete) works

3. **Responsive Layout Checklist**
   - [ ] Portrait mode: game canvas scales, HUD readable
   - [ ] Landscape mode: game uses available width
   - [ ] No content cut off or overlapping

### When to Test

- **Always run `npm run test:quick`** before committing
- **Manual desktop test** if: UI/overlay changes, input changes, rendering changes
- **Mobile test** if: CSS changes, touch controls modified, new UI elements added

### Playwright Mobile Emulation (Optional)

For automated mobile testing, add to test files:

```typescript
import { devices } from '@playwright/test';

test.use({ ...devices['iPhone 13'] });

test('mobile touch controls visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#touch-controls')).toBeVisible();
});
```

## Handoff Notes

- Run the game via `npm run serve` (esbuild transpiles TS on the fly). `build/` is removed and no longer used.
- Playwright runs against `scripts/serve.js`; if port 4173 is busy, tests fail—kill existing server first.

<!-- bv-agent-instructions-v1 -->

---

## Beads Workflow Integration

This project uses [beads_viewer](https://github.com/Dicklesworthstone/beads_viewer) for issue tracking. Issues are stored in `.beads/` and tracked in git.

### Essential Commands

```bash
# View issues (launches TUI - avoid in automated sessions)
bv

# CLI commands for agents (use these instead)
bd ready              # Show issues ready to work (no blockers)
bd list --status=open # All open issues
bd show <id>          # Full issue details with dependencies
bd create --title="..." --type=task --priority=2
bd update <id> --status=in_progress
bd close <id> --reason="Completed"
bd close <id1> <id2>  # Close multiple issues at once
bd sync               # Commit and push changes
```

### Workflow Pattern

1. **Sync first**: Run `bd sync` at session start to pull upstream issues (others may have created issues)
2. **Start**: Run `bd ready` to find actionable work
3. **Claim**: Use `bd update <id> --status=in_progress`
4. **Work**: Implement the task
5. **Complete**: Use `bd close <id>`
6. **Sync**: Always run `bd sync` at session end

### Key Concepts

- **Dependencies**: Issues can block other issues. `bd ready` shows only unblocked work.
- **Priority**: P0=critical, P1=high, P2=medium, P3=low, P4=backlog (use numbers, not words)
- **Types**: task, bug, feature, epic, question, docs
- **Blocking**: `bd dep add <issue> <depends-on>` to add dependencies

### Session Protocol

**Before ending any session, run this checklist:**

```bash
git status              # Check what changed
git add <files>         # Stage code changes
bd sync                 # Commit beads changes
git commit -m "..."     # Commit code
bd sync                 # Commit any new beads changes
git push                # Push to remote
```

### Best Practices

- **Always run `bd sync` at session start** to pull any upstream issues (others may have created issues in the remote repo)
- Check `bd ready` at session start to find available work
- Update status as you work (in_progress → closed)
- Create new issues with `bd create` when you discover tasks
- Use descriptive titles and set appropriate priority/type
- Always `bd sync` before ending session

<!-- end-bv-agent-instructions -->
