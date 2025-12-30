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
