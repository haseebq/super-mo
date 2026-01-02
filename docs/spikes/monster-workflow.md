# Monster Creation Workflow (AI-Assisted)

Goal: define an end-to-end, deterministic pipeline for AI-assisted monster
creation that fits the game's vector rig format and license policy.

## Inputs

- Base templates or kitbash parts (permissive licenses only).
- Style constraints from `docs/art-direction.md`.
- Rig spec from `docs/vector-rigging-spec.md`.

## Workflow Steps

1. **Select Base Template**
   - Pick a known rig template (size, proportions, attachment points).
   - Choose kitbash parts (head, body, limbs, accessories) from the library.

2. **Assemble Variants**
   - AI selects part variants and color parameters.
   - Snap parts to predefined anchors (no freeform placement).

3. **Auto-Rig / Retarget**
   - Map assembled parts onto the rig template.
   - Enforce naming + attachment rules (part:body, part:head, etc).

4. **Generate Animation Set**
   - Idle, walk, hit, death (minimum viable set).
   - Retarget motion curves to rig; export keyframes to rig JSON.

5. **Export to Game Formats**
   - SVG sprite(s) into `assets/vectors/sprites`.
   - Rig JSON into `assets/rigs`.
   - Register in `src/game/vector-assets.ts`.

6. **QA Gates**
   - Palette/outline validation.
   - Silhouette readability at game scale.
   - Rig integrity (all required parts + attachments).
   - Animation sanity checks (no limb inversions or NaNs).

## Output Artifacts

- `assets/vectors/sprites/<monster>.svg`
- `assets/rigs/<monster>.json`
- Optional debug preview in `docs/tools/rig-preview.html`

## Notes

- Avoid freeform prompt-only generation for production assets.
- Keep every generated monster traceable to source parts + parameters.
