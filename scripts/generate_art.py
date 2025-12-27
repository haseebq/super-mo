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
    parser.add_argument("--model", default="gpt-image-1", help="Image model name")
    parser.add_argument("--size", default="1024x1024", help="Image size")
    parser.add_argument("--out", default="art/batch.png", help="Output PNG path")
    args = parser.parse_args()

    prompt = load_prompt(args.prompt, args.prompt_file)
    image_bytes = generate_image(prompt, args.model, args.size)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(image_bytes)
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
