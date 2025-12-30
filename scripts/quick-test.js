import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (existsSync("tsconfig.json")) {
  run("npm", ["run", "typecheck"]);
}

run("npm", [
  "run",
  "test",
  "--",
  "tests/engine.spec.js",
  "tests/modding.spec.js",
]);
