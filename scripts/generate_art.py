#!/usr/bin/env python3
import argparse
import base64
import json
import os
import time
from pathlib import Path
from urllib import request
from urllib.error import HTTPError

SECRETS_PATH = Path("SECRETS")
PRODUCTION_MARKER = Path("art/production.json")


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


def list_missing_sprites(layout_path: Path, atlas_path: Path | None, force_full: bool) -> list[str]:
    layout = load_json(layout_path)
    sprite_ids = [entry["id"] for entry in layout.get("sprites", [])]
    if force_full or not atlas_path or not atlas_path.exists():
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
        "photograph, realistic, 3d, blurry",
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
    parser = argparse.ArgumentParser(description="Generate art with OpenAI Images API.")
    parser.add_argument("--prompt", help="Prompt string to send")
    parser.add_argument("--prompt-file", type=Path, help="Path to prompt text")
    parser.add_argument("--layout", type=Path, default=Path("art/layout.json"), help="Layout manifest")
    parser.add_argument(
        "--atlas",
        type=Path,
        default=Path("assets/sprites.prod.json"),
        help="Existing production atlas",
    )
    parser.add_argument(
        "--force-full",
        action="store_true",
        help="Generate all sprites even if they exist in the atlas",
    )
    parser.add_argument("--model", default="gpt-image-1", help="Image model name")
    parser.add_argument("--size", default="1024x1024", help="Image size")
    parser.add_argument(
        "--provider",
        default="openai",
        choices=["openai", "invokeai"],
        help="Image generation provider",
    )
    parser.add_argument("--out", default="art/batch.png", help="Output PNG path")
    args = parser.parse_args()

    prompt = load_prompt(args.prompt, args.prompt_file)
    force_full = args.force_full or not is_production_ready(PRODUCTION_MARKER)
    missing = list_missing_sprites(args.layout, args.atlas, force_full)
    if not missing:
        print("All sprites already exist in the atlas. Nothing to generate.")
        return
    prompt = build_prompt_from_template(prompt, missing)
    out_path = Path(args.out)
    if args.provider == "invokeai":
        generate_image_invokeai(prompt, out_path)
    else:
        image_bytes = generate_image(prompt, args.model, args.size)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(image_bytes)
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
