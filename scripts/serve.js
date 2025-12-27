import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = 4173;

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

const jsCache = new Map();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = join(root, pathname);
  const ext = extname(filePath);

  try {
    if (ext === ".js" && !existsSync(filePath)) {
      const tsPath = filePath.replace(/\.js$/, ".ts");
      if (existsSync(tsPath)) {
        const cached = jsCache.get(tsPath);
        if (cached) {
          res.writeHead(200, { "Content-Type": "text/javascript" });
          res.end(cached);
          return;
        }
        const tsSource = await readFile(tsPath, "utf-8");
        const result = await transform(tsSource, {
          loader: "ts",
          format: "esm",
          target: "es2020",
          sourcefile: tsPath,
        });
        jsCache.set(tsPath, result.code);
        res.writeHead(200, { "Content-Type": "text/javascript" });
        res.end(result.code);
        return;
      }
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
