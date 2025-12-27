# Super Mo - Artwork Pipeline

## Goal
Define a repeatable pipeline for producing polished, consistent art by generating per-sprite PNGs, then stitching them into pixel-accurate sprite sheets and JSON atlases used by the game.

## Inputs
- Asset list (frames + sizes) from `docs/sprite-sheet.md`
- Style rules + palette from `docs/art-direction.md`
- Output target: `assets/sprites.prod.png` + `assets/sprites.prod.json`

## Prompt Template (per sprite)
Use the same structure for every sprite to keep style consistent.

```
You are generating a single pixel-art sprite for a 16-bit platformer.
Sprite ID: <SPRITE_ID>.
Style: bright, playful 16-bit platformer; clean silhouettes; subtle outlines; soft 1-2 tone shading; light source from top-left.
Palette: #78C7F0 sky, #D4A86A ground, #5DBB63 grass, #A0703D dirt, #E04B3A player, #F6D44D accent, #7B4A6D enemy, #2B2B2B UI.
Canvas: transparent background, sprite centered with minimal padding, no text, no labels, no drop shadows.
```

## Workflow
1. **Define sprites**: Use the sprite list in `docs/sprite-sheet.md`.
2. **Generate per-sprite PNGs**: Use the prompt template above or `art/prompt.txt`.
   ```bash
   python3 scripts/generate_art.py --prompt-file art/prompt.txt --tiles-dir assets/sprites-src
   ```
   InvokeAI local generation:
   ```bash
   python3 scripts/generate_art.py --provider invokeai --prompt-file art/prompt.txt --tiles-dir assets/sprites-src
   ```
3. **Stitch atlas**: Compose `assets/sprites.prod.png` using `art/layout.json`.
   ```bash
   python3 scripts/build_atlas.py --tiles-dir assets/sprites-src --layout art/layout.json --mark-production
   ```
4. **QA pass**:
   - Pixel alignment: no blurry edges (nearest-neighbor only).
   - Consistent palette and outline weight.
   - Frame-to-frame consistency for animations.
5. **Integrate**: Verify in-game.

## Automation
The `scripts/build_atlas.py` step stitches per-sprite tiles into the atlas deterministically.

Notes:
- Layout uses 16x16 cells at 1x. Taller sprites (16x24) should occupy empty space below; avoid placing other sprites in the rows beneath them.
- The reference script uses Pillow (`pip install pillow`).
- Runtime prefers `assets/sprites.prod.png` + `assets/sprites.prod.json` when present, and falls back to placeholder `assets/sprites.svg` + `assets/sprites.json`.
- If `art/production.json` is missing or has `"production": false`, the generator will produce a full set of tiles by default.

## Notes
- Per-sprite prompt overrides live in `scripts/generate_art.py` for sprites that need extra specificity.
- Use the debug-painted overlay (`?debugPaint=1&debugTiles=1&debugLabels=1`) to verify atlas cell mapping quickly.
- The generator script reads `OPENAI_API_KEY` from the environment or from a local `SECRETS` file (gitignored). Example:
  ```
  OPENAI_API_KEY=your_key_here
  ```

## QA Checklist
- No anti-aliasing or gradients inside sprites.
- Same light direction across all sprites.
- No new colors beyond the palette (unless explicitly approved).
- Sprites do not clip outside their 16x16 bounds.
