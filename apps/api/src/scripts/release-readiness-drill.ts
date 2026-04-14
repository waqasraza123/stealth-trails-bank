import { ReleaseReadinessEvidenceType } from "@prisma/client";
import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  recordReleaseReadinessEvidence,
  runReleaseReadinessDrill,
  type ReleaseReadinessDrillOptions,
  type ReleaseReadinessDrillSession
} from "../release-readiness/release-readiness-drill-runner";
import {
  describeReleaseReadinessEvidenceMetadataRequirements,
  validateReleaseReadinessEvidenceMetadata
} from "../release-readiness/release-readiness-evidence-requirements";

type ParsedArgs = {
  [key: string]: string | boolean | undefined;
};

const supportedEvidenceTypes = new Set<ReleaseReadinessEvidenceType>([
  ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
  ReleaseReadinessEvidenceType.critical_alert_reescalation,
  ReleaseReadinessEvidenceType.database_restore_drill,
  ReleaseReadinessEvidenceType.api_rollback_drill,
  ReleaseReadinessEvidenceType.worker_rollback_drill
]);

function printUsage(): void {
  console.log(`Usage:
  pnpm --filter @stealth-trails-bank/api release-readiness:probe -- --probe <evidenceType> --base-url <url> --operator-id <id> --api-key <key> [options]

Required:
  --probe                         One of: ${[...supportedEvidenceTypes].join(", ")}
  --base-url                      Operator API base URL for the target environment
  --operator-id                   Operator identifier used for authenticated internal calls
  --api-key                       Internal operator API key

Optional:
  --operator-role                 Operator role header
  --environment                   staging | production_like | production
  --release-id                    Release identifier recorded with evidence
  --rollback-release-id           Rollback release identifier recorded with evidence
  --backup-ref                    Backup or snapshot reference recorded with evidence
  --note                          Operator note stored with evidence
  --summary                       Override the generated evidence summary
  --record-evidence               Persist the probe result to release-readiness evidence
  --output                        Write the probe result JSON to a file
  --stale-after-seconds           Override stale worker threshold
  --recent-alert-limit            Override recent alert sample size
  --lookback-hours                Override delivery-target health lookback
  --expected-target-name          Expected delivery target name for SLO probe
  --expected-target-health-status warning | critical
  --expected-alert-id             Expected alert id for re-escalation proof
  --expected-dedupe-key           Expected alert dedupe key for re-escalation proof
  --expected-min-re-escalations   Minimum re-escalation count, default 1
  --expected-worker-id            Expected worker id for rollback validation
  --expected-min-healthy-workers  Minimum healthy workers after rollback, default 1
  --help                          Print this message
`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextToken = argv[index + 1];

    if (!nextToken || nextToken.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = nextToken;
    index += 1;
  }

  return parsed;
}

function readRequiredStringArg(parsedArgs: ParsedArgs, key: string): string {
  const value = parsedArgs[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`Missing required argument --${key}.`);
  }

  return value.trim();
}

function readOptionalStringArg(
  parsedArgs: ParsedArgs,
  key: string
): string | undefined {
  const value = parsedArgs[key];

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalIntegerArg(
  parsedArgs: ParsedArgs,
  key: string
): number | undefined {
  const value = readOptionalStringArg(parsedArgs, key);

  if (!value) {
    return undefined;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    fail(`Argument --${key} must be a positive integer.`);
  }

  return parsedValue;
}

function readOptionalBooleanFlag(parsedArgs: ParsedArgs, key: string): boolean {
  return parsedArgs[key] === true;
}

function buildSession(parsedArgs: ParsedArgs): ReleaseReadinessDrillSession {
  return {
    baseUrl: readRequiredStringArg(parsedArgs, "base-url"),
    operatorId: readRequiredStringArg(parsedArgs, "operator-id"),
    apiKey: readRequiredStringArg(parsedArgs, "api-key"),
    operatorRole: readOptionalStringArg(parsedArgs, "operator-role")
  };
}

function buildOptions(parsedArgs: ParsedArgs): ReleaseReadinessDrillOptions {
  const probe = readRequiredStringArg(parsedArgs, "probe");

  if (!supportedEvidenceTypes.has(probe as ReleaseReadinessEvidenceType)) {
    fail(`Unsupported --probe value: ${probe}.`);
  }

  const expectedTargetHealthStatus = readOptionalStringArg(
    parsedArgs,
    "expected-target-health-status"
  );

  if (
    expectedTargetHealthStatus &&
    expectedTargetHealthStatus !== "warning" &&
    expectedTargetHealthStatus !== "critical"
  ) {
    fail(
      "Argument --expected-target-health-status must be either warning or critical."
    );
  }

  return {
    evidenceType: probe as ReleaseReadinessEvidenceType,
    staleAfterSeconds: readOptionalIntegerArg(parsedArgs, "stale-after-seconds"),
    recentAlertLimit: readOptionalIntegerArg(parsedArgs, "recent-alert-limit"),
    lookbackHours: readOptionalIntegerArg(parsedArgs, "lookback-hours"),
    expectedTargetName: readOptionalStringArg(parsedArgs, "expected-target-name"),
    expectedTargetHealthStatus:
      expectedTargetHealthStatus as "warning" | "critical" | undefined,
    expectedAlertId: readOptionalStringArg(parsedArgs, "expected-alert-id"),
    expectedDedupeKey: readOptionalStringArg(parsedArgs, "expected-dedupe-key"),
    expectedMinReEscalations: readOptionalIntegerArg(
      parsedArgs,
      "expected-min-re-escalations"
    ),
    expectedWorkerId: readOptionalStringArg(parsedArgs, "expected-worker-id"),
    expectedMinHealthyWorkers: readOptionalIntegerArg(
      parsedArgs,
      "expected-min-healthy-workers"
    )
  };
}

async function main(): Promise<void> {
  const parsedArgs = parseArgs(process.argv.slice(2));

  if (parsedArgs["help"] === true) {
    printUsage();
    return;
  }

  const session = buildSession(parsedArgs);
  const options = buildOptions(parsedArgs);
  const result = await runReleaseReadinessDrill(session, options);
  const summaryOverride = readOptionalStringArg(parsedArgs, "summary");
  const outputPath = readOptionalStringArg(parsedArgs, "output");
  const recordEvidence = readOptionalBooleanFlag(parsedArgs, "record-evidence");

  const printableResult = {
    ...result,
    summary: summaryOverride ?? result.summary
  };

  if (outputPath) {
    const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
    writeFileSync(
      resolvedOutputPath,
      JSON.stringify(printableResult, null, 2) + "\n",
      "utf8"
    );
  }

  console.log(JSON.stringify(printableResult, null, 2));

  if (recordEvidence) {
    const environment = readRequiredStringArg(parsedArgs, "environment");
    const releaseIdentifier = readOptionalStringArg(parsedArgs, "release-id");
    const rollbackReleaseIdentifier = readOptionalStringArg(
      parsedArgs,
      "rollback-release-id"
    );
    const backupReference = readOptionalStringArg(parsedArgs, "backup-ref");

    if (
      environment !== "staging" &&
      environment !== "production_like" &&
      environment !== "production"
    ) {
      fail(
        "Argument --environment must be one of staging, production_like, or production when --record-evidence is used."
      );
    }

    const missingMetadata = validateReleaseReadinessEvidenceMetadata({
      evidenceType: result.evidenceType,
      releaseIdentifier,
      rollbackReleaseIdentifier,
      backupReference
    });

    if (missingMetadata.length > 0) {
      fail(
        `Recording ${result.evidenceType} requires ${describeReleaseReadinessEvidenceMetadataRequirements(
          result.evidenceType
        ).join(", ")}.`
      );
    }

    const evidenceResult = await recordReleaseReadinessEvidence(session, {
      evidenceType: result.evidenceType,
      environment,
      status: result.status,
      summary: summaryOverride ?? result.summary,
      note: readOptionalStringArg(parsedArgs, "note"),
      releaseIdentifier,
      rollbackReleaseIdentifier,
      backupReference,
      observedAt: result.observedAt,
      evidencePayload: result.evidencePayload
    });

    console.error(
      `Recorded release-readiness evidence ${evidenceResult.evidence.id} with status ${evidenceResult.evidence.status}.`
    );
  }

  if (result.status === "failed") {
    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(`Release readiness drill failed: ${message}`);
});
