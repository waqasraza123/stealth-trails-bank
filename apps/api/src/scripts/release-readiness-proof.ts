import {
  ReleaseReadinessEvidenceStatus
} from "@prisma/client";
import type {
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import { writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  recordReleaseReadinessEvidence,
  type ReleaseReadinessDrillSession
} from "../release-readiness/release-readiness-drill-runner";
import {
  automatedReleaseReadinessProofTypes,
  defaultReleaseReadinessEnvironmentForProof,
  isReleaseReadinessProofType,
  runReleaseReadinessProof,
  type ReleaseReadinessProofResult,
  type ReleaseReadinessProofType
} from "../release-readiness/release-readiness-proof-runner";
import {
  describeReleaseReadinessEvidenceMetadataRequirements,
  validateReleaseReadinessEvidenceMetadata
} from "../release-readiness/release-readiness-evidence-requirements";

type ParsedArgs = {
  [key: string]: string | boolean | undefined;
};

const supportedEnvironments = new Set<ReleaseReadinessEnvironment>([
  "development",
  "ci",
  "staging",
  "production_like",
  "production"
]);

const supportedStatuses = new Set<ReleaseReadinessEvidenceStatus>([
  ReleaseReadinessEvidenceStatus.passed,
  ReleaseReadinessEvidenceStatus.failed
]);

function printUsage(): void {
  console.log(`Usage:
  pnpm --filter @stealth-trails-bank/api release-readiness:verify -- --proof <proofType|all-auto> [options]

Proof types:
  ${[
    ...automatedReleaseReadinessProofTypes,
    "secret_handling_review",
    "role_review"
  ].join(", ")}

Required:
  --proof                         One proof type or all-auto

Optional:
  --environment                   development | ci | staging | production_like | production
  --status                        passed | failed (manual attestation only)
  --summary                       Override or supply the summary
  --note                          Operator note stored with evidence
  --evidence-links                Comma-separated evidence links
  --evidence-payload-json         JSON payload merged into evidencePayload
  --release-id                    Release identifier recorded with evidence
  --rollback-release-id           Rollback release identifier recorded with evidence
  --backup-ref                    Backup or snapshot reference recorded with evidence
  --record-evidence               Persist the result through the release-readiness API
  --base-url                      Operator API base URL when recording evidence
  --access-token                  Operator bearer token when recording evidence
  --output                        Write the verifier JSON to a file
  --help                          Print this message

Environment variables for staging-like end-to-end proof:
  PLAYWRIGHT_LIVE_WEB_URL
  PLAYWRIGHT_LIVE_WEB_EMAIL
  PLAYWRIGHT_LIVE_WEB_PASSWORD
  PLAYWRIGHT_LIVE_ADMIN_URL
  PLAYWRIGHT_LIVE_ADMIN_API_BASE_URL
  PLAYWRIGHT_LIVE_ADMIN_OPERATOR_ID
  PLAYWRIGHT_LIVE_ADMIN_API_KEY
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

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function readOptionalBooleanFlag(parsedArgs: ParsedArgs, key: string): boolean {
  return parsedArgs[key] === true;
}

function parseEnvironment(
  parsedArgs: ParsedArgs,
  proofType: ReleaseReadinessEvidenceType
): ReleaseReadinessEnvironment {
  const environmentValue =
    readOptionalStringArg(parsedArgs, "environment") ??
    defaultReleaseReadinessEnvironmentForProof(proofType);

  if (!supportedEnvironments.has(environmentValue as ReleaseReadinessEnvironment)) {
    fail(`Unsupported --environment value: ${environmentValue}.`);
  }

  return environmentValue as ReleaseReadinessEnvironment;
}

function parseStatus(parsedArgs: ParsedArgs): ReleaseReadinessEvidenceStatus {
  const statusValue =
    readOptionalStringArg(parsedArgs, "status") ?? ReleaseReadinessEvidenceStatus.passed;

  if (!supportedStatuses.has(statusValue as ReleaseReadinessEvidenceStatus)) {
    fail(`Unsupported --status value: ${statusValue}.`);
  }

  return statusValue as ReleaseReadinessEvidenceStatus;
}

function parseEvidenceLinks(parsedArgs: ParsedArgs): string[] {
  const rawValue = readOptionalStringArg(parsedArgs, "evidence-links");

  if (!rawValue) {
    return [];
  }

  return [...new Set(rawValue.split(",").map((value) => value.trim()).filter(Boolean))];
}

function parseEvidencePayload(
  parsedArgs: ParsedArgs
): Record<string, unknown> | undefined {
  const rawValue = readOptionalStringArg(parsedArgs, "evidence-payload-json");

  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      fail("Argument --evidence-payload-json must be a JSON object.");
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    fail(
      `Argument --evidence-payload-json must be valid JSON: ${(error as Error).message}`
    );
  }
}

function buildSession(parsedArgs: ParsedArgs): ReleaseReadinessDrillSession {
  return {
    baseUrl: readRequiredStringArg(parsedArgs, "base-url"),
    accessToken: readRequiredStringArg(parsedArgs, "access-token")
  };
}

async function runSingleProof(
  proofType: ReleaseReadinessProofType,
  parsedArgs: ParsedArgs
): Promise<ReleaseReadinessProofResult> {
  if (
    proofType === "secret_handling_review" ||
    proofType === "role_review"
  ) {
    return runReleaseReadinessProof({
      evidenceType: proofType,
      status: parseStatus(parsedArgs),
      summary:
        readOptionalStringArg(parsedArgs, "summary") ??
        (proofType === "secret_handling_review"
          ? "Secret handling review completed and launch secret posture attested."
          : "Role review completed and launch operator role mappings attested."),
      note: readOptionalStringArg(parsedArgs, "note"),
      evidenceLinks: parseEvidenceLinks(parsedArgs),
      evidencePayload: parseEvidencePayload(parsedArgs)
    });
  }

  return runReleaseReadinessProof({
    evidenceType: proofType,
    environment: parseEnvironment(parsedArgs, proofType)
  });
}

async function recordEvidence(
  parsedArgs: ParsedArgs,
  proof: ReleaseReadinessProofResult
): Promise<{ evidence: { id: string; status: "passed" | "failed" } }> {
  const session = buildSession(parsedArgs);
  const releaseIdentifier = readOptionalStringArg(parsedArgs, "release-id");
  const rollbackReleaseIdentifier = readOptionalStringArg(
    parsedArgs,
    "rollback-release-id"
  );
  const backupReference = readOptionalStringArg(parsedArgs, "backup-ref");
  const missingMetadata = validateReleaseReadinessEvidenceMetadata({
    evidenceType: proof.evidenceType,
    releaseIdentifier,
    rollbackReleaseIdentifier,
    backupReference
  });

  if (missingMetadata.length > 0) {
    fail(
      `Recording ${proof.evidenceType} requires ${describeReleaseReadinessEvidenceMetadataRequirements(
        proof.evidenceType
      ).join(", ")}.`
    );
  }

  return recordReleaseReadinessEvidence(session, {
    evidenceType: proof.evidenceType,
    environment: parseEnvironment(parsedArgs, proof.evidenceType),
    status: proof.status,
    summary: readOptionalStringArg(parsedArgs, "summary") ?? proof.summary,
    note: readOptionalStringArg(parsedArgs, "note") ?? proof.note,
    releaseIdentifier,
    rollbackReleaseIdentifier,
    backupReference,
    observedAt: proof.observedAt,
    evidencePayload: proof.evidencePayload
  });
}

async function main(): Promise<void> {
  const parsedArgs = parseArgs(process.argv.slice(2));

  if (parsedArgs["help"] === true) {
    printUsage();
    return;
  }

  const proofArg = readRequiredStringArg(parsedArgs, "proof");
  const outputPath = readOptionalStringArg(parsedArgs, "output");
  const shouldRecordEvidence = readOptionalBooleanFlag(parsedArgs, "record-evidence");
  const summaryOverride = readOptionalStringArg(parsedArgs, "summary");

  if (proofArg === "all-auto" && summaryOverride) {
    fail("Argument --summary can only be used with a single proof type.");
  }

  const proofTypes: ReleaseReadinessProofType[] =
    proofArg === "all-auto"
      ? [...automatedReleaseReadinessProofTypes]
      : isReleaseReadinessProofType(proofArg)
        ? [proofArg]
        : fail(`Unsupported --proof value: ${proofArg}.`);

  const results = await Promise.all(
    proofTypes.map((proofType) => runSingleProof(proofType, parsedArgs))
  );
  const printableOutput =
    results.length === 1
      ? {
          ...results[0],
          summary: summaryOverride ?? results[0].summary
        }
      : {
          generatedAt: new Date().toISOString(),
          proofs: results
        };

  if (outputPath) {
    const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
    writeFileSync(
      resolvedOutputPath,
      JSON.stringify(printableOutput, null, 2) + "\n",
      "utf8"
    );
  }

  console.log(JSON.stringify(printableOutput, null, 2));

  if (shouldRecordEvidence) {
    const recordedEvidence = [];

    for (const result of results) {
      const response = await recordEvidence(parsedArgs, {
        ...result,
        summary: summaryOverride ?? result.summary
      });

      recordedEvidence.push({
        evidenceType: result.evidenceType,
        evidenceId: response.evidence.id,
        status: response.evidence.status
      });
    }

    console.error(JSON.stringify({ recordedEvidence }, null, 2));
  }

  if (results.some((result) => result.status === "failed")) {
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error((error as Error).message);
  process.exit(1);
});
