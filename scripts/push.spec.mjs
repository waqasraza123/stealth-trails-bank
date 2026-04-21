import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  readFileSync,
  rmSync,
  chmodSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pushScript = path.join(repoRoot, "scripts", "push.mjs");
const safePushScript = path.join(repoRoot, "scripts", "safe-push.sh");
const hookScript = path.join(repoRoot, ".githooks", "pre-push");

function createExecutableStub(directory, name, source) {
  const filePath = path.join(directory, name);
  writeFileSync(filePath, source, "utf8");
  chmodSync(filePath, 0o755);
  return filePath;
}

function createLogLineStub(directory, name, label, exitCode = 0) {
  return createExecutableStub(
    directory,
    name,
    `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
appendFileSync(process.env.LOG_FILE, JSON.stringify({
  tool: ${JSON.stringify(label)},
  args: process.argv.slice(2)
}) + "\\n");
process.exit(${exitCode});
`
  );
}

function runWithStubs(args, options = {}) {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "push-script-test-"));
  const binDir = path.join(tempDir, "bin");
  const logFile = path.join(tempDir, "calls.log");

  try {
    mkdirSync(binDir);

    createExecutableStub(
      binDir,
      "git",
      `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.LOG_FILE, JSON.stringify({
  tool: "git",
  args
}) + "\\n");
if (args[0] === "rev-parse" && args[1] === "--abbrev-ref" && args[2] === "HEAD") {
  process.stdout.write(${JSON.stringify(`${options.gitBranch ?? "main"}\n`)});
  process.exit(0);
}
process.exit(${options.gitExitCode ?? 0});
`
    );
    createLogLineStub(binDir, "pnpm", "pnpm", options.pnpmExitCode ?? 0);

    const result = spawnSync(process.execPath, [pushScript, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        LOG_FILE: logFile,
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    const calls = readLogEntries(logFile);

    return { result, calls };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function readLogEntries(logFile) {
  if (!pathExists(logFile)) {
    return [];
  }

  const contents = readFileSync(logFile, "utf8").trim();

  if (!contents) {
    return [];
  }

  return contents.split("\n").map((line) => JSON.parse(line));
}

function pathExists(filePath) {
  try {
    readFileSync(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}

test("push wrapper runs validation by default and forwards git args with --no-verify", () => {
  const { result, calls } = runWithStubs(["--force", "origin", "main"]);

  assert.equal(result.status, 0);
  assert.deepEqual(calls, [
    {
      tool: "git",
      args: ["rev-parse", "--abbrev-ref", "HEAD"]
    },
    { tool: "pnpm", args: ["verify:push"] },
    {
      tool: "git",
      args: ["push", "--no-verify", "--force", "origin", "main"]
    }
  ]);
});

test("push wrapper keeps the legacy validate flag as a no-op alias", () => {
  const { result, calls } = runWithStubs([
    "--validate-before-push",
    "--force",
    "origin",
    "main"
  ]);

  assert.equal(result.status, 0);
  assert.deepEqual(calls, [
    {
      tool: "git",
      args: ["rev-parse", "--abbrev-ref", "HEAD"]
    },
    { tool: "pnpm", args: ["verify:push"] },
    {
      tool: "git",
      args: ["push", "--no-verify", "--force", "origin", "main"]
    }
  ]);
});

test("push wrapper skips validation on the dev branch", () => {
  const { result, calls } = runWithStubs(["origin", "dev"], {
    gitBranch: "dev"
  });

  assert.equal(result.status, 0);
  assert.deepEqual(calls, [
    {
      tool: "git",
      args: ["rev-parse", "--abbrev-ref", "HEAD"]
    },
    {
      tool: "git",
      args: ["push", "--no-verify", "origin", "dev"]
    }
  ]);
});

test("pre-push hook runs validation and propagates failures", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "pre-push-hook-test-"));
  const binDir = path.join(tempDir, "bin");
  const logFile = path.join(tempDir, "calls.log");

  try {
    mkdirSync(binDir);

    createLogLineStub(binDir, "pnpm", "pnpm", 99);

    const result = spawnSync("sh", [hookScript], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        LOG_FILE: logFile,
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    const calls = readLogEntries(logFile);

    assert.equal(result.status, 99);
    assert.deepEqual(calls, [{ tool: "pnpm", args: ["verify:push"] }]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("pre-push hook skips validation on the dev branch", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "pre-push-hook-dev-test-"));
  const binDir = path.join(tempDir, "bin");
  const logFile = path.join(tempDir, "calls.log");

  try {
    mkdirSync(binDir);

    createExecutableStub(
      binDir,
      "git",
      `#!/usr/bin/env node
const { appendFileSync } = require("node:fs");
const args = process.argv.slice(2);
appendFileSync(process.env.LOG_FILE, JSON.stringify({
  tool: "git",
  args
}) + "\\n");
if (args[0] === "rev-parse" && args[1] === "--show-toplevel") {
  process.stdout.write(process.cwd());
  process.exit(0);
}
if (args[0] === "rev-parse" && args[1] === "--abbrev-ref" && args[2] === "HEAD") {
  process.stdout.write("dev\\n");
  process.exit(0);
}
process.exit(0);
`
    );
    createLogLineStub(binDir, "pnpm", "pnpm", 99);

    const result = spawnSync("sh", [hookScript], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        LOG_FILE: logFile,
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    const calls = readLogEntries(logFile);

    assert.equal(result.status, 0);
    assert.deepEqual(calls, [
      { tool: "git", args: ["rev-parse", "--show-toplevel"] },
      { tool: "git", args: ["rev-parse", "--abbrev-ref", "HEAD"] }
    ]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("safe-push remains a validating alias for the new push wrapper", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "safe-push-test-"));
  const binDir = path.join(tempDir, "bin");

  try {
    mkdirSync(binDir);

    createLogLineStub(binDir, "git", "git");
    createLogLineStub(binDir, "pnpm", "pnpm");

    const result = spawnSync("sh", [safePushScript, "--force", "origin", "main"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        LOG_FILE: path.join(tempDir, "calls.log"),
        PATH: `${binDir}:${process.env.PATH}`
      }
    });

    const calls = readLogEntries(path.join(tempDir, "calls.log"));

    assert.equal(result.status, 0);
    assert.deepEqual(calls, [
      {
        tool: "git",
        args: ["rev-parse", "--abbrev-ref", "HEAD"]
      },
      { tool: "pnpm", args: ["verify:push"] },
      {
        tool: "git",
        args: ["push", "--no-verify", "--force", "origin", "main"]
      }
    ]);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
