# Vector Rigging Spec

## Overview
This spec defines how SVG vector art is structured and how rigs are described in JSON for runtime animation.

## Coordinate System
- All pivots and offsets use SVG viewBox coordinates.
- X grows right, Y grows down.
- The rest pose should face right (positive X).

## SVG Conventions
- Use a single SVG per character or effect.
- Set a fixed viewBox (ex: `0 0 48 48`) and keep it consistent across frames.
- Name renderable groups with `part:` and bones with `bone:`.
- Use dot notation for side and segment ordering.

Example:
```svg
<svg viewBox="0 0 48 48">
  <g id="part:torso">
    <path d="..." />
  </g>
  <g id="part:arm.l.upper">
    <path d="..." />
  </g>
  <g id="part:arm.l.lower">
    <path d="..." />
  </g>
</svg>
```

### Standard Part Names
- `part:root`
- `part:torso`
- `part:head`
- `part:arm.l.upper`
- `part:arm.l.lower`
- `part:hand.l`
- `part:arm.r.upper`
- `part:arm.r.lower`
- `part:hand.r`
- `part:leg.l.upper`
- `part:leg.l.lower`
- `part:foot.l`
- `part:leg.r.upper`
- `part:leg.r.lower`
- `part:foot.r`

Optional:
- `part:eye.l`, `part:eye.r`, `part:brow.l`, `part:brow.r`
- `part:accessory.*` (hats, backpacks, etc.)

## Rig JSON Format
Store rigs alongside art (proposed path: `assets/rigs/NAME.rig.json`).

```json
{
  "version": 1,
  "name": "player",
  "viewBox": [0, 0, 48, 48],
  "root": "root",
  "bones": [
    { "name": "root", "parent": null, "pivot": [24, 40], "z": 0 },
    { "name": "torso", "parent": "root", "pivot": [24, 28], "z": 1 },
    { "name": "head", "parent": "torso", "pivot": [24, 16], "z": 2 },
    { "name": "arm.l.upper", "parent": "torso", "pivot": [18, 24], "z": 3 },
    { "name": "arm.l.lower", "parent": "arm.l.upper", "pivot": [14, 30], "z": 3 },
    { "name": "hand.l", "parent": "arm.l.lower", "pivot": [12, 36], "z": 3 },
    { "name": "arm.r.upper", "parent": "torso", "pivot": [30, 24], "z": 1 },
    { "name": "arm.r.lower", "parent": "arm.r.upper", "pivot": [34, 30], "z": 1 },
    { "name": "hand.r", "parent": "arm.r.lower", "pivot": [36, 36], "z": 1 },
    { "name": "leg.l.upper", "parent": "root", "pivot": [20, 36], "z": 0 },
    { "name": "leg.l.lower", "parent": "leg.l.upper", "pivot": [20, 42], "z": 0 },
    { "name": "foot.l", "parent": "leg.l.lower", "pivot": [20, 46], "z": 0 },
    { "name": "leg.r.upper", "parent": "root", "pivot": [28, 36], "z": 0 },
    { "name": "leg.r.lower", "parent": "leg.r.upper", "pivot": [28, 42], "z": 0 },
    { "name": "foot.r", "parent": "leg.r.lower", "pivot": [28, 46], "z": 0 }
  ],
  "attachments": [
    { "name": "hat", "bone": "head", "offset": [0, -6], "rotation": 0, "z": 5 }
  ]
}
```

## Attachment Slots
- Attachments are defined in the JSON and rendered relative to their bone pivot.
- If the SVG contains `part:accessory.*` elements, they should align with the same attachment name.

## Layering Rules
- Use `z` in the rig JSON for ordering when parts overlap.
- If `z` is missing, fall back to SVG document order.

## Validation Checklist
- Every `part:` has a matching bone of the same name.
- Pivots land on intended joints in the SVG.
- ViewBox dimensions match the art file.

## Preview Tool
Use `docs/tools/rig-preview.html` for a quick sanity check of bone pivots and attachments.

## Sample Assets
- `assets/vectors/player.svg`
- `assets/rigs/player.rig.json`
- `assets/rigs/player.anim.json`
