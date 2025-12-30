# Vector Art Migration Epic

## Goal
Move the game from pixel sprites to vector-based art so characters, particles, and UI scale smoothly with consistent, high-quality animation.

## Why
- Pixel art limits fluid animation and scaling on high-DPI displays.
- Vector rigs allow reusable limbs, consistent proportions, and smoother motion.
- Particles and VFX can be generated procedurally with resolution independence.

## Principles
- Keep gameplay feel unchanged while visuals improve.
- Prefer SVG-based assets (or Lottie/Bodymovin where it makes sense).
- Build a reusable rigging system for characters and enemies.
- Ensure mobile and desktop render parity.

## Non-Goals
- Do not rework level layout or physics during this migration.
- Do not change input systems or gameplay rules.

## Technical Approach
- **Asset format**: SVG with layered groups for body parts; optional JSON rigs for bones.
- **Runtime rendering**:
  - Render vectors to canvas at runtime (via `Path2D` or pre-parsed SVG paths).
  - Cache rasterized frames for performance when needed.
- **Animation**:
  - Build a lightweight skeletal animation system (bones + keyframes + easing).
  - Support procedural animations for particles and squash/stretch.
- **Pipeline**:
  - Author base SVGs directly in-repo via the coding agent (no external image-gen pipeline).
  - Export JSON rigs (bones, pivot points, attachment slots).
  - Follow the rig naming conventions in `docs/vector-rigging-spec.md`.
  - Provide conversion tooling to preview rigs and validate naming conventions.

## Milestones
1. **Spike: Vector Rendering Prototype**
   - Load SVG, draw to canvas, measure perf at 60fps.
   - Decide on SVG parsing approach (native `Image` vs. path-based rendering).
2. **Rigging Spec + Tooling**
   - Define naming rules for limbs/attachments.
   - Add a small rig preview tool (browser page) for iteration.
3. **Animation System Upgrade**
   - Add bone transforms, keyframes, and blending to the animation engine.
   - Reference `docs/vector-animation-system.md` for clip format and usage.
   - Support reuse of animation clips across characters.
4. **Player Migration**
   - Rebuild player art as vector rig.
   - Port idle/run/jump/fall/attack states.
5. **Enemies + Particles**
   - Convert enemy set to vector rigs.
   - Replace key particle effects with vector-based emitters.
6. **Background + UI Pass**
   - Convert HUD icons and core background layers.
   - Ensure clean scaling across aspect ratios.
7. **Polish + Performance**
   - Cache static assets.
   - Profile render hot spots.

## Open Questions
- SVG parsing library vs. custom parser?
- How much runtime raster caching is needed for mobile performance?
- Should UI and HUD stay pixel-styled or move to vector too?

## Success Criteria
- Characters animate smoothly at any resolution.
- Mobile and desktop visuals are crisp without scaling artifacts.
- Animation authoring workflow is documented and repeatable.
