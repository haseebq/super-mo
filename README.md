# Super Mo

A Mario-style platformer game with vector SVG art authored by the coding agent.

## 🎮 Play Online

**[Play Super Mo Now!](https://super-mo.pages.dev/)**

The game is automatically deployed via Cloudflare Pages on pushes to the main
branch.

## 100% Vibe Coded

**This entire codebase was written by AI assistants (Claude and Codex) with zero human-written code.**

The human's role was limited to:
- Providing high-level instructions and feature requests
- Reporting bugs and issues via `bd` (a CLI issue tracker)
- Saying "keep going" when the AI paused for confirmation

All game logic, rendering, physics, audio synthesis, sprite generation pipeline, level design, and UI were implemented entirely by AI coding assistants.

## Features

- Classic platformer mechanics (run, jump, wall slide, wall jump, dash)
- Vector SVG assets authored by the coding agent
- Synthesized chiptune music and sound effects
- 6 levels with increasing difficulty
- Enemies: Moomba (stompable), Spikelet (spiky), Flit (flying)
- Collectibles: Coins, Shards, Powerups (Spring, Speed, Shield)
- Spike hazards and pit deaths
- Moving platforms (vertical and circular)
- Checkpoint system

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys | Move left/right |
| Z / Space | Jump |
| Shift | Dash |
| P | Pause |
| M | Toggle audio |

### Advanced Movement
- **Wall Slide**: Hold against a wall while falling to slow descent
- **Wall Jump**: Press jump while wall sliding to leap away
- **Dash**: Quick horizontal burst (0.8s cooldown)

## Running the Game

### Prerequisites
- Node.js (v18+)

### Install & Run

```bash
# Install dependencies
npm install

# Start the development server
npm run serve
```

Then open http://localhost:4173 in your browser.

### Run Tests

```bash
# Quick test (typecheck + playwright)
npm run test:quick

# Full test suite
npm test

# Visual test debugging
npm run test:headed
```

## Cloudflare Pages

Deployments use Wrangler + Cloudflare Pages with Workers AI (gpt-oss-120b).
Configure these CI secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

For local Pages Functions testing (Workers AI requires Cloudflare credentials):

```bash
npm run build
CLOUDFLARE_API_TOKEN=your_token CLOUDFLARE_ACCOUNT_ID=your_account npm run pages:dev
```

## Tech Stack

- TypeScript
- HTML5 Canvas
- Web Audio API (synthesized audio, no external files)
- esbuild (bundling)
- Playwright (testing)

## Art Pipeline

Vector assets live in-repo:
- Sprites: `assets/vectors/sprites`
- Rigs + animations: `assets/rigs` + `assets/vectors`
- HUD + backgrounds: `assets/vectors/hud`, `assets/vectors/backgrounds`

Reference:
- Rigging spec: `docs/vector-rigging-spec.md`

## License

MIT. All third-party code, tools, and art/asset sources must also be permissively licensed (MIT/BSD/CC0/OFL or similar).
