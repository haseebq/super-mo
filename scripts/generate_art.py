#!/usr/bin/env python3
import argparse
import base64
import json
import os
import time
from io import BytesIO
from pathlib import Path
from urllib import request
from urllib.error import HTTPError

from PIL import Image

SECRETS_PATH = Path("SECRETS")
PRODUCTION_MARKER = Path("art/production.json")
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

NEGATIVE_PROMPT = (
    "photograph, realistic, 3d render, blurry, soft edges, anti-aliasing, gradient, "
    "text, letters, words, logo, watermark, signature, label, "
    "scene, landscape, environment, background, ground, floor, sky, clouds, trees, "
    "multiple, duplicates, copies, grid, tilemap, sprite sheet, variations, rows, columns, "
    "game screenshot, level, buildings, repeating pattern"
)


def load_prompt(prompt: str | None, prompt_file: Path | None) -> str:
    if prompt:
        return prompt
    if prompt_file:
        return prompt_file.read_text(encoding="utf-8").strip()
    raise ValueError("Provide --prompt or --prompt-file.")


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_api_key() -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if api_key:
        return api_key
    if SECRETS_PATH.exists():
        for line in SECRETS_PATH.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() == "OPENAI_API_KEY":
                return value.strip()
    raise EnvironmentError("OPENAI_API_KEY is not set.")


def is_production_ready(marker_path: Path) -> bool:
    if not marker_path.exists():
        return False
    try:
        payload = load_json(marker_path)
    except json.JSONDecodeError:
        return False
    return bool(payload.get("production"))


def list_missing_tiles(layout_path: Path, tiles_dir: Path, force_full: bool) -> list[str]:
    layout = load_json(layout_path)
    sprite_ids = [entry["id"] for entry in layout.get("sprites", [])]
    if force_full:
        return sprite_ids
    missing = []
    for sprite_id in sprite_ids:
        if not (tiles_dir / f"{sprite_id}.png").exists():
            missing.append(sprite_id)
    return missing


def build_prompt_from_sprite_template(template: str, sprite_id: str) -> str:
    if "<SPRITE_ID>" not in template:
        raise ValueError("Prompt template missing <SPRITE_ID> placeholder.")
    prompt = template.replace("<SPRITE_ID>", sprite_id)
    extra = SPRITE_PROMPT_OVERRIDES.get(sprite_id)
    if extra:
        prompt = f"{prompt}\nDetails: {extra}"
    return prompt


def generate_image(prompt: str, model: str, size: str) -> bytes:
    api_key = load_api_key()

    payload = json.dumps(
        {
            "model": model,
            "prompt": prompt,
            "size": size,
        }
    ).encode("utf-8")

    req = request.Request(
        "https://api.openai.com/v1/images/generations",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except HTTPError as error:
        details = error.read().decode("utf-8")
        raise RuntimeError(f"OpenAI API error {error.code}: {details}") from error
    image_data = data["data"][0]
    if "b64_json" in image_data:
        return base64.b64decode(image_data["b64_json"])
    if "url" in image_data:
        with request.urlopen(image_data["url"]) as resp:
            return resp.read()
    raise RuntimeError("OpenAI API response missing image data.")


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


# Sprites that should fill their tile completely (no background removal)
TILE_SPRITES = {"block"}


def resize_image(image_bytes: bytes, target_size: tuple[int, int], sprite_id: str = "", center_crop: bool = True) -> bytes:
    with Image.open(BytesIO(image_bytes)) as img:
        img = img.convert("RGBA")
        # Center crop to extract single sprite from potential grid (skip for tiles)
        if center_crop and sprite_id not in TILE_SPRITES:
            w, h = img.size
            crop_size = int(min(w, h) * 0.45)  # Take center 45% to isolate single sprite
            left = (w - crop_size) // 2
            top = (h - crop_size) // 2
            img = img.crop((left, top, left + crop_size, top + crop_size))
        # Remove background before resizing for cleaner edges (skip for tiles)
        if sprite_id not in TILE_SPRITES:
            img = remove_background(img)
        resized = img.resize(target_size, Image.NEAREST)
        out = BytesIO()
        resized.save(out, format="PNG")
        return out.getvalue()


def request_json(url: str, method: str = "GET", payload: dict | None = None) -> dict:
    body = None
    headers = {}
    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = request.Request(url, data=body, headers=headers, method=method)
    try:
        with request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as error:
        details = error.read().decode("utf-8")
        raise RuntimeError(f"InvokeAI API error {error.code}: {details}") from error


def workflow_to_graph(
    workflow: dict,
    prompt: str,
    negative_prompt: str,
    width: int,
    height: int,
    model: dict,
    vae: dict,
) -> dict:
    nodes = {}
    for node in workflow["nodes"]:
        data = node["data"]
        invocation = {
            "id": data["id"],
            "type": data["type"],
            "is_intermediate": data.get("isIntermediate", False),
            "use_cache": data.get("useCache", True),
        }
        for input_name, input_data in data.get("inputs", {}).items():
            if "value" in input_data:
                invocation[input_name] = input_data["value"]

        label = data.get("label", "")
        if data.get("type") == "string" and label == "Positive Prompt":
            invocation["value"] = prompt
        if data.get("type") == "string" and label == "Negative Prompt":
            invocation["value"] = negative_prompt
        if data.get("type") == "noise":
            invocation["width"] = width
            invocation["height"] = height
        if data.get("type") == "sdxl_compel_prompt":
            invocation["original_width"] = width
            invocation["original_height"] = height
            invocation["target_width"] = width
            invocation["target_height"] = height
        if data.get("type") == "sdxl_model_loader":
            invocation["model"] = model
        if data.get("type") == "vae_loader":
            invocation["vae_model"] = vae

        nodes[data["id"]] = invocation

    edges = []
    for edge in workflow["edges"]:
        source_handle = edge.get("sourceHandle")
        target_handle = edge.get("targetHandle")
        if not source_handle or not target_handle:
            continue
        edges.append(
            {
                "source": {"node_id": edge["source"], "field": source_handle},
                "destination": {"node_id": edge["target"], "field": target_handle},
            }
        )

    return {"id": workflow["id"], "nodes": nodes, "edges": edges}


def generate_image_invokeai(prompt: str, out_path: Path) -> None:
    base_url = "http://127.0.0.1:9090"
    outputs_path = Path("/Users/haseebq/invokeai/outputs/conditioning")
    outputs_path.mkdir(parents=True, exist_ok=True)
    workflow_id = "default_5e8b008d-c697-45d0-8883-085a954c6ace"
    workflow_resp = request_json(f"{base_url}/api/v1/workflows/i/{workflow_id}")
    workflow = workflow_resp["workflow"]

    model = request_json(
        f"{base_url}/api/v2/models/get_by_attrs?name=Juggernaut%20XL%20v9&type=main&base=sdxl"
    )
    vae = request_json(
        f"{base_url}/api/v2/models/get_by_attrs?name=sdxl-vae-fp16-fix&type=vae&base=sdxl"
    )

    graph = workflow_to_graph(
        workflow,
        prompt,
        NEGATIVE_PROMPT,
        1024,
        1024,
        model,
        vae,
    )

    batch = {"batch_id": "mario-art", "runs": 1, "graph": graph}
    request_json(
        f"{base_url}/api/v1/queue/default/enqueue_batch",
        method="POST",
        payload={"batch": batch},
    )

    for _ in range(120):
        status = request_json(f"{base_url}/api/v1/queue/default/status")
        queue = status["queue"]
        if queue["pending"] == 0 and queue["in_progress"] == 0:
            break
        time.sleep(2)
    else:
        raise RuntimeError("InvokeAI queue did not finish in time.")

    images = request_json(
        f"{base_url}/api/v1/images/?image_origin=internal&limit=1&offset=0"
    )
    if not images["items"]:
        raise RuntimeError("No InvokeAI images found after generation.")
    image_name = images["items"][0]["image_name"]
    with request.urlopen(f"{base_url}/api/v1/images/i/{image_name}/full") as resp:
        image_bytes = resp.read()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(image_bytes)
    print(f"Wrote {out_path} from InvokeAI")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate per-sprite art tiles.")
    parser.add_argument("--prompt", help="Prompt string to send")
    parser.add_argument("--prompt-file", type=Path, help="Path to prompt text")
    parser.add_argument("--layout", type=Path, default=Path("art/layout.json"), help="Layout manifest")
    parser.add_argument(
        "--tiles-dir",
        type=Path,
        default=Path("assets/sprites-src"),
        help="Output directory for per-sprite PNGs",
    )
    parser.add_argument(
        "--force-full",
        action="store_true",
        help="Generate all sprites even if tiles already exist",
    )
    parser.add_argument("--model", default="gpt-image-1", help="Image model name")
    parser.add_argument(
        "--sprite-size",
        default="1024x1024",
        help="Generation size for each sprite before downscaling",
    )
    parser.add_argument(
        "--provider",
        default="openai",
        choices=["openai", "invokeai"],
        help="Image generation provider",
    )
    args = parser.parse_args()

    prompt = load_prompt(args.prompt, args.prompt_file)
    force_full = args.force_full or not is_production_ready(PRODUCTION_MARKER)
    tiles_dir = args.tiles_dir
    missing = list_missing_tiles(args.layout, tiles_dir, force_full)
    if not missing:
        print("All sprite tiles already exist. Nothing to generate.")
        return

    layout = load_json(args.layout)
    sprite_sizes = {entry["id"]: (entry["w"], entry["h"]) for entry in layout.get("sprites", [])}

    tiles_dir.mkdir(parents=True, exist_ok=True)
    for sprite_id in missing:
        sprite_prompt = build_prompt_from_sprite_template(prompt, sprite_id)
        out_path = tiles_dir / f"{sprite_id}.png"
        if args.provider == "invokeai":
            temp_path = tiles_dir / f"{sprite_id}.raw.png"
            generate_image_invokeai(sprite_prompt, temp_path)
            raw_bytes = temp_path.read_bytes()
            temp_path.unlink()
        else:
            raw_bytes = generate_image(sprite_prompt, args.model, args.sprite_size)
        target_size = sprite_sizes.get(sprite_id)
        if not target_size:
            raise ValueError(f"Missing layout entry for sprite: {sprite_id}")
        resized_bytes = resize_image(raw_bytes, target_size, sprite_id=sprite_id)
        out_path.write_bytes(resized_bytes)
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
