import { spawnSync } from "node:child_process";
import path from "node:path";
import type {
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceStatus,
  ReleaseReadinessEvidenceType
} from "@prisma/client";

type CommandExecutionResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

type AutomatedProofCommandDefinition = {
  label: string;
  command: string;
  args: string[];
  coverage: string[];
};

type CommandExecutor = (
  command: string,
  args: string[],
  cwd: string
) => CommandExecutionResult | Promise<CommandExecutionResult>;

type AutomatedReleaseReadinessProofType =
  | "contract_invariant_suite"
  | "backend_integration_suite"
  | "end_to_end_finance_flows";

type ManualReleaseReadinessProofType =
  | "secret_handling_review"
  | "role_review";

type ReleaseReadinessProofType =
  | AutomatedReleaseReadinessProofType
  | ManualReleaseReadinessProofType;

type ReleaseReadinessProofResult = {
  evidenceType: ReleaseReadinessEvidenceType;
  status: "passed" | "failed";
  summary: string;
  observedAt: string;
  note?: string;
  runbookPath: string;
  evidenceLinks: string[];
  evidencePayload: Record<string, unknown>;
};

type AutomatedReleaseReadinessProofInput = {
  evidenceType: AutomatedReleaseReadinessProofType;
  workspaceRoot?: string;
  commandExecutor?: CommandExecutor;
};

type ManualReleaseReadinessProofInput = {
  evidenceType: ManualReleaseReadinessProofType;
  status?: ReleaseReadinessEvidenceStatus;
  summary: string;
  note?: string;
  evidenceLinks?: string[];
  evidencePayload?: Record<string, unknown>;
};

type ReleaseReadinessProofInput =
  | AutomatedReleaseReadinessProofInput
  | ManualReleaseReadinessProofInput;

const automatedProofDefinitions: Record<
  AutomatedReleaseReadinessProofType,
  {
    runbookPath: string;
    successSummary: string;
    failureSummary: string;
    commands: AutomatedProofCommandDefinition[];
  }
> = {
  contract_invariant_suite: {
    runbookPath: "docs/runbooks/release-candidate-verification.md",
    successSummary:
      "Contract invariant suite passed for the release artifact.",
    failureSummary: "Contract invariant suite failed for the release artifact.",
    commands: [
      {
        label: "staking_pool_invariants",
        command: "pnpm",
        args: [
          "--filter",
          "@stealth-trails-bank/contracts",
          "test",
          "--",
          "--grep",
          "invariant"
        ],
        coverage: [
          "contract accounting invariants",
          "reward reserve conservation",
          "emergency control safety"
        ]
      }
    ]
  },
  backend_integration_suite: {
    runbookPath: "docs/runbooks/release-candidate-verification.md",
    successSummary:
      "Backend integration suite passed across guarded operator, worker, reconciliation, and launch-governance boundaries.",
    failureSummary:
      "Backend integration suite failed across guarded operator, worker, reconciliation, or launch-governance boundaries.",
    commands: [
      {
        label: "guarded_transaction_intent_boundaries",
        command: "pnpm",
        args: [
          "--filter",
          "@stealth-trails-bank/api",
          "test",
          "--",
          "--runTestsByPath",
          "src/transaction-intents/transaction-intents.integration.spec.ts",
          "src/transaction-intents/transaction-intents-operator.integration.spec.ts"
        ],
        coverage: [
          "customer deposit and withdrawal intent APIs",
          "internal operator control-plane routes",
          "guarded worker-facing transaction intent boundaries"
        ]
      },
      {
        label: "reconciliation_and_release_readiness_services",
        command: "pnpm",
        args: [
          "--filter",
          "@stealth-trails-bank/api",
          "test",
          "--",
          "--runTestsByPath",
          "src/ledger-reconciliation/ledger-reconciliation.service.spec.ts",
          "src/release-readiness/release-readiness.service.spec.ts"
        ],
        coverage: [
          "reconciliation mismatch lifecycle",
          "linked review-case resolution",
          "release-readiness evidence and approval gates"
        ]
      }
    ]
  },
  end_to_end_finance_flows: {
    runbookPath: "docs/runbooks/release-candidate-verification.md",
    successSummary:
      "End-to-end finance flow suite passed for deposit and withdrawal lifecycles, including replay and worker recovery paths.",
    failureSummary:
      "End-to-end finance flow suite failed for deposit, withdrawal, replay, or worker recovery paths.",
    commands: [
      {
        label: "finance_flow_integration",
        command: "pnpm",
        args: [
          "--filter",
          "@stealth-trails-bank/api",
          "test",
          "--",
          "--runTestsByPath",
          "src/transaction-intents/finance-flows.integration.spec.ts"
        ],
        coverage: [
          "deposit lifecycle",
          "withdrawal lifecycle",
          "ledger-backed settlement"
        ]
      },
      {
        label: "replay_and_recovery_specs",
        command: "pnpm",
        args: [
          "--filter",
          "@stealth-trails-bank/api",
          "test",
          "--",
          "--runTestsByPath",
          "src/transaction-intents/transaction-intents.replay.spec.ts",
          "src/transaction-intents/withdrawal-intents.replay.spec.ts",
          "src/transaction-intents/deposit-settlement-reconciliation.review-cases.spec.ts",
          "src/transaction-intents/withdrawal-settlement-reconciliation.review-cases.spec.ts"
        ],
        coverage: [
          "deposit replay safety",
          "withdrawal replay safety",
          "reconciliation-triggered repair and review routing"
        ]
      },
      {
        label: "worker_runtime_recovery",
        command: "pnpm",
        args: [
          "--filter",
          "@stealth-trails-bank/worker",
          "test"
        ],
        coverage: [
          "worker orchestration",
          "confirmed-backlog settlement recovery",
          "runtime mode safety"
        ]
      }
    ]
  }
};

const manualProofDefinitions: Record<
  ManualReleaseReadinessProofType,
  {
    runbookPath: string;
    defaultSummary: string;
  }
> = {
  secret_handling_review: {
    runbookPath: "docs/security/secret-handling-review.md",
    defaultSummary:
      "Secret handling review completed and launch secret posture attested."
  },
  role_review: {
    runbookPath: "docs/security/role-review.md",
    defaultSummary:
      "Role review completed and launch operator role mappings attested."
  }
};

const outputTailLineLimit = 40;
const outputTailCharacterLimit = 6000;

export const automatedReleaseReadinessProofTypes = Object.freeze(
  Object.keys(automatedProofDefinitions) as AutomatedReleaseReadinessProofType[]
);

export const manualReleaseReadinessProofTypes = Object.freeze(
  Object.keys(manualProofDefinitions) as ManualReleaseReadinessProofType[]
);

export const releaseReadinessProofTypes = Object.freeze([
  ...automatedReleaseReadinessProofTypes,
  ...manualReleaseReadinessProofTypes
]) as readonly ReleaseReadinessProofType[];

function defaultWorkspaceRoot(): string {
  return path.resolve(__dirname, "../../../../");
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function normalizeStringArray(values?: string[]): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildOutputTail(output: string): string {
  const normalizedOutput = output.trim();

  if (normalizedOutput.length === 0) {
    return "";
  }

  const lineTail = normalizedOutput
    .split(/\r?\n/)
    .slice(-outputTailLineLimit)
    .join("\n");

  return lineTail.length > outputTailCharacterLimit
    ? lineTail.slice(-outputTailCharacterLimit)
    : lineTail;
}

function executeCommand(
  command: string,
  args: string[],
  cwd: string
): CommandExecutionResult {
  const startedAt = Date.now();
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }

  return {
    exitCode: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    durationMs: Date.now() - startedAt
  };
}

async function executeAutomatedProofCommands(
  commands: AutomatedProofCommandDefinition[],
  workspaceRoot: string,
  commandExecutor: CommandExecutor
): Promise<{
  status: "passed" | "failed";
  totalDurationMs: number;
  commandResults: Array<{
    label: string;
    command: string;
    coverage: string[];
    exitCode: number;
    durationMs: number;
    stdoutTail: string;
    stderrTail: string;
    status: "passed" | "failed";
  }>;
}> {
  const commandResults: Array<{
    label: string;
    command: string;
    coverage: string[];
    exitCode: number;
    durationMs: number;
    stdoutTail: string;
    stderrTail: string;
    status: "passed" | "failed";
  }> = [];

  for (const commandDefinition of commands) {
    const executionResult = await commandExecutor(
      commandDefinition.command,
      commandDefinition.args,
      workspaceRoot
    );
    const status = executionResult.exitCode === 0 ? "passed" : "failed";

    commandResults.push({
      label: commandDefinition.label,
      command: [commandDefinition.command, ...commandDefinition.args].join(" "),
      coverage: commandDefinition.coverage,
      exitCode: executionResult.exitCode,
      durationMs: executionResult.durationMs,
      stdoutTail: buildOutputTail(executionResult.stdout),
      stderrTail: buildOutputTail(executionResult.stderr),
      status
    });

    if (status === "failed") {
      return {
        status,
        totalDurationMs: commandResults.reduce(
          (total, result) => total + result.durationMs,
          0
        ),
        commandResults
      };
    }
  }

  return {
    status: "passed",
    totalDurationMs: commandResults.reduce(
      (total, result) => total + result.durationMs,
      0
    ),
    commandResults
  };
}

function isAutomatedProofType(
  evidenceType: ReleaseReadinessEvidenceType
): evidenceType is AutomatedReleaseReadinessProofType {
  return automatedReleaseReadinessProofTypes.includes(
    evidenceType as AutomatedReleaseReadinessProofType
  );
}

function isManualProofType(
  evidenceType: ReleaseReadinessEvidenceType
): evidenceType is ManualReleaseReadinessProofType {
  return manualReleaseReadinessProofTypes.includes(
    evidenceType as ManualReleaseReadinessProofType
  );
}

export function isReleaseReadinessProofType(
  value: string
): value is ReleaseReadinessProofType {
  return releaseReadinessProofTypes.includes(value as ReleaseReadinessProofType);
}

export function acceptsDevelopmentEvidence(
  evidenceType: ReleaseReadinessEvidenceType
): boolean {
  return isAutomatedProofType(evidenceType);
}

export function defaultReleaseReadinessEnvironmentForProof(
  evidenceType: ReleaseReadinessEvidenceType
): ReleaseReadinessEnvironment {
  return acceptsDevelopmentEvidence(evidenceType)
    ? "development"
    : "production_like";
}

export async function runReleaseReadinessProof(
  input: ReleaseReadinessProofInput
): Promise<ReleaseReadinessProofResult> {
  if (isAutomatedProofType(input.evidenceType)) {
    const automatedInput = input as AutomatedReleaseReadinessProofInput;
    const definition = automatedProofDefinitions[input.evidenceType];
    const workspaceRoot =
      automatedInput.workspaceRoot ?? defaultWorkspaceRoot();
    const commandExecutor =
      automatedInput.commandExecutor ?? executeCommand;
    const execution = await executeAutomatedProofCommands(
      definition.commands,
      workspaceRoot,
      commandExecutor
    );
    const status = execution.status;

    return {
      evidenceType: input.evidenceType,
      status,
      summary:
        status === "passed"
          ? definition.successSummary
          : definition.failureSummary,
      observedAt: new Date().toISOString(),
      runbookPath: definition.runbookPath,
      evidenceLinks: [],
      evidencePayload: {
        proofKind: "automated_command_bundle",
        commandCount: definition.commands.length,
        durationMs: execution.totalDurationMs,
        commands: execution.commandResults,
        workspaceRoot
      }
    };
  }

  if (isManualProofType(input.evidenceType)) {
    const manualInput = input as ManualReleaseReadinessProofInput;
    const definition = manualProofDefinitions[input.evidenceType];
    const summary =
      normalizeOptionalString(manualInput.summary) ?? definition.defaultSummary;

    return {
      evidenceType: input.evidenceType,
      status: manualInput.status === "failed" ? "failed" : "passed",
      summary,
      observedAt: new Date().toISOString(),
      note: normalizeOptionalString(manualInput.note),
      runbookPath: definition.runbookPath,
      evidenceLinks: normalizeStringArray(manualInput.evidenceLinks),
      evidencePayload: {
        proofKind: "manual_attestation",
        runbookPath: definition.runbookPath,
        ...(manualInput.evidencePayload ?? {})
      }
    };
  }

  throw new Error(`Unsupported release readiness proof type: ${input.evidenceType}`);
}

export type {
  AutomatedReleaseReadinessProofInput,
  AutomatedReleaseReadinessProofType,
  CommandExecutionResult,
  CommandExecutor,
  ManualReleaseReadinessProofInput,
  ManualReleaseReadinessProofType,
  ReleaseReadinessProofInput,
  ReleaseReadinessProofResult,
  ReleaseReadinessProofType
};
