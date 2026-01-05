#!/usr/bin/env node
/**
 * TUI Launcher - Bundles and runs the TUI
 */

import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";
import { spawn } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tuiEntry = join(root, "src/tui/index.ts");
const outFile = join(root, ".tui-bundle.mjs");

async function main() {
  console.log("Building TUI...");

  try {
    await build({
      entryPoints: [tuiEntry],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: outFile,
      external: ["blessed", "@anthropic-ai/sdk"],
      target: "node18",
      sourcemap: false,
      minify: false,
    });

    console.log("Starting TUI...\n");

    // Run the bundled TUI
    const child = spawn("node", [outFile], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code) => {
      // Clean up bundle
      try {
        unlinkSync(outFile);
      } catch {}
      process.exit(code ?? 0);
    });

    // Handle signals
    process.on("SIGINT", () => {
      child.kill("SIGINT");
    });
    process.on("SIGTERM", () => {
      child.kill("SIGTERM");
    });
  } catch (error) {
    console.error("Build failed:", error.message);
    process.exit(1);
  }
}

main();
