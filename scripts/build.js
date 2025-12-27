import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

const indexSource = readFileSync("index.html", "utf-8");
const indexForBuild = indexSource.replaceAll("build/src/", "src/");
writeFileSync(join(buildDir, "index.html"), indexForBuild);
cpSync("styles.css", join(buildDir, "styles.css"));
cpSync("assets", join(buildDir, "assets"), { recursive: true });
