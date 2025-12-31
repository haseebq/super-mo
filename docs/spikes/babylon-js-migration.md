# Spike: Babylon.js Migration Investigation

**Issue:** mario-7qnx  
**Date:** 2025-01-01  
**Status:** Complete

## Summary

This document evaluates whether migrating Super Mo from the current Canvas 2D renderer to Babylon.js would be beneficial.

**Recommendation: Do NOT migrate to Babylon.js.**

The current vanilla Canvas 2D approach is the optimal choice for this 2D platformer. If a framework is desired in the future, consider **Phaser** or **Pixi.js** instead.

---

## Current Architecture

Super Mo uses a lightweight, custom-built rendering stack:

- **Renderer:** Canvas 2D API (`src/core/renderer.ts`) - ~60 lines
- **Game Loop:** Custom requestAnimationFrame loop (`src/core/loop.ts`)
- **Physics:** Hand-rolled tile-based collision and platformer physics
- **Assets:** Vector-based sprites rendered to canvas
- **Dependencies:** Zero runtime dependencies (only dev: esbuild, TypeScript, Playwright)

### Current Bundle Size
- **Runtime dependencies:** 0 KB
- **Total game code:** ~50KB minified (estimate)

---

## Babylon.js Evaluation

### What is Babylon.js?

Babylon.js is a powerful, full-featured **3D game engine** backed by Microsoft. While it can render 2D sprites, it's fundamentally designed for 3D applications.

### Bundle Size Impact

| Option | Minified + Gzipped |
|--------|-------------------|
| Current (vanilla Canvas) | ~0 KB runtime deps |
| Babylon.js (core) | ~800KB - 1.5MB |
| Babylon.js (full) | 6MB+ |
| Pixi.js v8 | ~100KB |
| Phaser 3 | ~300-400KB |

**Babylon.js would increase bundle size by 800KB-6MB** for a 2D platformer that doesn't need 3D features.

### Performance

According to benchmarks (js-game-rendering-benchmark), Babylon.js actually performs well for 2D sprites (56 FPS at 10K sprites). However:

- Super Mo renders <100 sprites per frame
- Current Canvas 2D runs at solid 60 FPS on all targets
- There is no performance problem to solve

### Suitability for 2D Platformers

From Babylon.js core developers (forum):
> "If you want simultaneously 2D and 3D, [Babylon.js] is a good choice. For purely 2D, maybe Pixi.js is a better choice."

Babylon.js:
- ❌ Designed primarily for 3D games
- ❌ No dedicated 2D sprite/platformer features
- ❌ Requires learning 3D concepts (scenes, cameras, lights) for 2D work
- ❌ Massive overhead for simple 2D rendering
- ✅ Excellent for 3D or 2.5D games
- ✅ Great physics via Havok (overkill for tile-based platformer)

### Mobile Support

Babylon.js has good mobile support, but:
- Larger bundle = slower load times on mobile
- WebGL context has higher battery drain than Canvas 2D
- Current approach already works perfectly on mobile

---

## Alternative Frameworks Considered

### If Migration Were Desired

| Framework | Type | Best For | Bundle Size |
|-----------|------|----------|-------------|
| **Pixi.js** | Renderer | Fast 2D graphics, sprite-heavy games | ~100KB |
| **Phaser 3** | Game Engine | 2D games with full feature set | ~350KB |
| **LittleJS** | Lightweight | Small 2D games | ~10KB |
| **Vanilla Canvas** | Native | Simple games, full control | 0KB |

### Recommendation Rankings

1. **Stay with Vanilla Canvas 2D** (current) - Best fit
2. **Phaser 3** - If game complexity grows significantly
3. **Pixi.js** - If only rendering upgrades needed
4. **LittleJS** - If staying lightweight matters
5. **Babylon.js** - Only if pivoting to 3D gameplay

---

## Pros and Cons Summary

### Babylon.js Migration

**Pros:**
- Professional 3D engine if we pivot to 3D
- Havok physics integration
- Active development, Microsoft backing
- Good WebXR support

**Cons:**
- ❌ Massive overkill for 2D platformer
- ❌ 800KB-6MB bundle size increase
- ❌ Learning curve for 3D concepts
- ❌ More complex architecture
- ❌ No meaningful benefit for current game

### Staying with Vanilla Canvas

**Pros:**
- ✅ Zero dependencies
- ✅ Full control over rendering
- ✅ Minimal bundle size
- ✅ Already works well
- ✅ Easy to understand and modify
- ✅ Perfect for 2D platformer

**Cons:**
- Manual implementation of advanced effects
- No built-in physics engine (we have custom physics already)

---

## Conclusion

Babylon.js is an excellent engine for **3D web games**, but it's the wrong tool for Super Mo:

1. **Scope mismatch:** 3D engine for a 2D platformer
2. **Bundle bloat:** 800KB-6MB vs 0KB runtime deps
3. **No benefit:** Current renderer performs perfectly
4. **Complexity:** Would add unnecessary architecture overhead

The current vanilla Canvas 2D approach is elegant, performant, and purpose-built for this game. No migration is recommended.

---

## References

- [Babylon.js Forum: Is BabylonJS suitable for 2D projects?](https://forum.babylonjs.com/t/is-babylonjs-suitable-for-2d-projects/4459)
- [JS Game Rendering Benchmark](https://shirajuki.js.org/js-game-rendering-benchmark/)
- [LogRocket: Best JavaScript Game Engines 2025](https://blog.logrocket.com/best-javascript-html5-game-engines-2025/)
- [Bundlephobia: Pixi.js](https://bundlephobia.com/package/pixi.js)
