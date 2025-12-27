# Super Mo - HTML5 Architecture

## Overview
A lightweight, modular HTML5 game built on Canvas 2D. The core loop is a fixed-timestep update with variable rendering to keep physics stable and visuals smooth.

## Core Decisions
- **Rendering:** Canvas 2D for fast pixel art rendering.
- **Resolution:** Internal fixed resolution (e.g., 320x180) scaled to fit viewport.
- **Loop:** `requestAnimationFrame` with fixed update step (e.g., 16.67ms).
- **Assets:** Sprite sheets (PNG) and simple JSON metadata.
- **Audio:** Web Audio API for low-latency SFX and loops.

## Directory Layout (Proposed)
```
/index.html
/styles.css
/src/
  main.js            # Bootstraps game
  core/
    loop.js          # Game loop + timing
    renderer.js      # Canvas scaling + draw helpers
    input.js         # Keyboard/touch input
    audio.js         # Web Audio setup
  game/
    world.js         # World/level container
    entity.js        # Base entity
    player.js        # Player logic
    enemies/         # Enemy types
    levels/          # Level data + scripts
  assets/
    sprites.png
    sprites.json
    audio/
      jump.wav
      stomp.wav
/docs/
```

## Game Loop (Pseudo)
```
accumulator += delta
while (accumulator >= step) {
  update(step)
  accumulator -= step
}
render(interp)
```

## Rendering Plan
- Use a single offscreen canvas at internal resolution.
- Scale to screen with `imageSmoothingEnabled = false`.
- Precompute tile maps into a cached layer for fast redraws.

## Input
- Keyboard: arrows + Z/X (jump/run), Enter/P (pause).
- Touch: optional in Phase 1; button overlay if enabled.

## Level Data
- JSON describing tile grid, entity spawn points, and triggers.
- Author levels manually (later: optional editor).

## Performance Targets
- 60 FPS on mid-tier laptops.
- Stable physics under frame spikes.

## Risks
- Scaling artifacts on high-DPI devices.
- Input latency on mobile browsers.
