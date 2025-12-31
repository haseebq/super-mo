# Pixi.js Migration

**Epic:** mario-6hra  
**Date:** 2025-01-01  
**Status:** Complete ✅

## Summary

Migrated Super Mo's rendering layer from vanilla Canvas 2D to **Pixi.js** (~100KB), a lightweight WebGL-accelerated 2D renderer. The migration preserves all existing game logic (physics, input, audio) while gaining GPU acceleration.

## Why Pixi.js?

| Criteria | Phaser | Pixi.js | Decision |
|----------|--------|---------|----------|
| License | MIT (free) | MIT (free) | ✅ Both open source |
| Bundle size | ~350KB | ~100KB | ✅ Pixi.js smaller |
| Type | Full game engine | Renderer only | ✅ Pixi.js - we keep our physics |
| Migration effort | Large rewrite | Renderer swap | ✅ Pixi.js - minimal changes |

Since Super Mo already has solid physics, input, and audio systems, we only needed a better renderer - not a whole engine. Pixi.js was the clear winner.

## What Changed

### New Files
- `src/core/pixi-renderer.ts` - Pixi.js renderer adapter implementing our Renderer interface

### Modified Files
- `src/main.ts` - Async initialization of Pixi renderer with Canvas 2D fallback
- `src/core/renderer.ts` - Added optional `render()` method for frame presentation
- `scripts/serve.js` - Updated to bundle dependencies with esbuild

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Game Logic                           │
│    (physics, input, audio, state - unchanged)               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Renderer Interface                        │
│    clear(), rect(), circle(), sprite(), text()              │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
    ┌─────────────────┐      ┌─────────────────┐
    │  Canvas 2D      │      │  Pixi.js        │
    │  (fallback)     │      │  (WebGL)        │
    └─────────────────┘      └─────────────────┘
```

## Key Implementation Details

### Hybrid Rendering Approach
Pixi.js is a scene graph renderer, but our game uses immediate-mode drawing. We bridge this gap by:
1. Pooling Pixi Sprite and Text objects for reuse
2. Tracking transform state (save/restore/translate) and applying to Pixi containers
3. Caching Texture objects by frame coordinates to avoid recreation

### Texture Caching
```typescript
// Cache frame textures by image+coordinates
const key = `${image.src}:${sx},${sy},${sw},${sh}`;
let texture = frameTextureCache.get(key);
if (!texture) {
  texture = new Texture({ source, frame });
  frameTextureCache.set(key, texture);
}
```

### Async Initialization
```typescript
// Start with Canvas 2D, upgrade to Pixi when ready
let renderer = createRenderer(canvas);

(async () => {
  try {
    renderer = await createPixiRenderer(canvas);
  } catch {
    // Canvas 2D fallback
  }
  loop.start();
})();
```

## Test Results

All 13 tests pass:
- Engine boot/state transitions ✅
- Input replay determinism ✅
- Visual regression tests ✅
- Modding API ✅
- Jetpack powerup ✅

## Performance

- **Bundle size increase:** +100KB (Pixi.js)
- **Rendering:** Now GPU-accelerated via WebGL
- **Frame rate:** Stable 60 FPS (unchanged from before)
- **Texture caching:** Prevents per-frame Texture allocations

## Rollback Plan

The Canvas 2D renderer is still in place as a fallback. If Pixi.js fails to initialize, the game automatically uses Canvas 2D. To force Canvas 2D:

```typescript
// In main.ts, comment out the Pixi initialization:
// const pixiRenderer = await createPixiRenderer(canvas);
// renderer = pixiRenderer;
```
