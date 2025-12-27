#!/usr/bin/env python3
import argparse
import base64
import json
import os
from pathlib import Path
from urllib import request


def load_prompt(prompt: str | None, prompt_file: Path | None) -> str:
    if prompt:
        return prompt
    if prompt_file:
        return prompt_file.read_text(encoding="utf-8").strip()
    raise ValueError("Provide --prompt or --prompt-file.")


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def list_missing_sprites(layout_path: Path, atlas_path: Path | None) -> list[str]:
    layout = load_json(layout_path)
    sprite_ids = [entry["id"] for entry in layout.get("sprites", [])]
    if not atlas_path or not atlas_path.exists():
        return sprite_ids
    atlas = load_json(atlas_path)
    missing = [sprite_id for sprite_id in sprite_ids if sprite_id not in atlas]
    return missing


def build_prompt_from_template(template: str, sprite_ids: list[str]) -> str:
    if "<LIST SPRITES HERE>" not in template:
        raise ValueError("Prompt template missing <LIST SPRITES HERE> placeholder.")
    sprite_list = ", ".join(sprite_ids)
    return template.replace("<LIST SPRITES HERE>", sprite_list)


def generate_image(prompt: str, model: str, size: str) -> bytes:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY is not set.")

    payload = json.dumps(
        {
            "model": model,
            "prompt": prompt,
            "size": size,
            "response_format": "b64_json",
        }
    ).encode("utf-8")

    req = request.Request(
        "https://api.openai.com/v1/images",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    b64_data = data["data"][0]["b64_json"]
    return base64.b64decode(b64_data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate art with OpenAI Images API.")
    parser.add_argument("--prompt", help="Prompt string to send")
    parser.add_argument("--prompt-file", type=Path, help="Path to prompt text")
    parser.add_argument("--layout", type=Path, default=Path("art/layout.json"), help="Layout manifest")
    parser.add_argument("--atlas", type=Path, default=Path("assets/sprites.json"), help="Existing atlas")
    parser.add_argument("--model", default="gpt-image-1", help="Image model name")
    parser.add_argument("--size", default="1024x1024", help="Image size")
    parser.add_argument("--out", default="art/batch.png", help="Output PNG path")
    args = parser.parse_args()

    prompt = load_prompt(args.prompt, args.prompt_file)
    missing = list_missing_sprites(args.layout, args.atlas)
    if not missing:
        print("All sprites already exist in the atlas. Nothing to generate.")
        return
    prompt = build_prompt_from_template(prompt, missing)
    image_bytes = generate_image(prompt, args.model, args.size)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(image_bytes)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
