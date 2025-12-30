# Vector Rendering Spike

## Goal
Compare SVG rendering approaches for in-game vector art:
- SVG-as-Image (`drawImage` after browser rasterization)
- Canvas `Path2D` rendering

## How to Run
1. `npm run serve`
2. Open `http://127.0.0.1:4173/docs/spikes/vector-rendering.html`
3. Toggle **SVG Image** vs **Path2D** and adjust the sprite count.
4. Use DevTools mobile emulation for lower-end perf.

## What to Measure
- Stable FPS with 200-300 sprites on desktop
- Mobile emulation drop-off point
- CPU usage vs. render quality

## Recommendation
Use SVG Image rendering for most character art (cached rasterized frames), and reserve `Path2D` for procedural particles or simple shapes.

## Notes
- Add real-world perf notes here after running the spike on desktop and mobile emulation.
