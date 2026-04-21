#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot(),
    encoding: "utf8",
    stdio: "inherit"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function readCurrentBranch() {
  const result = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    cwd: repoRoot(),
    encoding: "utf8"
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return result.stdout.trim();
}

function main() {
  const forwardedArgs = [];

  for (const arg of process.argv.slice(2)) {
    if (arg === "--validate-before-push") {
      continue;
    }

    forwardedArgs.push(arg);
  }

  if (readCurrentBranch() !== "dev") {
    runCommand("pnpm", ["verify:push"]);
  }

  runCommand("git", ["push", "--no-verify", ...forwardedArgs]);
}

main();
