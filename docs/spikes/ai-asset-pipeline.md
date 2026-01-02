# AI-Authored Asset Pipeline (Plan)

Goal: safely accept AI-proposed art/audio/data changes with validation,
provenance, quotas, caching, and rollback.

## Supported Formats

- Art: SVG only (no embedded raster).
- Audio: generated via in-engine synth or offline conversion to OGG/WAV.
- Data: JSON with strict schemas (level, rig, palette).

## Validation + Transcoding

- **SVG**: strip scripts, external refs, and non-whitelisted tags.
- **Audio**: normalize sample rate/length; cap duration and loudness.
- **JSON**: schema validation + bounds checks.

## Storage + Quotas

- Per-session asset budgets (count + size).
- Per-asset size caps (SVG KB limit, audio duration limit).
- Reject assets that exceed budgets before import.

## Caching + Delivery

- Use content-addressed hashes for dedupe.
- Store assets in OPFS or IndexedDB for local-only changes.
- Optional remote sync with hash-based manifest.

## Provenance Tagging

- Attach `source`, `template_id`, `prompt_id`, and `license` metadata.
- Keep a manifest log per session.

## Rollback + Safety

- Maintain a versioned manifest of assets.
- Allow “revert to last known good” per asset group.
- Require user approval before replacing shipped assets.
