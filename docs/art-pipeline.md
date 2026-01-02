# Super Mo - Artwork Pipeline

## Goal
Define a repeatable workflow for SVG vector assets used by the runtime.

## Inputs
- Asset list from `docs/sprite-sheet.md`
- Style rules + palette from `docs/art-direction.md`
- Rigging rules from `docs/vector-rigging-spec.md`

## Workflow
1. **Author SVGs**
   - Create SVGs directly in `assets/vectors/sprites`.
   - Use viewBox sizes aligned to runtime sizes (16x16, 16x24).
2. **Rig Characters**
   - Create rig JSON in `assets/rigs` when a sprite needs animation.
   - Follow bone naming conventions in `docs/vector-rigging-spec.md`.
3. **Preview**
   - Use `docs/tools/rig-preview.html` to validate pivots and attachments.
4. **Integrate**
   - Register sprites in `src/game/vector-assets.ts`.
   - Verify in-game visuals on desktop + mobile.

## QA Checklist
- Consistent palette and outline weight.
- ViewBox matches intended size.
- No raster textures embedded in SVGs.
- Animations read cleanly at game scale.

## AI-Driven Asset Strategy (Future)
- **Primary approach**: Curate permissively licensed base assets (vector packs + 3D kits) and kitbash them via templates the AI can fill (colors, motifs, accessories) instead of freeform generation.
- **Monster workflow**: Pick a base rig template, apply AI-chosen parts/overlays, auto-retarget to our rig spec, render/vectorize to runtime sizes, then export sprites + rig JSON.
- **Tooling stack**: Favor deterministic, template-driven SVG (or 3D-to-2D renders) over prompt-only models; keep assets editable for manual touch-up.
- **Quality gates**: Palette/outline validation, silhouette/readability checks at game scale, animation sanity (idle/run/jump/hit), and performance budgets before import.
- **Provenance**: Track source (pack vs. AI remix), license, and applied templates for each exported asset so replacements/rollbacks stay safe.

See `docs/spikes/ai-generation-toolchain.md` for a full evaluation and
recommended stack.

See `docs/spikes/monster-workflow.md` for the end-to-end monster workflow.
See `docs/spikes/ai-asset-pipeline.md` for AI-authored asset pipeline planning.
