#!/usr/bin/env python3
import argparse
import json
import os
from io import BytesIO
from pathlib import Path

from PIL import Image

SPRITE_PROMPT_OVERRIDES = {
    "block": "A single ground/floor tile - grassy green top edge, brown dirt below. Square tile that can repeat horizontally.",
    "player": "A small humanoid platformer hero character standing idle, red shirt, facing right.",
    "player_run1": "A small humanoid platformer hero mid-run frame 1, red shirt, legs apart, facing right.",
    "player_run2": "A small humanoid platformer hero mid-run frame 2, red shirt, opposite leg forward, facing right.",
    "player_jump": "A small humanoid platformer hero jumping pose, red shirt, arms up, facing right.",
    "player_death": "A small humanoid platformer hero hurt/death pose, red shirt, falling backward.",
    "moomba": "A small round enemy creature, purple/brown, simple angry face, idle pose.",
    "moomba_walk1": "A small round enemy creature walking frame 1, purple/brown, one foot forward.",
    "moomba_walk2": "A small round enemy creature walking frame 2, purple/brown, other foot forward.",
    "coin": "A single shiny gold coin, simple circle with shine highlight, collectible item.",
    "shard": "A single crystal shard, angular gem shape, yellow/gold color, collectible item.",
    "goal": "A flag or flagpole end-of-level marker, simple victory flag design.",
    "spikelet": "A small spiky hazard enemy, triangular/pointed shape, dangerous looking.",
    "flit": "A small flying enemy creature, simple wings, hovering pose.",
}

# Sprites that should fill their tile completely (no background removal)
TILE_SPRITES = {"block"}


def load_prompt(prompt: str | None, prompt_file: Path | None) -> str:
    if prompt:
        return prompt
    if prompt_file:
        return prompt_file.read_text(encoding="utf-8").strip()
    return "Pixel art sprite."


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_prompt_from_sprite_template(template: str, sprite_id: str) -> str:
    if "<SPRITE_ID>" not in template:
        # Fallback if template doesn't have the tag
        return f"{template} {SPRITE_PROMPT_OVERRIDES.get(sprite_id, sprite_id)}"
    
    prompt = template.replace("<SPRITE_ID>", sprite_id)
    extra = SPRITE_PROMPT_OVERRIDES.get(sprite_id)
    if extra:
        prompt = f"{prompt}\nDetails: {extra}"
    return prompt


def remove_background(img: Image.Image, tolerance: int = 30) -> Image.Image:
    """Remove background by detecting corner color and making it transparent."""
    img = img.convert("RGBA")
    pixels = img.load()
    w, h = img.size
    # Sample corners to find background color
    corners = [pixels[0, 0], pixels[w-1, 0], pixels[0, h-1], pixels[w-1, h-1]]
    # Use most common corner color as background
    bg_color = max(set(corners), key=corners.count)[:3]

    # Make matching pixels transparent
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if (abs(r - bg_color[0]) < tolerance and
                abs(g - bg_color[1]) < tolerance and
                abs(b - bg_color[2]) < tolerance):
                pixels[x, y] = (0, 0, 0, 0)
    return img


def process_image(
    input_path: Path, 
    out_path: Path, 
    target_size: tuple[int, int], 
    sprite_id: str
) -> None:
    """
    Process a raw generated image:
    1. Center crop (optional, logic preserved)
    2. Remove background
    3. Resize to target pixel dimensions
    """
    print(f"Processing {input_path} -> {out_path} ({target_size})")
    with Image.open(input_path) as img:
        img = img.convert("RGBA")
        
        # Center crop to extract single sprite from potential grid (skip for tiles)
        # Assuming Agent generates a centered subject
        if sprite_id not in TILE_SPRITES:
            w, h = img.size
            crop_size = int(min(w, h) * 0.65)  # Less aggressive crop than before, assuming better framing
            left = (w - crop_size) // 2
            top = (h - crop_size) // 2
            img = img.crop((left, top, left + crop_size, top + crop_size))

        if sprite_id not in TILE_SPRITES:
            img = remove_background(img)
            
        resized = img.resize(target_size, Image.NEAREST)
        resized.save(out_path, format="PNG")


def main() -> None:
    parser = argparse.ArgumentParser(description="Art generation helper.")
    parser.add_argument("--prompt-file", type=Path, default=Path("art/prompt.txt"), help="Path to prompt text")
    parser.add_argument("--layout", type=Path, default=Path("art/layout.json"), help="Layout manifest")
    parser.add_argument(
        "--tiles-dir",
        type=Path,
        default=Path("assets/sprites-src"),
        help="Output directory for per-sprite PNGs",
    )
    parser.add_argument(
        "--process",
        action="store_true",
        help="Process .raw.png files in tiles-dir into final .png files",
    )
    args = parser.parse_args()

    layout = load_json(args.layout)
    sprite_sizes = {entry["id"]: (entry["w"], entry["h"]) for entry in layout.get("sprites", [])}
    template = load_prompt(None, args.prompt_file)
    
    args.tiles_dir.mkdir(parents=True, exist_ok=True)

    if args.process:
        # Processing mode: *.raw.png -> *.png
        processed_count = 0
        for raw_path in args.tiles_dir.glob("*.raw.png"):
            sprite_id = raw_path.name.replace(".raw.png", "")
            if sprite_id not in sprite_sizes:
                print(f"Skipping unknown sprite ID in filename: {raw_path}")
                continue
            
            target_size = sprite_sizes[sprite_id]
            out_path = args.tiles_dir / f"{sprite_id}.png"
            process_image(raw_path, out_path, target_size, sprite_id)
            processed_count += 1
            # Optionally remove raw file? Keeping it for safety for now.
            # raw_path.unlink() 
        
        print(f"Processed {processed_count} images.")
        return

    # Generation Request Mode
    missing = []
    for sprite in layout.get("sprites", []):
        sprite_id = sprite["id"]
        # Check if final file exists
        if not (args.tiles_dir / f"{sprite_id}.png").exists():
            missing.append(sprite_id)

    if not missing:
        print("All sprites present. Run `scripts/build_atlas.py` to stitch.")
        return

    print("-" * 60)
    print(f"MISSING {len(missing)} SPRITES. PLEASE GENERATE:")
    print("-" * 60)
    print("Instructions for Agent:")
    print(f"1. Generate an image for each prompt below.")
    print(f"2. Save the RAW high-res output as `{args.tiles_dir}/<sprite_id>.raw.png`")
    print(f"3. Run `python3 scripts/generate_art.py --process` to convert them.")
    print("-" * 60)
    
    for sprite_id in missing:
        prompt = build_prompt_from_sprite_template(template, sprite_id)
        print(f"ID: {sprite_id}")
        print(f"FILE: {args.tiles_dir}/{sprite_id}.raw.png")
        print(f"PROMPT: {prompt}")
        print("-" * 40)


if __name__ == "__main__":
    main()

if __name__ == "__main__":
    main()
