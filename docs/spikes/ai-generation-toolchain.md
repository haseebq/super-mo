# AI-Friendly Generation Toolchain Evaluation

Goal: compare AI-friendly content generation approaches and recommend a primary
stack that is deterministic, editable, and license-compliant.

## Constraints

- Only permissive licenses (MIT/BSD/CC0/OFL) for code/assets/deps.
- Outputs must be deterministic and diffable for rollback.
- Style must match `docs/art-direction.md` and rig rules.

## Approach Comparison

### Template-Driven SVG Variants

Pros:
- Deterministic and diffable; easy to validate.
- Keeps style consistent (palette + stroke rules).
- AI is strongest at filling parameters and selecting variants.

Cons:
- Requires upfront template authoring.
- Limited expressiveness outside the template space.

### 3D-to-2D Render Pipeline

Pros:
- Consistent lighting/perspective across assets.
- Easier to animate and retarget to rigs.
- Good for multi-angle sprites and effects.

Cons:
- Toolchain complexity is higher.
- Many popular tools are GPL or proprietary; must avoid.
- Raster-to-vector conversion can be lossy.

### Procedural Generators (SVG or JS)

Pros:
- Fully deterministic and controllable.
- Great for backgrounds, particles, and variations.
- No licensing ambiguity if we own the code.

Cons:
- Engineering time to build each generator.
- Risk of stylistic drift without strict style constraints.

### Minimal Prompt Styles (Freeform)

Pros:
- Fast for ideation and exploration.
- Low upfront tooling cost.

Cons:
- Inconsistent outputs and low repeatability.
- Cleanup costs are high; license/terms are uncertain.
- Poor fit for deterministic pipelines.

## Recommended Primary Stack

1. **Template-driven SVG as the backbone**
   - Define per-asset templates with named parts and parameter schemas.
   - AI picks variants and fills parameters (colors, accessories, motifs).
2. **Procedural generators for repeatable sets**
   - Use deterministic SVG or JS generators for backgrounds and particles.
3. **Selective 3D-to-2D for complex rigs**
   - Only if the 3D toolchain is MIT/BSD/CC0/OFL compliant.
   - Prefer vector-capable renderers (avoid raster-to-vector when possible).
4. **Prompt-only generation stays out of production**
   - Keep for concepting only; do not ship outputs directly.

## Tooling Notes (License-Safe Defaults)

- SVG normalization: SVGO (commonly MIT; verify).
- Bundling/build: esbuild (MIT).
- Param schemas: JSON Schema in-repo; no runtime dependency required.
- Validation: palette/stroke checks + viewBox/raster guards.

## Open Gaps

- A permissive 3D pipeline for vector output (if we need it).
- Automated rig retargeting that preserves attachment points.
- Batch validation tooling for template parameter ranges.
