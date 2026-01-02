# AI Art Quality Gates

Goal: define automated checks for AI-generated assets before import.

## Palette + Outline Checks

- Only colors from the approved palette.
- Consistent stroke width range (define min/max).
- No gradients or raster embeds unless explicitly approved.

## Silhouette Tests

- Render at game scale (1x) and verify clear outline.
- Reject overly noisy silhouettes (path count threshold).
- Compare against baseline bounding box proportions.

## Animation Readability

- Validate idle/run/jump frames at game scale.
- Ensure limb swaps do not invert or collide.
- Enforce minimum frame spacing for motion clarity.

## Performance Budgets

- SVG size cap (KB limit per asset).
- Path count cap (max path elements).
- Rig JSON size cap.

## Required Checks (Minimum)

1. Palette compliance.
2. Stroke width bounds.
3. File size and path count.
4. Render preview at 1x scale.
