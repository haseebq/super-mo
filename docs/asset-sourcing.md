# Asset Sourcing for AI Kitbashing

Goal: provide AI-friendly, license-safe asset inputs the agent can remix into game-ready sprites/animations.

## Requirements
- Permissive licenses (prefer CC0/MIT) with clear attribution rules recorded per asset.
- Editable sources (SVG/PSD/BLEND/FBX/GLTF) for kitbashing and retargeting.
- Consistent style families (palette/line weight) to reduce AI harmonization work.
- Runtime-ready formats achievable via templates (vector slices or 3D-to-2D renders).

## Recommended Sources
- **Kenney (CC0)**: 2D/3D packs with clean silhouettes; good for base silhouettes and props.
- **Quaternius (CC0)**: Rigged 3D characters/creatures; use for 3D-to-2D renders + retargeted rigs.
- **Poly Haven (CC0)**: Materials/HDRIs for quick lighting of 3D renders.
- **Itch.io permissive packs**: Curate only CC0/MIT/BSD entries; store license text alongside assets.
- **OpenGameArt filtered**: CC0 entries only; avoid mixed/NC/SA licenses.
- **Google Fonts (OFL)**: For signage/UI diegetic text if needed in renders.

Optional paid (track seats/usage):
- **Synty / BitGem**: Low-poly 3D kits for renders; keep license terms in repo.

## Workflow Notes for AI
- Maintain a curated catalog JSON (path, license, style tags, rig status) the AI can query.
- Favor 3D kits → batch render orthographic passes to SVG/PNG templates the AI can recolor/accessorize.
- Keep base rig templates aligned to our `vector-rigging-spec` for auto-retarget when generating monsters.
- Store source + license alongside derived exports for provenance and rollback.
