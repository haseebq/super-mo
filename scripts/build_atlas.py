#!/usr/bin/env python3
import argparse
import json
from pathlib import Path

from PIL import Image


def load_layout(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def build_atlas(input_path: Path, layout_path: Path, out_image: Path, out_json: Path) -> None:
    layout = load_layout(layout_path)
    sheet = layout["sheet"]
    sprites = layout["sprites"]

    img = Image.open(input_path)
    if img.size != (sheet["width"], sheet["height"]):
        raise ValueError(f"Expected {sheet['width']}x{sheet['height']} input, got {img.size}")

    scale = sheet["scale"]
    target_size = (sheet["width"] // scale, sheet["height"] // scale)
    downscaled = img.resize(target_size, Image.NEAREST)

    cell = sheet["cell"] // scale
    atlas = {}
    for sprite in sprites:
        x = sprite["col"] * cell
        y = sprite["row"] * cell
        atlas[sprite["id"]] = {
            "x": x,
            "y": y,
            "w": sprite["w"],
            "h": sprite["h"],
        }

    out_image.parent.mkdir(parents=True, exist_ok=True)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    downscaled.save(out_image)
    with out_json.open("w", encoding="utf-8") as handle:
        json.dump(atlas, handle, indent=2, sort_keys=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Build sprite atlas from 1024x1024 AI sheet.")
    parser.add_argument("--input", default="art/batch.png", help="1024x1024 source PNG")
    parser.add_argument("--layout", default="art/layout.json", help="Layout manifest JSON")
    parser.add_argument("--out-image", default="assets/sprites.png", help="Output PNG atlas")
    parser.add_argument("--out-json", default="assets/sprites.json", help="Output JSON atlas")
    args = parser.parse_args()

    build_atlas(Path(args.input), Path(args.layout), Path(args.out_image), Path(args.out_json))


if __name__ == "__main__":
    main()
