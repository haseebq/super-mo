import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const buildDir = "build";

if (existsSync(buildDir)) {
  rmSync(buildDir, { recursive: true, force: true });
}

mkdirSync(buildDir, { recursive: true });

const result = spawnSync("npx", ["tsc", "-p", "tsconfig.json"], { stdio: "inherit" });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

cpSync("index.html", join(buildDir, "index.html"));
cpSync("styles.css", join(buildDir, "styles.css"));
cpSync("assets", join(buildDir, "assets"), { recursive: true });
