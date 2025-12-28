# Super Mo

A Mario-style platformer game with AI-generated pixel art sprites.

## 100% Vibe Coded

**This entire codebase was written by AI assistants (Claude and Codex) with zero human-written code.**

The human's role was limited to:
- Providing high-level instructions and feature requests
- Reporting bugs and issues via `bd` (a CLI issue tracker)
- Saying "keep going" when the AI paused for confirmation

All game logic, rendering, physics, audio synthesis, sprite generation pipeline, level design, and UI were implemented entirely by AI coding assistants.

## Features

- Classic platformer mechanics (run, jump, wall slide, wall jump, dash)
- AI-generated pixel art sprites via InvokeAI/DALL-E pipeline
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

## Tech Stack

- TypeScript
- HTML5 Canvas
- Web Audio API (synthesized audio, no external files)
- esbuild (bundling)
- Playwright (testing)

## Art Pipeline

Sprites are generated using AI image generation:
1. Prompts define each sprite (character, enemy, item, tile)
2. Images generated at 1024x1024 via InvokeAI or OpenAI
3. Center-cropped to isolate single sprite from AI grids
4. Background removed via corner color detection
5. Resized to target dimensions (32x32 or 32x48)
6. Composited into sprite atlas

```bash
# Regenerate sprites (requires InvokeAI or OpenAI API)
python3 scripts/generate_art.py --provider invokeai

# Build sprite atlas
python3 scripts/build_atlas.py --mark-production
```

## License

MIT
