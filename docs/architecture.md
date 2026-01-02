# Super Mo - HTML5 Architecture

## Overview
A lightweight, modular HTML5 game built on Pixi.js (WebGL). The core loop is a fixed-timestep update with variable rendering to keep physics stable and visuals smooth.

## Core Decisions
- **Rendering:** Pixi.js renderer for vector SVG rendering.
- **Resolution:** Internal fixed resolution (e.g., 320x180) scaled to fit viewport.
- **Loop:** `requestAnimationFrame` with fixed update step (e.g., 16.67ms).
- **Scripting:** Core gameplay rules and behaviors live in an AI-editable JS subset;
  the host kernel only enforces sandbox boundaries and platform safety.
- **Assets:** Per-sprite SVG files with lightweight metadata.
- **Audio:** Web Audio API for low-latency SFX and loops.

## Directory Layout (Proposed)
```
/index.html
/styles.css
/src/
  main.ts            # Bootstraps game
  core/
    loop.ts          # Game loop + timing
    renderer.ts      # Renderer interface
    pixi-renderer.ts # Pixi renderer adapter + draw helpers
    input.ts         # Keyboard/touch input
    audio.ts         # Web Audio setup
  game/
    world.js         # World/level container
    entity.js        # Base entity
    player.js        # Player logic
    enemies/         # Enemy types
    levels/          # Level data + scripts
  assets/
    vectors/
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
- Render via Pixi.js at internal resolution and scale to the viewport.
- Use nearest-neighbor scaling to keep pixel-art edges crisp.
- Cache textures and tile layers to minimize per-frame allocations.

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
