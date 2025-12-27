# Super Mo - Artwork Pipeline

## Goal
Define a repeatable pipeline for producing polished, consistent art with AI generation at 1024x1024, then converting it into pixel-accurate sprite sheets and JSON atlases used by the game.

## Inputs
- Asset list (frames + sizes) from `docs/sprite-sheet.md`
- Style rules + palette from `docs/art-direction.md`
- Output target: `assets/sprites.png` + `assets/sprites.json`

## Prompt Template (1024x1024)
Use the same structure for every batch to keep style consistent.

```
You are generating a single 1024x1024 image that contains a grid of pixel-art sprites.
Style: bright, playful 16-bit platformer; clean silhouettes; subtle outlines; soft 1-2 tone shading; light source from top-left.
Palette: #78C7F0 sky, #D4A86A ground, #5DBB63 grass, #A0703D dirt, #E04B3A player, #F6D44D accent, #7B4A6D enemy, #2B2B2B UI.
Grid: 16 columns x 16 rows. Each cell is 64x64 pixels (represents a 16x16 sprite scaled 4x).
Keep sprites centered within cells with 4px padding. No text, no labels, no drop shadows.
Include only the following sprites in this sheet (left to right, top to bottom):
<LIST SPRITES HERE>
```

## Workflow
1. **Define batch**: List sprites/frames to generate (use sprite-sheet doc).
2. **Generate 1024x1024 sheet**: Use the prompt template above or `art/prompt.txt`.
   ```bash
   python3 scripts/generate_art.py --prompt-file art/prompt.txt --out art/batch.png
   ```
3. **Downscale**: Convert 1024x1024 -> 256x256 using nearest-neighbor (4x reduction).
4. **Slice + atlas**: Slice the 256x256 sheet into 16x16 tiles using `art/layout.json` and emit `sprites.json`.
5. **QA pass**:
   - Pixel alignment: no blurry edges (nearest-neighbor only).
   - Consistent palette and outline weight.
   - Frame-to-frame consistency for animations.
6. **Integrate**: Replace `assets/sprites.png` and update atlas JSON; verify in-game.

## Automation (proposed)
Create a small script to:
- Read `art/batch.png` (1024x1024)
- Downscale to `art/batch@1x.png` (256x256) with nearest-neighbor
- Slice into tiles based on `art/layout.json`
- Emit `assets/sprites.png` + `assets/sprites.json`

Notes:
- Layout uses 16x16 cells at 1x. Taller sprites (16x24) should occupy empty space below; avoid placing other sprites in the rows beneath them.
- The reference script uses Pillow (`pip install pillow`).
- Runtime prefers `assets/sprites.png` when present, and falls back to `assets/sprites.svg`.
- The generator script requires `OPENAI_API_KEY` to be set in the environment.

## QA Checklist
- No anti-aliasing or gradients inside sprites.
- Same light direction across all sprites.
- No new colors beyond the palette (unless explicitly approved).
- Sprites do not clip outside their 16x16 bounds.
