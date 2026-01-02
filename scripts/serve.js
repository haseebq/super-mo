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
};

// Cache for bundled JS
const bundleCache = new Map();

async function bundleEntry(entryPoint, cacheKey) {
  const now = Date.now();
  const cached = bundleCache.get(cacheKey);
  if (cached && now - cached.time < 1000) {
    return cached.text;
  }

  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: "esm",
    target: "es2020",
    sourcemap: "inline",
  });

  const text = result.outputFiles[0].text;
  bundleCache.set(cacheKey, { text, time: now });
  return text;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = join(root, pathname);
  const ext = extname(filePath);

  try {
    const bundleTargets = new Map([
      ["/src/main.js", join(root, "src/main.ts")],
      ["/src/main.ts", join(root, "src/main.ts")],
      [
        "/src/game/modding/sandbox/worker.js",
        join(root, "src/game/modding/sandbox/worker.ts"),
      ],
      [
        "/src/game/modding/sandbox/worker.ts",
        join(root, "src/game/modding/sandbox/worker.ts"),
      ],
    ]);

    const entryPoint = bundleTargets.get(pathname);
    if (entryPoint) {
      const bundled = await bundleEntry(entryPoint, pathname);
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
