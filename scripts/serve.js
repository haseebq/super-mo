import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = 4173;

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

// Cache for bundled JS
const bundleCache = new Map();

async function bundleEntry(entryPoint, cacheKey, format = "esm") {
  const now = Date.now();
  const cacheId = `${cacheKey}:${format}`;
  const cached = bundleCache.get(cacheId);
  if (cached && now - cached.time < 1000) {
    return cached.text;
  }

  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format,
    target: "es2020",
    sourcemap: "inline",
  });

  const text = result.outputFiles[0].text;
  bundleCache.set(cacheId, { text, time: now });
  return text;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = join(root, pathname);
  const ext = extname(filePath);

  try {
    if (pathname === "/vendor/quickjs/emscripten-module.wasm") {
      const wasmPath = join(
        root,
        "node_modules/@jitl/quickjs-wasmfile-release-sync/dist/emscripten-module.wasm"
      );
      const data = await readFile(wasmPath);
      res.writeHead(200, { "Content-Type": "application/wasm" });
      res.end(data);
      return;
    }

    const bundleTargets = new Map([
      ["/src/main.js", { entry: join(root, "src/main.ts"), format: "esm" }],
      ["/src/main.ts", { entry: join(root, "src/main.ts"), format: "esm" }],
      [
        "/src/game/modding/sandbox/worker.js",
        { entry: join(root, "src/game/modding/sandbox/worker.ts"), format: "iife" },
      ],
      [
        "/src/game/modding/sandbox/worker.ts",
        { entry: join(root, "src/game/modding/sandbox/worker.ts"), format: "iife" },
      ],
    ]);

    const entryTarget = bundleTargets.get(pathname);
    if (entryTarget) {
      const bundled = await bundleEntry(
        entryTarget.entry,
        pathname,
        entryTarget.format
      );
      res.writeHead(200, { "Content-Type": "text/javascript" });
      res.end(bundled);
      return;
    }

    // Handle HTML - replace .ts with .js
    if (ext === ".html") {
      let html = await readFile(filePath, "utf-8");
      html = html.replace(/src\/main\.ts/g, "src/main.js");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }

    const data = await readFile(filePath);
    const type = types[ext] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Super Mo test server running on http://127.0.0.1:${port}`);
});
