type AssetManifestEntry = {
  hash: string;
  fileName: string;
  mime: string;
  size: number;
};

export type AssetManifest = {
  version: number;
  updatedAt: number;
  assets: Record<string, AssetManifestEntry>;
};

const MANIFEST_VERSION = 1;
const MANIFEST_NAME = "manifest.json";
const ASSET_DIR = "ai-assets";

const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "pattern",
  "use",
]);

const GLOBAL_ATTRS = new Set([
  "id",
  "transform",
  "opacity",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "vector-effect",
  "clip-path",
  "mask",
]);

const SVG_ATTRS = new Set([
  "xmlns",
  "xmlns:xlink",
  "width",
  "height",
  "viewbox",
  "preserveaspectratio",
]);

const SHAPE_ATTRS = new Set([
  "x",
  "y",
  "x1",
  "x2",
  "y1",
  "y2",
  "width",
  "height",
  "rx",
  "ry",
  "cx",
  "cy",
  "r",
  "fx",
  "fy",
  "d",
  "points",
  "offset",
  "gradientunits",
  "gradienttransform",
  "stop-color",
  "stop-opacity",
  "href",
  "xlink:href",
]);

function createEmptyManifest(): AssetManifest {
  return {
    version: MANIFEST_VERSION,
    updatedAt: Date.now(),
    assets: {},
  };
}

function hasOpfs(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "storage" in navigator &&
    typeof navigator.storage.getDirectory === "function"
  );
}

async function getAssetDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!hasOpfs()) return null;
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(ASSET_DIR, { create: true });
}

async function readManifest(
  dir: FileSystemDirectoryHandle
): Promise<AssetManifest> {
  try {
    const handle = await dir.getFileHandle(MANIFEST_NAME);
    const file = await handle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text) as AssetManifest;
    if (parsed && typeof parsed === "object" && parsed.assets) {
      return {
        version: typeof parsed.version === "number" ? parsed.version : MANIFEST_VERSION,
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        assets: parsed.assets ?? {},
      };
    }
  } catch {
    // Missing or invalid manifest falls back to empty.
  }
  return createEmptyManifest();
}

async function writeManifest(
  dir: FileSystemDirectoryHandle,
  manifest: AssetManifest
): Promise<void> {
  const handle = await dir.getFileHandle(MANIFEST_NAME, { create: true });
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(manifest, null, 2));
  await writable.close();
}

function sanitizeSvg(svg: string): string {
  if (typeof DOMParser === "undefined") {
    throw new Error("SVG sanitizer requires DOMParser.");
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid SVG markup.");
  }
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") {
    throw new Error("SVG root element missing.");
  }

  const allowedForTag = (tag: string) => {
    const attrs = new Set(GLOBAL_ATTRS);
    if (tag === "svg") {
      for (const attr of SVG_ATTRS) attrs.add(attr);
    }
    for (const attr of SHAPE_ATTRS) attrs.add(attr);
    return attrs;
  };

  const sanitizeElement = (el: Element) => {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      el.remove();
      return;
    }

    const allowedAttrs = allowedForTag(tag);
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (!allowedAttrs.has(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "xlink:href") && !attr.value.startsWith("#")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (
        (name === "fill" ||
          name === "stroke" ||
          name === "clip-path" ||
          name === "mask") &&
        /url\(/i.test(attr.value) &&
        !attr.value.includes("#")
      ) {
        el.removeAttribute(attr.name);
      }
    }

    for (const child of Array.from(el.children)) {
      sanitizeElement(child);
    }
  };

  sanitizeElement(root);
  return new XMLSerializer().serializeToString(root);
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadAssetManifest(): Promise<AssetManifest | null> {
  const dir = await getAssetDirectory();
  if (!dir) return null;
  return readManifest(dir);
}

export async function storeSvgAsset(
  id: string,
  svg: string
): Promise<AssetManifestEntry> {
  const dir = await getAssetDirectory();
  if (!dir) {
    throw new Error("OPFS is not available in this environment.");
  }

  const sanitized = sanitizeSvg(svg);
  const hash = await sha256(sanitized);
  const fileName = `${hash}.svg`;
  const fileHandle = await dir.getFileHandle(fileName, { create: true });
  const existing = await fileHandle.getFile().catch(() => null);
  if (!existing || existing.size === 0) {
    const writable = await fileHandle.createWritable();
    await writable.write(sanitized);
    await writable.close();
  }

  const manifest = await readManifest(dir);
  const entry: AssetManifestEntry = {
    hash,
    fileName,
    mime: "image/svg+xml",
    size: sanitized.length,
  };
  manifest.assets[id] = entry;
  manifest.updatedAt = Date.now();
  await writeManifest(dir, manifest);

  return entry;
}

export async function loadSvgOverride(
  id: string,
  manifest?: AssetManifest | null
): Promise<string | null> {
  const dir = await getAssetDirectory();
  if (!dir) return null;
  const resolvedManifest = manifest ?? (await readManifest(dir));
  const entry = resolvedManifest.assets[id];
  if (!entry) return null;

  try {
    const handle = await dir.getFileHandle(entry.fileName);
    const file = await handle.getFile();
    return await file.text();
  } catch {
    return null;
  }
}
