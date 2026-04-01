import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  loadDatabaseRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";

type ScriptOptions = {
  applyChanges: boolean;
  email?: string;
  limit?: number;
  exportManualReview: boolean;
  manualReviewOutputPath?: string;
  reportOutputPath?: string;
  includeRepairEventSummary: boolean;
  repairEventLimit: number;
};

type JsonObject = Record<string, unknown>;
type NumericSummary = Record<string, number>;

type BatchStepKey =
  | "preRepairAudit"
  | "repairMissingCustomerProjection"
  | "repairMissingCustomerAccount"
  | "repairWalletOnly"
  | "postRepairAudit"
  | "manualReviewExport";

type BatchStepResult = {
  command: string;
  summary: JsonObject;
};

type MetricDelta = {
  before: number;
  after: number;
  delta: number;
};

type BatchDeltaReport = {
  byMetric: Record<string, MetricDelta>;
  highlights: {
    walletProjected: MetricDelta | null;
    autoRepairableProfiles: MetricDelta | null;
    manualReviewProfiles: MetricDelta | null;
    legacySourceProfiles: MetricDelta | null;
  };
};

type RepairEventAuditResult = {
  enabled: boolean;
  batchRunId: string | null;
  limit: number | null;
  command: string | null;
  summary: JsonObject | null;
  recentEvents: unknown[];
};

type BatchResult = {
  mode: "dry-run" | "apply";
  productChainId: number;
  filters: {
    email: string | null;
    limit: number | null;
  };
  steps: Partial<Record<BatchStepKey, BatchStepResult>>;
  delta: BatchDeltaReport;
  repairEventAudit: RepairEventAuditResult;
  manualReviewExport: {
    enabled: boolean;
    outputPath: string | null;
  };
  reportOutputPath: string | null;
};

const DEFAULT_MANUAL_REVIEW_OUTPUT_PATH =
  ".artifacts/wallet-manual-review-batch.json";

function parseOptions(argv: string[]): ScriptOptions {
  let applyChanges = false;
  let email: string | undefined;
  let limit: number | undefined;
  let exportManualReview = false;
  let manualReviewOutputPath: string | undefined;
  let reportOutputPath: string | undefined;
  let includeRepairEventSummary = false;
  let repairEventLimit = 200;

  for (const argument of argv) {
    if (argument === "--") {
      continue;
    }

    if (argument === "--apply") {
      applyChanges = true;
      continue;
    }

    if (argument === "--export-manual-review") {
      exportManualReview = true;
      continue;
    }

    if (argument === "--include-repair-event-summary") {
      includeRepairEventSummary = true;
      continue;
    }

    if (argument.startsWith("--email=")) {
      const emailValue = argument.slice("--email=".length).trim();

      if (!emailValue) {
        throw new Error("The --email option requires a non-empty value.");
      }

      email = emailValue;
      continue;
    }

    if (argument.startsWith("--limit=")) {
      const rawLimit = argument.slice("--limit=".length).trim();
      const parsedLimit = Number(rawLimit);

      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        throw new Error("The --limit option must be a positive integer.");
      }

      limit = parsedLimit;
      continue;
    }

    if (argument.startsWith("--manual-review-output=")) {
      const outputValue = argument
        .slice("--manual-review-output=".length)
        .trim();

      if (!outputValue) {
        throw new Error(
          "The --manual-review-output option requires a non-empty value."
        );
      }

      manualReviewOutputPath = outputValue;
      exportManualReview = true;
      continue;
    }

    if (argument.startsWith("--report-output=")) {
      const outputValue = argument.slice("--report-output=".length).trim();

      if (!outputValue) {
        throw new Error(
          "The --report-output option requires a non-empty value."
        );
      }

      reportOutputPath = outputValue;
      continue;
    }

    if (argument.startsWith("--repair-event-limit=")) {
      const rawLimit = argument.slice("--repair-event-limit=".length).trim();
      const parsedLimit = Number(rawLimit);

      if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
        throw new Error(
          "The --repair-event-limit option must be a positive integer."
        );
      }

      repairEventLimit = parsedLimit;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (includeRepairEventSummary && !applyChanges) {
    throw new Error(
      "The --include-repair-event-summary option requires --apply because dry-run does not write audit events."
    );
  }

  return {
    applyChanges,
    email,
    limit,
    exportManualReview,
    manualReviewOutputPath,
    reportOutputPath,
    includeRepairEventSummary,
    repairEventLimit
  };
}

function buildSharedArgs(options: ScriptOptions): string[] {
  const args: string[] = [];

  if (options.email) {
    args.push(`--email=${options.email}`);
  }

  if (options.limit) {
    args.push(`--limit=${options.limit}`);
  }

  return args;
}

function extractJsonPayload(stdout: string): JsonObject {
  const trimmedOutput = stdout.trim();

  if (!trimmedOutput) {
    throw new Error("Command did not produce JSON output.");
  }

  try {
    return JSON.parse(trimmedOutput) as JsonObject;
  } catch {
    const firstBraceIndex = trimmedOutput.indexOf("{");
    const lastBraceIndex = trimmedOutput.lastIndexOf("}");

    if (firstBraceIndex === -1 || lastBraceIndex === -1) {
      throw new Error("Command output could not be parsed as JSON.");
    }

    const possibleJson = trimmedOutput.slice(
      firstBraceIndex,
      lastBraceIndex + 1
    );

    return JSON.parse(possibleJson) as JsonObject;
  }
}

function extractSummary(payload: JsonObject): JsonObject {
  const summary = payload["summary"];

  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    throw new Error("Command JSON output did not contain a summary object.");
  }

  return summary as JsonObject;
}

function extractRecentEvents(payload: JsonObject): unknown[] {
  const recentEvents = payload["recentEvents"];

  if (!Array.isArray(recentEvents)) {
    throw new Error("Command JSON output did not contain a recentEvents array.");
  }

  return recentEvents;
}

function extractNumericSummary(summary: JsonObject): NumericSummary {
  const numericSummary: NumericSummary = {};

  for (const [key, value] of Object.entries(summary)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      numericSummary[key] = value;
    }
  }

  return numericSummary;
}

function buildDeltaReport(
  beforeSummary: JsonObject,
  afterSummary: JsonObject
): BatchDeltaReport {
  const beforeNumeric = extractNumericSummary(beforeSummary);
  const afterNumeric = extractNumericSummary(afterSummary);
  const metricNames = new Set([
    ...Object.keys(beforeNumeric),
    ...Object.keys(afterNumeric)
  ]);

  const byMetric: Record<string, MetricDelta> = {};

  for (const metricName of metricNames) {
    if (metricName === "productChainId") {
      continue;
    }

    const before = beforeNumeric[metricName] ?? 0;
    const after = afterNumeric[metricName] ?? 0;

    byMetric[metricName] = {
      before,
      after,
      delta: after - before
    };
  }

  return {
    byMetric,
    highlights: {
      walletProjected: byMetric["walletProjected"] ?? null,
      autoRepairableProfiles: byMetric["autoRepairableProfiles"] ?? null,
      manualReviewProfiles: byMetric["manualReviewProfiles"] ?? null,
      legacySourceProfiles: byMetric["legacySourceProfiles"] ?? null
    }
  };
}

async function writeOutputFile(
  apiRootDir: string,
  outputPath: string,
  payload: unknown
): Promise<void> {
  const resolvedOutputPath = resolve(apiRootDir, outputPath);
  await mkdir(dirname(resolvedOutputPath), { recursive: true });
  await writeFile(resolvedOutputPath, JSON.stringify(payload, null, 2), "utf-8");
}

function runJsonScript(
  scriptFileName: string,
  scriptArgs: string[],
  envOverrides?: NodeJS.ProcessEnv
): { command: string; payload: JsonObject } {
  const scriptsDir = __dirname;
  const apiRootDir = resolve(scriptsDir, "..", "..");
  const scriptPath = resolve(scriptsDir, scriptFileName);
  const tsNodeRegisterPath = require.resolve("ts-node/register/transpile-only");
  const nodeArgs = ["-r", tsNodeRegisterPath, scriptPath, ...scriptArgs];

  const result = spawnSync(process.execPath, nodeArgs, {
    cwd: apiRootDir,
    encoding: "utf-8",
    env: {
      ...process.env,
      ...envOverrides
    },
    maxBuffer: 10 * 1024 * 1024
  });

  const command = [process.execPath, ...nodeArgs].join(" ");

  if (result.error) {
    throw new Error(
      `Failed to execute ${scriptFileName}: ${result.error.message}`
    );
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    const errorOutput = [stderr, stdout].filter(Boolean).join("\n");

    throw new Error(
      `Step failed for ${scriptFileName}.\nCommand: ${command}\n${errorOutput}`
    );
  }

  return {
    command,
    payload: extractJsonPayload(result.stdout)
  };
}

function runRepairStep(
  scriptFileName: string,
  options: ScriptOptions,
  batchRunId: string | null
): BatchStepResult {
  const args = buildSharedArgs(options);

  if (options.applyChanges) {
    args.push("--apply");
  }

  const envOverrides =
    batchRunId && options.applyChanges
      ? {
          WALLET_PROJECTION_BATCH_RUN_ID: batchRunId
        }
      : undefined;

  const result = runJsonScript(scriptFileName, args, envOverrides);

  return {
    command: result.command,
    summary: extractSummary(result.payload)
  };
}

function runAuditSummaryStep(options: ScriptOptions): BatchStepResult {
  const args = [...buildSharedArgs(options), "--summary-only"];
  const result = runJsonScript("audit-wallet-projection-coverage.ts", args);

  return {
    command: result.command,
    summary: extractSummary(result.payload)
  };
}

function runManualReviewExportStep(options: ScriptOptions): BatchStepResult {
  const outputPath =
    options.manualReviewOutputPath ?? DEFAULT_MANUAL_REVIEW_OUTPUT_PATH;
  const args = [
    ...buildSharedArgs(options),
    "--format=json",
    `--output=${outputPath}`
  ];
  const result = runJsonScript(
    "export-wallet-projection-manual-review-queue.ts",
    args
  );

  return {
    command: result.command,
    summary: extractSummary(result.payload)
  };
}

function runRepairEventAudit(
  batchRunId: string,
  repairEventLimit: number
): {
  command: string;
  summary: JsonObject;
  recentEvents: unknown[];
} {
  const args = [
    "--days=7",
    `--limit=${repairEventLimit}`,
    `--batch-run-id=${batchRunId}`
  ];
  const result = runJsonScript("audit-wallet-projection-repair-events.ts", args);

  return {
    command: result.command,
    summary: extractSummary(result.payload),
    recentEvents: extractRecentEvents(result.payload)
  };
}

async function main(): Promise<void> {
  loadDatabaseRuntimeConfig();

  const options = parseOptions(process.argv.slice(2));
  const scriptsDir = __dirname;
  const apiRootDir = resolve(scriptsDir, "..", "..");
  const productChainId = loadProductChainRuntimeConfig().productChainId;
  const batchRunId = options.applyChanges ? randomUUID() : null;

  const batchResult: BatchResult = {
    mode: options.applyChanges ? "apply" : "dry-run",
    productChainId,
    filters: {
      email: options.email ?? null,
      limit: options.limit ?? null
    },
    steps: {},
    delta: {
      byMetric: {},
      highlights: {
        walletProjected: null,
        autoRepairableProfiles: null,
        manualReviewProfiles: null,
        legacySourceProfiles: null
      }
    },
    repairEventAudit: {
      enabled: options.includeRepairEventSummary,
      batchRunId,
      limit: options.includeRepairEventSummary ? options.repairEventLimit : null,
      command: null,
      summary: null,
      recentEvents: []
    },
    manualReviewExport: {
      enabled: options.exportManualReview,
      outputPath: options.exportManualReview
        ? options.manualReviewOutputPath ?? DEFAULT_MANUAL_REVIEW_OUTPUT_PATH
        : null
    },
    reportOutputPath: options.reportOutputPath ?? null
  };

  const preRepairAudit = runAuditSummaryStep(options);
  batchResult.steps.preRepairAudit = preRepairAudit;

  const repairMissingCustomerProjection = runRepairStep(
    "repair-missing-customer-projections.ts",
    options,
    batchRunId
  );
  batchResult.steps.repairMissingCustomerProjection =
    repairMissingCustomerProjection;

  const repairMissingCustomerAccount = runRepairStep(
    "repair-customer-account-wallet-projections.ts",
    options,
    batchRunId
  );
  batchResult.steps.repairMissingCustomerAccount =
    repairMissingCustomerAccount;

  const repairWalletOnly = runRepairStep(
    "repair-customer-wallet-projections.ts",
    options,
    batchRunId
  );
  batchResult.steps.repairWalletOnly = repairWalletOnly;

  const postRepairAudit = runAuditSummaryStep(options);
  batchResult.steps.postRepairAudit = postRepairAudit;

  batchResult.delta = buildDeltaReport(
    preRepairAudit.summary,
    postRepairAudit.summary
  );

  if (options.includeRepairEventSummary && batchRunId) {
    const repairEventAudit = runRepairEventAudit(
      batchRunId,
      options.repairEventLimit
    );

    batchResult.repairEventAudit.command = repairEventAudit.command;
    batchResult.repairEventAudit.summary = repairEventAudit.summary;
    batchResult.repairEventAudit.recentEvents = repairEventAudit.recentEvents;
  }

  if (options.exportManualReview) {
    const manualReviewExport = runManualReviewExportStep(options);
    batchResult.steps.manualReviewExport = manualReviewExport;
  }

  if (options.reportOutputPath) {
    await writeOutputFile(apiRootDir, options.reportOutputPath, batchResult);
  }

  console.log(JSON.stringify(batchResult, null, 2));
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
    process.exit(1);
  }

  console.error("Wallet projection safe batch repair failed.");
  process.exit(1);
});
