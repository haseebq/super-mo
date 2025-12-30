# Vector Raster Cache

## Goal
Cache rasterized SVGs for fast draw calls, especially on mobile.

## Code Location
`src/core/vector-cache.ts`

## Usage
```ts
import { VectorRasterCache } from "./core/vector-cache.js";

const cache = new VectorRasterCache({ maxEntries: 64 });
const canvas = await cache.getRaster(svgUrlOrMarkup, 64, 64);
ctx.drawImage(canvas, x, y);
```

## Notes
- The cache key includes the source string plus target size.
- Pass SVG markup directly or a URL/path.
- Use a small cache size on mobile to avoid memory spikes.
