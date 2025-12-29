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

1. **Define sprites**: Use the sprite list in `docs/sprite-sheet.md` and `art/layout.json`.
2. **Identify work**:
   ```bash
   python3 scripts/generate_art.py
   ```
   This will list missing sprites and provide their prompts.
3. **Generate Art (Agent)**:
   - The Agent will use the `generate_image` tool to create a raw, high-resolution 1:1 image for each sprite.
   - Save these as `assets/sprites-src/<id>.raw.png`.
4. **Process Art**:
   ```bash
   python3 scripts/generate_art.py --process
   ```
   This converts `*.raw.png` to pixel-perfect `*.png`:
   - Removes magenta chroma-key background using ratio-based detection
   - Crops to center the sprite
   - Downscales to target pixel dimensions using nearest-neighbor
5. **Stitch atlas**: Compose `assets/sprites.prod.png` using `art/layout.json`.
   ```bash
   python3 scripts/build_atlas.py --tiles-dir assets/sprites-src --layout art/layout.json --mark-production
   ```
6. **QA pass**:
   - Pixel alignment: no blurry edges (nearest-neighbor only).
   - Consistent palette and outline weight.
7. **Integrate**: Verify in-game.

## Automation

The `scripts/build_atlas.py` step stitches per-sprite tiles into the atlas deterministically.

Notes:

- Layout uses 16x16 cells at 1x. Taller sprites (16x24) should occupy empty space below.
- Runtime prefers `assets/sprites.prod.png` + `assets/sprites.prod.json`.

## Notes

- Per-sprite prompt overrides live in `scripts/generate_art.py` for sprites that need extra specificity.
- Use the debug-painted overlay (`?debugPaint=1&debugTiles=1&debugLabels=1`) to verify atlas cell mapping quickly.
- The generator script reads `OPENAI_API_KEY` from the environment or from a local `SECRETS` file (gitignored). Example:
  ```
  OPENAI_API_KEY=your_key_here
  ```
- **Background removal**: The processing script uses intelligent magenta/purple detection based on color ratios (R+B >> G) rather than absolute thresholds. This catches chroma-key backgrounds of varying brightness.
- **Processing order**: Background removal happens BEFORE cropping to ensure edge pixels are properly cleaned.

## QA Checklist

- No anti-aliasing or gradients inside sprites.
- Same light direction across all sprites.
- No new colors beyond the palette (unless explicitly approved).
- Sprites do not clip outside their 16x16 bounds.
