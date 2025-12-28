import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

// Clean dist folder
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Bundle TypeScript
await build({
  entryPoints: [join(root, "src/main.ts")],
  bundle: true,
  outfile: join(dist, "src/main.js"),
  format: "esm",
  target: "es2020",
  minify: true,
  sourcemap: false,
});

// Copy static assets
cpSync(join(root, "assets"), join(dist, "assets"), { recursive: true });
cpSync(join(root, "styles.css"), join(dist, "styles.css"));

// Copy and fix index.html to use .js instead of .ts
let html = readFileSync(join(root, "index.html"), "utf-8");
html = html.replace(/src\/main\.ts/g, "src/main.js");
writeFileSync(join(dist, "index.html"), html);

console.log("Build complete! Output in ./dist");
