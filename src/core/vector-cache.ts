export type RasterCacheOptions = {
  maxEntries?: number;
};

export class VectorRasterCache {
  private cache = new Map<string, HTMLCanvasElement>();
  private order: string[] = [];

  constructor(private options: RasterCacheOptions = {}) {}

  async getRaster(
    src: string,
    width: number,
    height: number
  ): Promise<HTMLCanvasElement> {
    const key = `${width}x${height}:${src}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const image = await loadSvgImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas 2D context not available for raster cache.");
    }

    ctx.drawImage(image, 0, 0, width, height);

    this.cache.set(key, canvas);
    this.order.push(key);
    this.enforceMaxEntries();

    return canvas;
  }

  clear(): void {
    this.cache.clear();
    this.order = [];
  }

  private enforceMaxEntries() {
    const maxEntries = this.options.maxEntries ?? 64;
    while (this.order.length > maxEntries) {
      const oldest = this.order.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
  }
}

function isSvgMarkup(input: string): boolean {
  return input.trimStart().startsWith("<svg");
}

function toSvgDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg.trim());
  return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

async function loadSvgImage(src: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = "async";
  image.src = isSvgMarkup(src) ? toSvgDataUrl(src) : src;

  if (image.decode) {
    await image.decode();
  } else {
    await new Promise((resolve, reject) => {
      image.onload = () => resolve(null);
      image.onerror = () => reject(new Error("Failed to load SVG image."));
    });
  }

  return image;
}
