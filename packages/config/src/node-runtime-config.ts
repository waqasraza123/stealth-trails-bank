import dotenv from "dotenv";
import {
  readOptionalRuntimeEnv,
  readRequiredRuntimeEnv,
  type RuntimeEnvShape
} from "./runtime-env";

const DEFAULT_PRODUCT_CHAIN_ID = 8453;
const DEFAULT_API_PORT = 9001;
const DEFAULT_LOCAL_CORS_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173"
] as const;
const DEFAULT_MANUAL_RESOLUTION_ALLOWED_OPERATOR_ROLES = [
  "operations_admin",
  "risk_manager",
  "senior_operator"
] as const;
const DEFAULT_ACCOUNT_HOLD_APPLY_ALLOWED_OPERATOR_ROLES = [
  "operations_admin",
  "risk_manager"
] as const;
const DEFAULT_ACCOUNT_HOLD_RELEASE_ALLOWED_OPERATOR_ROLES = [
  "operations_admin",
  "risk_manager",
  "compliance_lead"
] as const;
const DEFAULT_INCIDENT_PACKAGE_EXPORT_MAX_RECENT_LIMIT = 100;
const DEFAULT_INCIDENT_PACKAGE_EXPORT_MAX_TIMELINE_LIMIT = 500;
const DEFAULT_INCIDENT_PACKAGE_EXPORT_MAX_SINCE_DAYS = 90;
const DEFAULT_INCIDENT_PACKAGE_RELEASE_APPROVER_ALLOWED_OPERATOR_ROLES = [
  "compliance_lead",
  "risk_manager"
] as const;
const DEFAULT_INCIDENT_PACKAGE_RELEASE_APPROVAL_EXPIRY_HOURS = 72;
const DEFAULT_RELEASE_READINESS_APPROVAL_REQUEST_ALLOWED_OPERATOR_ROLES = [
  "operations_admin",
  "compliance_lead",
  "risk_manager"
] as const;
const DEFAULT_RELEASE_READINESS_APPROVER_ALLOWED_OPERATOR_ROLES = [
  "compliance_lead",
  "risk_manager"
] as const;
const DEFAULT_RELEASE_READINESS_MAX_EVIDENCE_AGE_HOURS = 72;
const DEFAULT_TRANSACTION_INTENT_DECISION_ALLOWED_OPERATOR_ROLES = [
  "operations_admin",
  "risk_manager"
] as const;
const DEFAULT_CUSTODY_OPERATION_ALLOWED_OPERATOR_ROLES = [
  "operations_admin",
  "senior_operator",
  "treasury"
] as const;
const DEFAULT_STAKING_GOVERNANCE_ALLOWED_OPERATOR_ROLES = [
  "treasury",
  "risk_manager",
  "compliance_lead"
] as const;
const DEFAULT_STAKING_POOL_GOVERNANCE_REQUEST_ALLOWED_OPERATOR_ROLES = [
  ...DEFAULT_STAKING_GOVERNANCE_ALLOWED_OPERATOR_ROLES
] as const;
const DEFAULT_STAKING_POOL_GOVERNANCE_APPROVER_ALLOWED_OPERATOR_ROLES = [
  "risk_manager",
  "compliance_lead"
] as const;
const DEFAULT_STAKING_POOL_GOVERNANCE_EXECUTOR_ALLOWED_OPERATOR_ROLES = [
  "treasury"
] as const;
const DEFAULT_PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_LOOKBACK_HOURS = 24;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_MINIMUM_RECENT_DELIVERIES = 3;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_FAILURE_RATE_PERCENT = 25;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_FAILURE_RATE_PERCENT = 50;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_PENDING_COUNT = 2;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_PENDING_COUNT = 5;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_AVERAGE_LATENCY_MS = 15_000;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_AVERAGE_LATENCY_MS = 60_000;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_CONSECUTIVE_FAILURES = 2;
const DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_CONSECUTIVE_FAILURES = 3;
const DEFAULT_PLATFORM_ALERT_REESCALATION_UNACKNOWLEDGED_SECONDS = 900;
const DEFAULT_PLATFORM_ALERT_REESCALATION_UNOWNED_SECONDS = 600;
const DEFAULT_PLATFORM_ALERT_REESCALATION_REPEAT_SECONDS = 1800;
const DEFAULT_WORKER_POLL_INTERVAL_MS = 10_000;
const DEFAULT_WORKER_BATCH_LIMIT = 20;
const DEFAULT_WORKER_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_WORKER_CONFIRMATION_BLOCKS = 1;
const DEFAULT_WORKER_PLATFORM_ALERT_REESCALATION_INTERVAL_MS = 300_000;
const DEFAULT_WORKER_SOLVENCY_SNAPSHOT_INTERVAL_MS = 300_000;
const DEFAULT_WORKER_GOVERNED_EXECUTION_DISPATCH_INTERVAL_MS = 60_000;
const DEFAULT_WORKER_INTERNAL_API_STARTUP_GRACE_PERIOD_MS = 45_000;
const DEFAULT_WORKER_MANAGED_WITHDRAWAL_CLAIM_TIMEOUT_MS = 60_000;
const DEFAULT_WORKER_POLICY_CONTROLLED_WITHDRAWAL_AUTHORIZATION_TTL_SECONDS = 300;
const DEFAULT_SOLVENCY_RESUME_REQUEST_ALLOWED_OPERATOR_ROLES = [
  "operations_admin",
  "risk_manager"
] as const;
const DEFAULT_SOLVENCY_RESUME_APPROVER_ALLOWED_OPERATOR_ROLES = [
  "compliance_lead",
  "risk_manager"
] as const;
const DEFAULT_GOVERNED_EXECUTION_REQUEST_ALLOWED_OPERATOR_ROLES = [
  "operations_admin",
  "risk_manager"
] as const;
const DEFAULT_GOVERNED_EXECUTION_APPROVER_ALLOWED_OPERATOR_ROLES = [
  "compliance_lead",
  "risk_manager"
] as const;
const DEFAULT_GOVERNED_EXECUTION_OVERRIDE_MAX_HOURS = 12;
const DEFAULT_LOCAL_SOLVENCY_REPORT_SIGNER_PRIVATE_KEY =
  "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8";
const DEFAULT_LOCAL_WORKER_ID = "worker-local-1";
const DEFAULT_LOCAL_INTERNAL_API_BASE_URL = "http://localhost:9001";
const DEFAULT_LOCAL_INTERNAL_WORKER_API_KEY = "local-dev-worker-key";
const DEFAULT_LOCAL_INTERNAL_OPERATOR_API_KEY = "local-dev-operator-key";
const DEFAULT_SHARED_LOGIN_ENABLED = true;
const DEFAULT_SHARED_LOGIN_EMAIL = "admin@gmail.com";
const DEFAULT_SHARED_LOGIN_PASSWORD = "P@ssw0rd";
const DEFAULT_SHARED_LOGIN_FIRST_NAME = "Shared";
const DEFAULT_SHARED_LOGIN_LAST_NAME = "Admin";
const DEFAULT_SHARED_LOGIN_SUPABASE_USER_ID = "shared-login-admin";

let nodeRuntimeEnvInitialized = false;

function initializeNodeRuntimeEnv(): void {
  if (nodeRuntimeEnvInitialized) {
    return;
  }

  dotenv.config();
  nodeRuntimeEnvInitialized = true;
}

function getNodeRuntimeEnv(): RuntimeEnvShape {
  initializeNodeRuntimeEnv();
  return process.env as RuntimeEnvShape;
}

function parsePositiveInteger(value: string, name: string): number {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

function parsePositiveIntegerLike(value: unknown, name: string): number {
  if (!Number.isInteger(value) || Number(value) <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return Number(value);
}

function parseIntegerInRange(
  value: unknown,
  name: string,
  minimum: number,
  maximum: number
): number {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`
    );
  }

  return Number(value);
}

function parseGovernedTreasuryExecutionMode(
  value: string | undefined,
  name: string
): GovernedTreasuryExecutionMode {
  if (!value) {
    return "direct_private_key";
  }

  if (value === "direct_private_key" || value === "governed_external") {
    return value;
  }

  throw new Error(
    `${name} must be one of: direct_private_key, governed_external.`
  );
}

function parseApiRuntimeEnvironment(
  value: string | undefined
): "development" | "test" | "production" {
  if (!value) {
    return "development";
  }

  if (value === "development" || value === "test" || value === "production") {
    return value;
  }

  throw new Error(
    "NODE_ENV must be one of: development, test, production."
  );
}

function normalizeCorsAllowedOrigin(value: string, name: string): string {
  if (value === "*") {
    throw new Error(`${name} must list explicit origins. Wildcard '*' is not allowed.`);
  }

  let parsedOrigin: URL;

  try {
    parsedOrigin = new URL(value);
  } catch {
    throw new Error(`${name} contains an invalid URL origin: ${value}`);
  }

  if (parsedOrigin.protocol !== "http:" && parsedOrigin.protocol !== "https:") {
    throw new Error(`${name} only supports http and https origins.`);
  }

  if (
    parsedOrigin.username ||
    parsedOrigin.password ||
    parsedOrigin.search ||
    parsedOrigin.hash ||
    parsedOrigin.pathname !== "/"
  ) {
    throw new Error(
      `${name} entries must be bare origins without credentials, paths, query strings, or fragments.`
    );
  }

  return parsedOrigin.origin;
}

function normalizeBaseUrl(value: string, name: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`${name} only supports http and https URLs.`);
  }

  parsedUrl.hash = "";
  parsedUrl.search = "";

  return parsedUrl.toString().replace(/\/+$/, "");
}

function parseCommaSeparatedValues(value: string, name: string): string[] {
  const values = value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) {
    throw new Error(`${name} must include at least one value.`);
  }

  return Array.from(new Set(values));
}

function parseCorsAllowedOrigins(value: string, name: string): string[] {
  const origins = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => normalizeCorsAllowedOrigin(entry, name));

  if (origins.length === 0) {
    throw new Error(`${name} must include at least one origin.`);
  }

  return Array.from(new Set(origins));
}

function parseWorkerExecutionMode(
  value: string | undefined
): "monitor" | "synthetic" | "managed" {
  if (!value) {
    return "monitor";
  }

  if (
    value === "monitor" ||
    value === "synthetic" ||
    value === "managed"
  ) {
    return value;
  }

  throw new Error(
    "WORKER_EXECUTION_MODE must be one of: monitor, synthetic, managed."
  );
}

function parseBoolean(value: string, name: string): boolean {
  const normalizedValue = value.trim().toLowerCase();

  if (
    normalizedValue === "true" ||
    normalizedValue === "1" ||
    normalizedValue === "yes" ||
    normalizedValue === "on"
  ) {
    return true;
  }

  if (
    normalizedValue === "false" ||
    normalizedValue === "0" ||
    normalizedValue === "no" ||
    normalizedValue === "off"
  ) {
    return false;
  }

  throw new Error(`${name} must be a boolean value.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePlatformAlertDeliverySeverity(
  value: unknown,
  name: string
): PlatformAlertDeliverySeverity {
  if (value === "warning" || value === "critical") {
    return value;
  }

  throw new Error(`${name} must be "warning" or "critical".`);
}

function parsePlatformAlertDeliveryMode(
  value: unknown,
  name: string
): PlatformAlertDeliveryMode {
  if (value === undefined) {
    return "direct";
  }

  if (value === "direct" || value === "failover_only") {
    return value;
  }

  throw new Error(`${name} must be "direct" or "failover_only".`);
}

function parsePlatformAlertDeliveryCategories(
  value: unknown,
  name: string
): PlatformAlertDeliveryCategory[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array.`);
  }

  const categories = value.map((entry) => {
    if (
      entry === "worker" ||
      entry === "reconciliation" ||
      entry === "queue" ||
      entry === "chain" ||
      entry === "treasury" ||
      entry === "operations"
    ) {
      return entry;
    }

    throw new Error(
      `${name} contains an invalid category. Expected worker, reconciliation, queue, chain, treasury, or operations.`
    );
  });

  return Array.from(new Set(categories));
}

function parsePlatformAlertDeliveryEventTypes(
  value: unknown,
  name: string
): PlatformAlertDeliveryEventType[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must be a non-empty array.`);
  }

  const eventTypes = value.map((entry) => {
    if (
      entry === "opened" ||
      entry === "reopened" ||
      entry === "routed_to_review_case" ||
      entry === "owner_assigned" ||
      entry === "acknowledged" ||
      entry === "re_escalated" ||
      entry === "suppressed" ||
      entry === "suppression_cleared"
    ) {
      return entry;
    }

    throw new Error(`${name} contains an invalid event type.`);
  });

  return Array.from(new Set(eventTypes));
}

function parsePlatformAlertDeliveryTargets(
  value: string,
  name: string
): PlatformAlertDeliveryTargetRuntimeConfig[] {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON.`);
  }

  if (!Array.isArray(parsedValue)) {
    throw new Error(`${name} must be a JSON array.`);
  }

  const targets = parsedValue.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`${name}[${index}] must be an object.`);
    }

    if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
      throw new Error(`${name}[${index}].name must be a non-empty string.`);
    }

    if (typeof entry.url !== "string" || entry.url.trim().length === 0) {
      throw new Error(`${name}[${index}].url must be a non-empty string.`);
    }

    return {
      name: entry.name.trim().toLowerCase(),
      url: normalizeBaseUrl(entry.url.trim(), `${name}[${index}].url`),
      bearerToken:
        typeof entry.bearerToken === "string" && entry.bearerToken.trim().length > 0
          ? entry.bearerToken.trim()
          : null,
      deliveryMode: parsePlatformAlertDeliveryMode(
        entry.deliveryMode,
        `${name}[${index}].deliveryMode`
      ),
      categories: parsePlatformAlertDeliveryCategories(
        entry.categories,
        `${name}[${index}].categories`
      ),
      minimumSeverity: parsePlatformAlertDeliverySeverity(
        entry.minimumSeverity,
        `${name}[${index}].minimumSeverity`
      ),
      eventTypes: parsePlatformAlertDeliveryEventTypes(
        entry.eventTypes,
        `${name}[${index}].eventTypes`
      ),
      failoverTargetNames: Array.isArray(entry.failoverTargetNames)
        ? entry.failoverTargetNames.map((targetName, failoverIndex) => {
            if (
              typeof targetName !== "string" ||
              targetName.trim().length === 0
            ) {
              throw new Error(
                `${name}[${index}].failoverTargetNames[${failoverIndex}] must be a non-empty string.`
              );
            }

            return targetName.trim().toLowerCase();
          })
        : []
    };
  });

  const targetsByName = new Map<string, PlatformAlertDeliveryTargetRuntimeConfig>();

  for (const target of targets) {
    if (targetsByName.has(target.name)) {
      throw new Error(`${name} contains duplicate target name "${target.name}".`);
    }

    targetsByName.set(target.name, target);
  }

  for (const target of targets) {
    for (const failoverTargetName of target.failoverTargetNames) {
      if (failoverTargetName === target.name) {
        throw new Error(
          `${name} target "${target.name}" cannot fail over to itself.`
        );
      }

      if (!targetsByName.has(failoverTargetName)) {
        throw new Error(
          `${name} target "${target.name}" references unknown failover target "${failoverTargetName}".`
        );
      }
    }
  }

  const visitedTargetNames = new Set<string>();
  const visitingTargetNames = new Set<string>();

  function validateNoFailoverCycles(
    targetName: string,
    path: string[]
  ): void {
    if (visitingTargetNames.has(targetName)) {
      throw new Error(
        `${name} contains a failover cycle: ${[...path, targetName].join(" -> ")}.`
      );
    }

    if (visitedTargetNames.has(targetName)) {
      return;
    }

    visitingTargetNames.add(targetName);

    for (const failoverTargetName of targetsByName.get(targetName)?.failoverTargetNames ??
      []) {
      validateNoFailoverCycles(failoverTargetName, [...path, targetName]);
    }

    visitingTargetNames.delete(targetName);
    visitedTargetNames.add(targetName);
  }

  for (const target of targets) {
    validateNoFailoverCycles(target.name, []);
  }

  return targets;
}

function parsePlatformAlertAutomationPolicies(
  value: string,
  name: string
): PlatformAlertAutomationPolicyRuntimeConfig[] {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON.`);
  }

  if (!Array.isArray(parsedValue)) {
    throw new Error(`${name} must be a JSON array.`);
  }

  const policies = parsedValue.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`${name}[${index}] must be an object.`);
    }

    if (typeof entry.name !== "string" || entry.name.trim().length === 0) {
      throw new Error(`${name}[${index}].name must be a non-empty string.`);
    }

    if (typeof entry.autoRouteToReviewCase !== "boolean") {
      throw new Error(
        `${name}[${index}].autoRouteToReviewCase must be a boolean.`
      );
    }

    return {
      name: entry.name.trim().toLowerCase(),
      categories: parsePlatformAlertDeliveryCategories(
        entry.categories,
        `${name}[${index}].categories`
      ),
      minimumSeverity: parsePlatformAlertDeliverySeverity(
        entry.minimumSeverity,
        `${name}[${index}].minimumSeverity`
      ),
      autoRouteToReviewCase: entry.autoRouteToReviewCase,
      routeNote:
        typeof entry.routeNote === "string" && entry.routeNote.trim().length > 0
          ? entry.routeNote.trim()
          : null
    };
  });

  const policyNames = new Set<string>();

  for (const policy of policies) {
    if (policyNames.has(policy.name)) {
      throw new Error(`${name} contains duplicate policy name "${policy.name}".`);
    }

    policyNames.add(policy.name);
  }

  return policies;
}

function parseManagedWithdrawalSigners(
  value: string,
  name: string
): ManagedWithdrawalSignerRuntimeConfig[] {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON.`);
  }

  if (!Array.isArray(parsedValue)) {
    throw new Error(`${name} must be a JSON array.`);
  }

  const signers = parsedValue.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`${name}[${index}] must be an object.`);
    }

    if (
      typeof entry.walletAddress !== "string" ||
      entry.walletAddress.trim().length === 0
    ) {
      throw new Error(
        `${name}[${index}].walletAddress must be a non-empty string.`
      );
    }

    if (
      typeof entry.privateKey !== "string" ||
      entry.privateKey.trim().length === 0
    ) {
      throw new Error(
        `${name}[${index}].privateKey must be a non-empty string.`
      );
    }

    return {
      walletAddress: entry.walletAddress.trim(),
      privateKey: entry.privateKey.trim()
    };
  });

  const walletAddresses = new Set<string>();

  for (const signer of signers) {
    const normalizedWalletAddress = signer.walletAddress.toLowerCase();

    if (walletAddresses.has(normalizedWalletAddress)) {
      throw new Error(
        `${name} contains duplicate walletAddress "${signer.walletAddress}".`
      );
    }

    walletAddresses.add(normalizedWalletAddress);
  }

  return signers;
}

function resolveWorkerExecutionMode(
  environment: ApiRuntimeEnvironment,
  configuredExecutionMode: string | undefined,
  rpcUrl: string | undefined
): WorkerExecutionMode {
  if (configuredExecutionMode) {
    return parseWorkerExecutionMode(configuredExecutionMode);
  }

  if (environment === "development" && !rpcUrl) {
    return "synthetic";
  }

  return "monitor";
}

function readDevelopmentAwareRequiredRuntimeEnv(
  env: RuntimeEnvShape,
  environment: ApiRuntimeEnvironment,
  name: string,
  developmentDefaultValue: string
): string {
  const configuredValue = readOptionalRuntimeEnv(env, name);

  if (configuredValue) {
    return configuredValue;
  }

  if (environment === "development") {
    return developmentDefaultValue;
  }

  return readRequiredRuntimeEnv(env, name);
}

export type DatabaseRuntimeConfig = {
  readonly databaseUrl: string;
  readonly directUrl: string;
};

export type JwtRuntimeConfig = {
  readonly jwtSecret: string;
  readonly jwtExpirySeconds: number;
};

export type BlockchainWalletRuntimeConfig = {
  readonly rpcUrl: string;
  readonly ethereumPrivateKey: string;
};

export type BlockchainContractReadRuntimeConfig = {
  readonly rpcUrl: string;
  readonly stakingContractAddress: string;
  readonly loanContractAddress: string;
};

export type OptionalBlockchainContractReadRuntimeConfig = {
  readonly environment: ApiRuntimeEnvironment;
  readonly rpcUrl: string;
  readonly stakingContractAddress: string | null;
  readonly loanContractAddress: string | null;
};

export type BlockchainContractWriteRuntimeConfig = {
  readonly rpcUrl: string;
  readonly stakingContractAddress: string;
  readonly loanContractAddress: string;
  readonly ethereumPrivateKey: string;
};

export type OptionalBlockchainContractWriteRuntimeConfig = {
  readonly environment: ApiRuntimeEnvironment;
  readonly rpcUrl: string;
  readonly stakingContractAddress: string | null;
  readonly loanContractAddress: string | null;
  readonly ethereumPrivateKey: string | null;
};

export type ProductChainRuntimeConfig = {
  readonly productChainId: number;
};

export type ApiRuntimeEnvironment = "development" | "test" | "production";

export type ApiServerRuntimeConfig = {
  readonly environment: ApiRuntimeEnvironment;
  readonly port: number;
  readonly corsAllowedOrigins: readonly string[];
};

export type WorkerExecutionMode = "monitor" | "synthetic" | "managed";

export type ManagedWithdrawalSignerRuntimeConfig = {
  readonly walletAddress: string;
  readonly privateKey: string;
};

export type WorkerRuntimeConfig = {
  readonly environment: ApiRuntimeEnvironment;
  readonly workerId: string;
  readonly internalApiBaseUrl: string;
  readonly internalWorkerApiKey: string;
  readonly executionMode: WorkerExecutionMode;
  readonly pollIntervalMs: number;
  readonly batchLimit: number;
  readonly requestTimeoutMs: number;
  readonly internalApiStartupGracePeriodMs: number;
  readonly confirmationBlocks: number;
  readonly reconciliationScanIntervalMs: number;
  readonly platformAlertReEscalationIntervalMs: number;
  readonly solvencySnapshotIntervalMs: number;
  readonly governedExecutionDispatchIntervalMs: number;
  readonly managedWithdrawalClaimTimeoutMs: number;
  readonly policyControlledWithdrawalExecutorPrivateKey: string | null;
  readonly policyControlledWithdrawalPolicySignerPrivateKey: string | null;
  readonly policyControlledWithdrawalAuthorizationTtlSeconds: number;
  readonly rpcUrl: string | null;
  readonly depositSignerPrivateKey: string | null;
  readonly managedWithdrawalSigners: readonly ManagedWithdrawalSignerRuntimeConfig[];
};

export type SharedLoginBootstrapRuntimeConfig = {
  readonly enabled: boolean;
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly supabaseUserId: string;
};

export type InternalOperatorRuntimeConfig = {
  readonly internalOperatorApiKey: string;
};

export type InternalWorkerRuntimeConfig = {
  readonly internalWorkerApiKey: string;
};

export type ManualResolutionPolicyRuntimeConfig = {
  readonly manualResolutionAllowedOperatorRoles: readonly string[];
};

export type AccountHoldPolicyRuntimeConfig = {
  readonly accountHoldApplyAllowedOperatorRoles: readonly string[];
  readonly accountHoldReleaseAllowedOperatorRoles: readonly string[];
};

export type IncidentPackageExportGovernanceRuntimeConfig = {
  readonly incidentPackageExportMaxRecentLimit: number;
  readonly incidentPackageExportMaxTimelineLimit: number;
  readonly incidentPackageExportMaxSinceDays: number;
};

export type IncidentPackageReleaseGovernanceRuntimeConfig = {
  readonly incidentPackageReleaseApproverAllowedOperatorRoles: readonly string[];
  readonly incidentPackageReleaseApprovalExpiryHours: number;
};

export type ReleaseReadinessApprovalRuntimeConfig = {
  readonly releaseReadinessApprovalRequestAllowedOperatorRoles: readonly string[];
  readonly releaseReadinessApprovalApproverAllowedOperatorRoles: readonly string[];
  readonly releaseReadinessApprovalMaxEvidenceAgeHours: number;
};

export type StakingPoolGovernanceRuntimeConfig = {
  readonly stakingPoolGovernanceRequestAllowedOperatorRoles: readonly string[];
  readonly stakingPoolGovernanceApproverAllowedOperatorRoles: readonly string[];
  readonly stakingPoolGovernanceExecutorAllowedOperatorRoles: readonly string[];
};

export type SensitiveOperatorActionPolicyRuntimeConfig = {
  readonly transactionIntentDecisionAllowedOperatorRoles: readonly string[];
  readonly custodyOperationAllowedOperatorRoles: readonly string[];
  readonly stakingGovernanceAllowedOperatorRoles: readonly string[];
};

export type PlatformAlertDeliverySeverity = "warning" | "critical";

export type PlatformAlertDeliveryCategory =
  | "worker"
  | "reconciliation"
  | "queue"
  | "chain"
  | "treasury"
  | "operations";

export type PlatformAlertDeliveryEventType =
  | "opened"
  | "reopened"
  | "routed_to_review_case"
  | "owner_assigned"
  | "acknowledged"
  | "re_escalated"
  | "suppressed"
  | "suppression_cleared";

export type PlatformAlertDeliveryTargetRuntimeConfig = {
  readonly name: string;
  readonly url: string;
  readonly bearerToken: string | null;
  readonly deliveryMode: PlatformAlertDeliveryMode;
  readonly categories: readonly PlatformAlertDeliveryCategory[];
  readonly minimumSeverity: PlatformAlertDeliverySeverity;
  readonly eventTypes: readonly PlatformAlertDeliveryEventType[];
  readonly failoverTargetNames: readonly string[];
};

export type PlatformAlertDeliveryRuntimeConfig = {
  readonly requestTimeoutMs: number;
  readonly targets: readonly PlatformAlertDeliveryTargetRuntimeConfig[];
};

export type PlatformAlertDeliveryMode = "direct" | "failover_only";

export type PlatformAlertDeliveryHealthSloRuntimeConfig = {
  readonly lookbackHours: number;
  readonly minimumRecentDeliveries: number;
  readonly warningFailureRatePercent: number;
  readonly criticalFailureRatePercent: number;
  readonly warningPendingCount: number;
  readonly criticalPendingCount: number;
  readonly warningAverageDeliveryLatencyMs: number;
  readonly criticalAverageDeliveryLatencyMs: number;
  readonly warningConsecutiveFailures: number;
  readonly criticalConsecutiveFailures: number;
};

export type PlatformAlertAutomationPolicyRuntimeConfig = {
  readonly name: string;
  readonly categories: readonly PlatformAlertDeliveryCategory[];
  readonly minimumSeverity: PlatformAlertDeliverySeverity;
  readonly autoRouteToReviewCase: boolean;
  readonly routeNote: string | null;
};

export type PlatformAlertAutomationRuntimeConfig = {
  readonly policies: readonly PlatformAlertAutomationPolicyRuntimeConfig[];
};

export type PlatformAlertReEscalationRuntimeConfig = {
  readonly unacknowledgedCriticalAlertThresholdSeconds: number;
  readonly unownedCriticalAlertThresholdSeconds: number;
  readonly repeatIntervalSeconds: number;
};

export type SolvencyRuntimeConfig = {
  readonly environment: ApiRuntimeEnvironment;
  readonly evidenceStaleAfterSeconds: number;
  readonly warningReserveRatioBps: number;
  readonly criticalReserveRatioBps: number;
  readonly reportSignerPrivateKey: string;
  readonly resumeRequestAllowedOperatorRoles: readonly string[];
  readonly resumeApproverAllowedOperatorRoles: readonly string[];
};

export type GovernedTreasuryExecutionMode = "direct_private_key" | "governed_external";

export type GovernedExecutionRuntimeConfig = {
  readonly environment: ApiRuntimeEnvironment;
  readonly governedExecutionRequiredInProduction: boolean;
  readonly governedReserveCustodyTypes: readonly string[];
  readonly loanFundingExecutionMode: GovernedTreasuryExecutionMode;
  readonly stakingWriteExecutionMode: GovernedTreasuryExecutionMode;
  readonly requestAllowedOperatorRoles: readonly string[];
  readonly approverAllowedOperatorRoles: readonly string[];
  readonly overrideMaxHours: number;
  readonly executionPackageSignerPrivateKey: string;
  readonly executionClaimLeaseSeconds: number;
};

function parsePlatformAlertDeliveryHealthSloConfig(
  value: string,
  name: string
): PlatformAlertDeliveryHealthSloRuntimeConfig {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON.`);
  }

  if (!isRecord(parsedValue)) {
    throw new Error(`${name} must be a JSON object.`);
  }

  const lookbackHours =
    parsedValue.lookbackHours === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_LOOKBACK_HOURS
      : parsePositiveIntegerLike(
          parsedValue.lookbackHours,
          `${name}.lookbackHours`
        );
  const minimumRecentDeliveries =
    parsedValue.minimumRecentDeliveries === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_MINIMUM_RECENT_DELIVERIES
      : parsePositiveIntegerLike(
          parsedValue.minimumRecentDeliveries,
          `${name}.minimumRecentDeliveries`
        );
  const warningFailureRatePercent =
    parsedValue.warningFailureRatePercent === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_FAILURE_RATE_PERCENT
      : parseIntegerInRange(
          parsedValue.warningFailureRatePercent,
          `${name}.warningFailureRatePercent`,
          1,
          100
        );
  const criticalFailureRatePercent =
    parsedValue.criticalFailureRatePercent === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_FAILURE_RATE_PERCENT
      : parseIntegerInRange(
          parsedValue.criticalFailureRatePercent,
          `${name}.criticalFailureRatePercent`,
          1,
          100
        );
  const warningPendingCount =
    parsedValue.warningPendingCount === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_PENDING_COUNT
      : parsePositiveIntegerLike(
          parsedValue.warningPendingCount,
          `${name}.warningPendingCount`
        );
  const criticalPendingCount =
    parsedValue.criticalPendingCount === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_PENDING_COUNT
      : parsePositiveIntegerLike(
          parsedValue.criticalPendingCount,
          `${name}.criticalPendingCount`
        );
  const warningAverageDeliveryLatencyMs =
    parsedValue.warningAverageDeliveryLatencyMs === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_AVERAGE_LATENCY_MS
      : parsePositiveIntegerLike(
          parsedValue.warningAverageDeliveryLatencyMs,
          `${name}.warningAverageDeliveryLatencyMs`
        );
  const criticalAverageDeliveryLatencyMs =
    parsedValue.criticalAverageDeliveryLatencyMs === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_AVERAGE_LATENCY_MS
      : parsePositiveIntegerLike(
          parsedValue.criticalAverageDeliveryLatencyMs,
          `${name}.criticalAverageDeliveryLatencyMs`
        );
  const warningConsecutiveFailures =
    parsedValue.warningConsecutiveFailures === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_CONSECUTIVE_FAILURES
      : parsePositiveIntegerLike(
          parsedValue.warningConsecutiveFailures,
          `${name}.warningConsecutiveFailures`
        );
  const criticalConsecutiveFailures =
    parsedValue.criticalConsecutiveFailures === undefined
      ? DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_CONSECUTIVE_FAILURES
      : parsePositiveIntegerLike(
          parsedValue.criticalConsecutiveFailures,
          `${name}.criticalConsecutiveFailures`
        );

  if (warningFailureRatePercent > criticalFailureRatePercent) {
    throw new Error(
      `${name}.warningFailureRatePercent must be less than or equal to ${name}.criticalFailureRatePercent.`
    );
  }

  if (warningPendingCount > criticalPendingCount) {
    throw new Error(
      `${name}.warningPendingCount must be less than or equal to ${name}.criticalPendingCount.`
    );
  }

  if (warningAverageDeliveryLatencyMs > criticalAverageDeliveryLatencyMs) {
    throw new Error(
      `${name}.warningAverageDeliveryLatencyMs must be less than or equal to ${name}.criticalAverageDeliveryLatencyMs.`
    );
  }

  if (warningConsecutiveFailures > criticalConsecutiveFailures) {
    throw new Error(
      `${name}.warningConsecutiveFailures must be less than or equal to ${name}.criticalConsecutiveFailures.`
    );
  }

  return {
    lookbackHours,
    minimumRecentDeliveries,
    warningFailureRatePercent,
    criticalFailureRatePercent,
    warningPendingCount,
    criticalPendingCount,
    warningAverageDeliveryLatencyMs,
    criticalAverageDeliveryLatencyMs,
    warningConsecutiveFailures,
    criticalConsecutiveFailures
  };
}

export function loadDatabaseRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): DatabaseRuntimeConfig {
  return {
    databaseUrl: readRequiredRuntimeEnv(env, "DATABASE_URL"),
    directUrl: readRequiredRuntimeEnv(env, "DIRECT_URL")
  };
}

export function loadJwtRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): JwtRuntimeConfig {
  const rawExpiry = readOptionalRuntimeEnv(env, "JWT_EXPIRY_SECONDS") ?? "86400";

  return {
    jwtSecret: readRequiredRuntimeEnv(env, "JWT_SECRET"),
    jwtExpirySeconds: parsePositiveInteger(rawExpiry, "JWT_EXPIRY_SECONDS")
  };
}

export function loadBlockchainWalletRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): BlockchainWalletRuntimeConfig {
  return {
    rpcUrl: readRequiredRuntimeEnv(env, "RPC_URL"),
    ethereumPrivateKey: readRequiredRuntimeEnv(env, "ETHEREUM_PRIVATE_KEY")
  };
}

export function loadBlockchainContractReadRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): BlockchainContractReadRuntimeConfig {
  return {
    rpcUrl: readRequiredRuntimeEnv(env, "RPC_URL"),
    stakingContractAddress: readRequiredRuntimeEnv(
      env,
      "STAKING_CONTRACT_ADDRESS"
    ),
    loanContractAddress: readRequiredRuntimeEnv(env, "LOAN_CONTRACT_ADDRESS")
  };
}

export function loadOptionalBlockchainContractReadRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): OptionalBlockchainContractReadRuntimeConfig {
  return {
    environment: parseApiRuntimeEnvironment(
      readOptionalRuntimeEnv(env, "NODE_ENV")
    ),
    rpcUrl: readRequiredRuntimeEnv(env, "RPC_URL"),
    stakingContractAddress: readOptionalRuntimeEnv(
      env,
      "STAKING_CONTRACT_ADDRESS"
    ) ?? null,
    loanContractAddress: readOptionalRuntimeEnv(env, "LOAN_CONTRACT_ADDRESS") ?? null
  };
}

export function loadBlockchainContractWriteRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): BlockchainContractWriteRuntimeConfig {
  return {
    rpcUrl: readRequiredRuntimeEnv(env, "RPC_URL"),
    stakingContractAddress: readRequiredRuntimeEnv(
      env,
      "STAKING_CONTRACT_ADDRESS"
    ),
    loanContractAddress: readRequiredRuntimeEnv(env, "LOAN_CONTRACT_ADDRESS"),
    ethereumPrivateKey: readRequiredRuntimeEnv(env, "ETHEREUM_PRIVATE_KEY")
  };
}

export function loadOptionalBlockchainContractWriteRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): OptionalBlockchainContractWriteRuntimeConfig {
  return {
    environment: parseApiRuntimeEnvironment(
      readOptionalRuntimeEnv(env, "NODE_ENV")
    ),
    rpcUrl: readRequiredRuntimeEnv(env, "RPC_URL"),
    stakingContractAddress: readOptionalRuntimeEnv(
      env,
      "STAKING_CONTRACT_ADDRESS"
    ) ?? null,
    loanContractAddress: readOptionalRuntimeEnv(env, "LOAN_CONTRACT_ADDRESS") ?? null,
    ethereumPrivateKey: readOptionalRuntimeEnv(env, "ETHEREUM_PRIVATE_KEY") ?? null
  };
}

export function loadProductChainRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): ProductChainRuntimeConfig {
  const configuredProductChainId = readOptionalRuntimeEnv(
    env,
    "PRODUCT_CHAIN_ID"
  );

  if (!configuredProductChainId) {
    return {
      productChainId: DEFAULT_PRODUCT_CHAIN_ID
    };
  }

  return {
    productChainId: parsePositiveInteger(
      configuredProductChainId,
      "PRODUCT_CHAIN_ID"
    )
  };
}

export function loadApiServerRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): ApiServerRuntimeConfig {
  const environment = parseApiRuntimeEnvironment(
    readOptionalRuntimeEnv(env, "NODE_ENV")
  );
  const configuredPort = readOptionalRuntimeEnv(env, "API_PORT");
  const configuredCorsAllowedOrigins = readOptionalRuntimeEnv(
    env,
    "CORS_ALLOWED_ORIGINS"
  );

  if (!configuredCorsAllowedOrigins && environment === "production") {
    throw new Error(
      "CORS_ALLOWED_ORIGINS is required when NODE_ENV=production."
    );
  }

  return {
    environment,
    port: configuredPort
      ? parsePositiveInteger(configuredPort, "API_PORT")
      : DEFAULT_API_PORT,
    corsAllowedOrigins: configuredCorsAllowedOrigins
      ? parseCorsAllowedOrigins(
          configuredCorsAllowedOrigins,
          "CORS_ALLOWED_ORIGINS"
        )
      : [...DEFAULT_LOCAL_CORS_ALLOWED_ORIGINS]
  };
}

export function loadWorkerRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): WorkerRuntimeConfig {
  const environment = parseApiRuntimeEnvironment(
    readOptionalRuntimeEnv(env, "NODE_ENV")
  );
  const rpcUrl = readOptionalRuntimeEnv(env, "RPC_URL");
  const executionMode = resolveWorkerExecutionMode(
    environment,
    readOptionalRuntimeEnv(env, "WORKER_EXECUTION_MODE"),
    rpcUrl
  );

  if (executionMode === "synthetic" && environment === "production") {
    throw new Error(
      "WORKER_EXECUTION_MODE=synthetic is not allowed when NODE_ENV=production."
    );
  }

  if ((executionMode === "monitor" || executionMode === "managed") && !rpcUrl) {
    throw new Error(
      "RPC_URL is required when WORKER_EXECUTION_MODE=monitor or managed."
    );
  }

  const depositSignerPrivateKey = readOptionalRuntimeEnv(
    env,
    "WORKER_DEPOSIT_SIGNER_PRIVATE_KEY"
  );
  const policyControlledWithdrawalExecutorPrivateKey = readOptionalRuntimeEnv(
    env,
    "WORKER_POLICY_CONTROLLED_WITHDRAWAL_EXECUTOR_PRIVATE_KEY"
  );
  const policyControlledWithdrawalPolicySignerPrivateKey =
    readOptionalRuntimeEnv(
      env,
      "WORKER_POLICY_CONTROLLED_WITHDRAWAL_POLICY_SIGNER_PRIVATE_KEY"
    );
  const managedWithdrawalSignersJson = readOptionalRuntimeEnv(
    env,
    "WORKER_MANAGED_WITHDRAWAL_SIGNERS_JSON"
  );
  const managedWithdrawalSigners = managedWithdrawalSignersJson
    ? parseManagedWithdrawalSigners(
        managedWithdrawalSignersJson,
        "WORKER_MANAGED_WITHDRAWAL_SIGNERS_JSON"
      )
    : [];

  if (executionMode === "managed" && !depositSignerPrivateKey) {
    throw new Error(
      "WORKER_DEPOSIT_SIGNER_PRIVATE_KEY is required when WORKER_EXECUTION_MODE=managed."
    );
  }

  if (
    executionMode === "managed" &&
    Boolean(policyControlledWithdrawalExecutorPrivateKey) !==
      Boolean(policyControlledWithdrawalPolicySignerPrivateKey)
  ) {
    throw new Error(
      "WORKER_POLICY_CONTROLLED_WITHDRAWAL_EXECUTOR_PRIVATE_KEY and WORKER_POLICY_CONTROLLED_WITHDRAWAL_POLICY_SIGNER_PRIVATE_KEY must be configured together."
    );
  }

  const configuredBatchLimit = readOptionalRuntimeEnv(env, "WORKER_BATCH_LIMIT");
  const batchLimit = configuredBatchLimit
    ? parsePositiveInteger(configuredBatchLimit, "WORKER_BATCH_LIMIT")
    : DEFAULT_WORKER_BATCH_LIMIT;

  if (batchLimit > 100) {
    throw new Error("WORKER_BATCH_LIMIT must not be greater than 100.");
  }

  return {
    environment,
    workerId: readDevelopmentAwareRequiredRuntimeEnv(
      env,
      environment,
      "WORKER_ID",
      DEFAULT_LOCAL_WORKER_ID
    ),
    internalApiBaseUrl: normalizeBaseUrl(
      readDevelopmentAwareRequiredRuntimeEnv(
        env,
        environment,
        "INTERNAL_API_BASE_URL",
        DEFAULT_LOCAL_INTERNAL_API_BASE_URL
      ),
      "INTERNAL_API_BASE_URL"
    ),
    internalWorkerApiKey: readDevelopmentAwareRequiredRuntimeEnv(
      env,
      environment,
      "INTERNAL_WORKER_API_KEY",
      DEFAULT_LOCAL_INTERNAL_WORKER_API_KEY
    ),
    executionMode,
    pollIntervalMs: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "WORKER_POLL_INTERVAL_MS") ??
        String(DEFAULT_WORKER_POLL_INTERVAL_MS),
      "WORKER_POLL_INTERVAL_MS"
    ),
    batchLimit,
    requestTimeoutMs: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "WORKER_REQUEST_TIMEOUT_MS") ??
        String(DEFAULT_WORKER_REQUEST_TIMEOUT_MS),
      "WORKER_REQUEST_TIMEOUT_MS"
    ),
    internalApiStartupGracePeriodMs: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "WORKER_INTERNAL_API_STARTUP_GRACE_PERIOD_MS") ??
        String(DEFAULT_WORKER_INTERNAL_API_STARTUP_GRACE_PERIOD_MS),
      "WORKER_INTERNAL_API_STARTUP_GRACE_PERIOD_MS"
    ),
    confirmationBlocks: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "WORKER_CONFIRMATION_BLOCKS") ??
        String(DEFAULT_WORKER_CONFIRMATION_BLOCKS),
      "WORKER_CONFIRMATION_BLOCKS"
    ),
    reconciliationScanIntervalMs: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "WORKER_RECONCILIATION_SCAN_INTERVAL_MS") ??
        "300000",
      "WORKER_RECONCILIATION_SCAN_INTERVAL_MS"
    ),
    platformAlertReEscalationIntervalMs: parsePositiveInteger(
      readOptionalRuntimeEnv(
        env,
        "WORKER_PLATFORM_ALERT_REESCALATION_INTERVAL_MS"
      ) ?? String(DEFAULT_WORKER_PLATFORM_ALERT_REESCALATION_INTERVAL_MS),
      "WORKER_PLATFORM_ALERT_REESCALATION_INTERVAL_MS"
    ),
    solvencySnapshotIntervalMs: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "WORKER_SOLVENCY_SNAPSHOT_INTERVAL_MS") ??
        String(DEFAULT_WORKER_SOLVENCY_SNAPSHOT_INTERVAL_MS),
      "WORKER_SOLVENCY_SNAPSHOT_INTERVAL_MS"
    ),
    governedExecutionDispatchIntervalMs: parsePositiveInteger(
      readOptionalRuntimeEnv(
        env,
        "WORKER_GOVERNED_EXECUTION_DISPATCH_INTERVAL_MS"
      ) ?? String(DEFAULT_WORKER_GOVERNED_EXECUTION_DISPATCH_INTERVAL_MS),
      "WORKER_GOVERNED_EXECUTION_DISPATCH_INTERVAL_MS"
    ),
    managedWithdrawalClaimTimeoutMs: parsePositiveInteger(
      readOptionalRuntimeEnv(
        env,
        "WORKER_MANAGED_WITHDRAWAL_CLAIM_TIMEOUT_MS"
      ) ?? String(DEFAULT_WORKER_MANAGED_WITHDRAWAL_CLAIM_TIMEOUT_MS),
      "WORKER_MANAGED_WITHDRAWAL_CLAIM_TIMEOUT_MS"
    ),
    policyControlledWithdrawalExecutorPrivateKey:
      policyControlledWithdrawalExecutorPrivateKey ?? null,
    policyControlledWithdrawalPolicySignerPrivateKey:
      policyControlledWithdrawalPolicySignerPrivateKey ?? null,
    policyControlledWithdrawalAuthorizationTtlSeconds: parsePositiveInteger(
      readOptionalRuntimeEnv(
        env,
        "WORKER_POLICY_CONTROLLED_WITHDRAWAL_AUTHORIZATION_TTL_SECONDS"
      ) ??
        String(
          DEFAULT_WORKER_POLICY_CONTROLLED_WITHDRAWAL_AUTHORIZATION_TTL_SECONDS
        ),
      "WORKER_POLICY_CONTROLLED_WITHDRAWAL_AUTHORIZATION_TTL_SECONDS"
    ),
    rpcUrl: rpcUrl ?? null,
    depositSignerPrivateKey: depositSignerPrivateKey ?? null,
    managedWithdrawalSigners
  };
}

export function loadSharedLoginBootstrapRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): SharedLoginBootstrapRuntimeConfig {
  const environment = parseApiRuntimeEnvironment(
    readOptionalRuntimeEnv(env, "NODE_ENV")
  );
  const configuredEnabled = readOptionalRuntimeEnv(env, "SHARED_LOGIN_ENABLED");
  const enabled = configuredEnabled
    ? parseBoolean(configuredEnabled, "SHARED_LOGIN_ENABLED")
    : environment === "production"
      ? false
      : DEFAULT_SHARED_LOGIN_ENABLED;

  const email =
    readOptionalRuntimeEnv(env, "SHARED_LOGIN_EMAIL") ?? DEFAULT_SHARED_LOGIN_EMAIL;
  const password =
    readOptionalRuntimeEnv(env, "SHARED_LOGIN_PASSWORD") ??
    DEFAULT_SHARED_LOGIN_PASSWORD;
  const firstName =
    readOptionalRuntimeEnv(env, "SHARED_LOGIN_FIRST_NAME") ??
    DEFAULT_SHARED_LOGIN_FIRST_NAME;
  const lastName =
    readOptionalRuntimeEnv(env, "SHARED_LOGIN_LAST_NAME") ??
    DEFAULT_SHARED_LOGIN_LAST_NAME;
  const supabaseUserId =
    readOptionalRuntimeEnv(env, "SHARED_LOGIN_SUPABASE_USER_ID") ??
    DEFAULT_SHARED_LOGIN_SUPABASE_USER_ID;

  if (!enabled) {
    return {
      enabled,
      email,
      password,
      firstName,
      lastName,
      supabaseUserId
    };
  }

  if (environment === "production") {
    if (email === DEFAULT_SHARED_LOGIN_EMAIL) {
      throw new Error(
        "SHARED_LOGIN_EMAIL must be explicitly overridden when shared login bootstrap is enabled in production."
      );
    }

    if (password === DEFAULT_SHARED_LOGIN_PASSWORD) {
      throw new Error(
        "SHARED_LOGIN_PASSWORD must be explicitly overridden when shared login bootstrap is enabled in production."
      );
    }
  }

  if (password.length < 8) {
    throw new Error("SHARED_LOGIN_PASSWORD must be at least 8 characters long.");
  }

  return {
    enabled,
    email,
    password,
    firstName,
    lastName,
    supabaseUserId
  };
}

export function loadInternalOperatorRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): InternalOperatorRuntimeConfig {
  const environment = parseApiRuntimeEnvironment(
    readOptionalRuntimeEnv(env, "NODE_ENV")
  );

  return {
    internalOperatorApiKey: readDevelopmentAwareRequiredRuntimeEnv(
      env,
      environment,
      "INTERNAL_OPERATOR_API_KEY",
      DEFAULT_LOCAL_INTERNAL_OPERATOR_API_KEY
    )
  };
}

export function loadInternalWorkerRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): InternalWorkerRuntimeConfig {
  const environment = parseApiRuntimeEnvironment(
    readOptionalRuntimeEnv(env, "NODE_ENV")
  );

  return {
    internalWorkerApiKey: readDevelopmentAwareRequiredRuntimeEnv(
      env,
      environment,
      "INTERNAL_WORKER_API_KEY",
      DEFAULT_LOCAL_INTERNAL_WORKER_API_KEY
    )
  };
}

export function loadManualResolutionPolicyRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): ManualResolutionPolicyRuntimeConfig {
  const configuredRoles = readOptionalRuntimeEnv(
    env,
    "MANUAL_RESOLUTION_ALLOWED_OPERATOR_ROLES"
  );

  if (!configuredRoles) {
    return {
      manualResolutionAllowedOperatorRoles: [
        ...DEFAULT_MANUAL_RESOLUTION_ALLOWED_OPERATOR_ROLES
      ]
    };
  }

  return {
    manualResolutionAllowedOperatorRoles: parseCommaSeparatedValues(
      configuredRoles,
      "MANUAL_RESOLUTION_ALLOWED_OPERATOR_ROLES"
    )
  };
}

export function loadAccountHoldPolicyRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): AccountHoldPolicyRuntimeConfig {
  const configuredApplyRoles = readOptionalRuntimeEnv(
    env,
    "ACCOUNT_HOLD_APPLY_ALLOWED_OPERATOR_ROLES"
  );
  const configuredReleaseRoles = readOptionalRuntimeEnv(
    env,
    "ACCOUNT_HOLD_RELEASE_ALLOWED_OPERATOR_ROLES"
  );

  return {
    accountHoldApplyAllowedOperatorRoles: configuredApplyRoles
      ? parseCommaSeparatedValues(
          configuredApplyRoles,
          "ACCOUNT_HOLD_APPLY_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_ACCOUNT_HOLD_APPLY_ALLOWED_OPERATOR_ROLES],
    accountHoldReleaseAllowedOperatorRoles: configuredReleaseRoles
      ? parseCommaSeparatedValues(
          configuredReleaseRoles,
          "ACCOUNT_HOLD_RELEASE_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_ACCOUNT_HOLD_RELEASE_ALLOWED_OPERATOR_ROLES]
  };
}

export function loadIncidentPackageExportGovernanceRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): IncidentPackageExportGovernanceRuntimeConfig {
  const configuredMaxRecentLimit = readOptionalRuntimeEnv(
    env,
    "INCIDENT_PACKAGE_EXPORT_MAX_RECENT_LIMIT"
  );
  const configuredMaxTimelineLimit = readOptionalRuntimeEnv(
    env,
    "INCIDENT_PACKAGE_EXPORT_MAX_TIMELINE_LIMIT"
  );
  const configuredMaxSinceDays = readOptionalRuntimeEnv(
    env,
    "INCIDENT_PACKAGE_EXPORT_MAX_SINCE_DAYS"
  );

  return {
    incidentPackageExportMaxRecentLimit: configuredMaxRecentLimit
      ? parsePositiveInteger(
          configuredMaxRecentLimit,
          "INCIDENT_PACKAGE_EXPORT_MAX_RECENT_LIMIT"
        )
      : DEFAULT_INCIDENT_PACKAGE_EXPORT_MAX_RECENT_LIMIT,
    incidentPackageExportMaxTimelineLimit: configuredMaxTimelineLimit
      ? parsePositiveInteger(
          configuredMaxTimelineLimit,
          "INCIDENT_PACKAGE_EXPORT_MAX_TIMELINE_LIMIT"
        )
      : DEFAULT_INCIDENT_PACKAGE_EXPORT_MAX_TIMELINE_LIMIT,
    incidentPackageExportMaxSinceDays: configuredMaxSinceDays
      ? parsePositiveInteger(
          configuredMaxSinceDays,
          "INCIDENT_PACKAGE_EXPORT_MAX_SINCE_DAYS"
        )
      : DEFAULT_INCIDENT_PACKAGE_EXPORT_MAX_SINCE_DAYS
  };
}

export function loadIncidentPackageReleaseGovernanceRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): IncidentPackageReleaseGovernanceRuntimeConfig {
  const configuredApproverRoles = readOptionalRuntimeEnv(
    env,
    "INCIDENT_PACKAGE_RELEASE_APPROVER_ALLOWED_OPERATOR_ROLES"
  );
  const configuredApprovalExpiryHours = readOptionalRuntimeEnv(
    env,
    "INCIDENT_PACKAGE_RELEASE_APPROVAL_EXPIRY_HOURS"
  );

  return {
    incidentPackageReleaseApproverAllowedOperatorRoles: configuredApproverRoles
      ? parseCommaSeparatedValues(
          configuredApproverRoles,
          "INCIDENT_PACKAGE_RELEASE_APPROVER_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_INCIDENT_PACKAGE_RELEASE_APPROVER_ALLOWED_OPERATOR_ROLES],
    incidentPackageReleaseApprovalExpiryHours: configuredApprovalExpiryHours
      ? parsePositiveInteger(
          configuredApprovalExpiryHours,
          "INCIDENT_PACKAGE_RELEASE_APPROVAL_EXPIRY_HOURS"
        )
      : DEFAULT_INCIDENT_PACKAGE_RELEASE_APPROVAL_EXPIRY_HOURS
  };
}

export function loadReleaseReadinessApprovalRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): ReleaseReadinessApprovalRuntimeConfig {
  const configuredRequestRoles = readOptionalRuntimeEnv(
    env,
    "RELEASE_READINESS_APPROVAL_REQUEST_ALLOWED_OPERATOR_ROLES"
  );
  const configuredApproverRoles = readOptionalRuntimeEnv(
    env,
    "RELEASE_READINESS_APPROVER_ALLOWED_OPERATOR_ROLES"
  );
  const configuredLegacyApproverRoles = readOptionalRuntimeEnv(
    env,
    "RELEASE_READINESS_APPROVAL_ALLOWED_OPERATOR_ROLES"
  );
  const configuredMaxEvidenceAgeHours = readOptionalRuntimeEnv(
    env,
    "RELEASE_READINESS_APPROVAL_MAX_EVIDENCE_AGE_HOURS"
  );

  return {
    releaseReadinessApprovalRequestAllowedOperatorRoles: configuredRequestRoles
      ? parseCommaSeparatedValues(
          configuredRequestRoles,
          "RELEASE_READINESS_APPROVAL_REQUEST_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_RELEASE_READINESS_APPROVAL_REQUEST_ALLOWED_OPERATOR_ROLES],
    releaseReadinessApprovalApproverAllowedOperatorRoles:
      configuredApproverRoles
      ? parseCommaSeparatedValues(
          configuredApproverRoles,
          "RELEASE_READINESS_APPROVER_ALLOWED_OPERATOR_ROLES"
        )
      : configuredLegacyApproverRoles
        ? parseCommaSeparatedValues(
            configuredLegacyApproverRoles,
            "RELEASE_READINESS_APPROVAL_ALLOWED_OPERATOR_ROLES"
          )
        : [...DEFAULT_RELEASE_READINESS_APPROVER_ALLOWED_OPERATOR_ROLES],
    releaseReadinessApprovalMaxEvidenceAgeHours: configuredMaxEvidenceAgeHours
      ? parsePositiveInteger(
          configuredMaxEvidenceAgeHours,
          "RELEASE_READINESS_APPROVAL_MAX_EVIDENCE_AGE_HOURS"
        )
      : DEFAULT_RELEASE_READINESS_MAX_EVIDENCE_AGE_HOURS
  };
}

export function loadStakingPoolGovernanceRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): StakingPoolGovernanceRuntimeConfig {
  const configuredLegacyGovernanceRoles = readOptionalRuntimeEnv(
    env,
    "STAKING_GOVERNANCE_ALLOWED_OPERATOR_ROLES"
  );
  const configuredRequestRoles = readOptionalRuntimeEnv(
    env,
    "STAKING_POOL_GOVERNANCE_REQUEST_ALLOWED_OPERATOR_ROLES"
  );
  const configuredApproverRoles = readOptionalRuntimeEnv(
    env,
    "STAKING_POOL_GOVERNANCE_APPROVER_ALLOWED_OPERATOR_ROLES"
  );
  const configuredExecutorRoles = readOptionalRuntimeEnv(
    env,
    "STAKING_POOL_GOVERNANCE_EXECUTOR_ALLOWED_OPERATOR_ROLES"
  );

  const legacyGovernanceRoles = configuredLegacyGovernanceRoles
    ? parseCommaSeparatedValues(
        configuredLegacyGovernanceRoles,
        "STAKING_GOVERNANCE_ALLOWED_OPERATOR_ROLES"
      )
    : null;

  return {
    stakingPoolGovernanceRequestAllowedOperatorRoles: configuredRequestRoles
      ? parseCommaSeparatedValues(
          configuredRequestRoles,
          "STAKING_POOL_GOVERNANCE_REQUEST_ALLOWED_OPERATOR_ROLES"
        )
      : legacyGovernanceRoles ??
        [...DEFAULT_STAKING_POOL_GOVERNANCE_REQUEST_ALLOWED_OPERATOR_ROLES],
    stakingPoolGovernanceApproverAllowedOperatorRoles: configuredApproverRoles
      ? parseCommaSeparatedValues(
          configuredApproverRoles,
          "STAKING_POOL_GOVERNANCE_APPROVER_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_STAKING_POOL_GOVERNANCE_APPROVER_ALLOWED_OPERATOR_ROLES],
    stakingPoolGovernanceExecutorAllowedOperatorRoles: configuredExecutorRoles
      ? parseCommaSeparatedValues(
          configuredExecutorRoles,
          "STAKING_POOL_GOVERNANCE_EXECUTOR_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_STAKING_POOL_GOVERNANCE_EXECUTOR_ALLOWED_OPERATOR_ROLES]
  };
}

export function loadSensitiveOperatorActionPolicyRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): SensitiveOperatorActionPolicyRuntimeConfig {
  const configuredTransactionIntentDecisionRoles = readOptionalRuntimeEnv(
    env,
    "TRANSACTION_INTENT_DECISION_ALLOWED_OPERATOR_ROLES"
  );
  const configuredCustodyOperationRoles = readOptionalRuntimeEnv(
    env,
    "CUSTODY_OPERATION_ALLOWED_OPERATOR_ROLES"
  );
  const configuredStakingGovernanceRoles = readOptionalRuntimeEnv(
    env,
    "STAKING_GOVERNANCE_ALLOWED_OPERATOR_ROLES"
  );

  return {
    transactionIntentDecisionAllowedOperatorRoles:
      configuredTransactionIntentDecisionRoles
        ? parseCommaSeparatedValues(
            configuredTransactionIntentDecisionRoles,
            "TRANSACTION_INTENT_DECISION_ALLOWED_OPERATOR_ROLES"
          )
        : [...DEFAULT_TRANSACTION_INTENT_DECISION_ALLOWED_OPERATOR_ROLES],
    custodyOperationAllowedOperatorRoles: configuredCustodyOperationRoles
      ? parseCommaSeparatedValues(
          configuredCustodyOperationRoles,
          "CUSTODY_OPERATION_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_CUSTODY_OPERATION_ALLOWED_OPERATOR_ROLES],
    stakingGovernanceAllowedOperatorRoles: configuredStakingGovernanceRoles
      ? parseCommaSeparatedValues(
          configuredStakingGovernanceRoles,
          "STAKING_GOVERNANCE_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_STAKING_GOVERNANCE_ALLOWED_OPERATOR_ROLES]
  };
}

export function loadPlatformAlertDeliveryRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): PlatformAlertDeliveryRuntimeConfig {
  const configuredTargets = readOptionalRuntimeEnv(
    env,
    "PLATFORM_ALERT_DELIVERY_TARGETS_JSON"
  );
  const configuredRequestTimeout = readOptionalRuntimeEnv(
    env,
    "PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS"
  );

  return {
    requestTimeoutMs: configuredRequestTimeout
      ? parsePositiveInteger(
          configuredRequestTimeout,
          "PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS"
        )
      : DEFAULT_PLATFORM_ALERT_DELIVERY_REQUEST_TIMEOUT_MS,
    targets: configuredTargets
      ? parsePlatformAlertDeliveryTargets(
          configuredTargets,
          "PLATFORM_ALERT_DELIVERY_TARGETS_JSON"
        )
      : []
  };
}

export function loadPlatformAlertAutomationRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): PlatformAlertAutomationRuntimeConfig {
  const configuredPolicies = readOptionalRuntimeEnv(
    env,
    "PLATFORM_ALERT_AUTOMATION_POLICIES_JSON"
  );

  return {
    policies: configuredPolicies
      ? parsePlatformAlertAutomationPolicies(
          configuredPolicies,
          "PLATFORM_ALERT_AUTOMATION_POLICIES_JSON"
        )
      : []
  };
}

export function loadPlatformAlertDeliveryHealthSloRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): PlatformAlertDeliveryHealthSloRuntimeConfig {
  const configuredSlo = readOptionalRuntimeEnv(
    env,
    "PLATFORM_ALERT_DELIVERY_HEALTH_SLO_JSON"
  );

  return configuredSlo
    ? parsePlatformAlertDeliveryHealthSloConfig(
        configuredSlo,
        "PLATFORM_ALERT_DELIVERY_HEALTH_SLO_JSON"
      )
    : {
        lookbackHours: DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_LOOKBACK_HOURS,
        minimumRecentDeliveries:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_MINIMUM_RECENT_DELIVERIES,
        warningFailureRatePercent:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_FAILURE_RATE_PERCENT,
        criticalFailureRatePercent:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_FAILURE_RATE_PERCENT,
        warningPendingCount:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_PENDING_COUNT,
        criticalPendingCount:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_PENDING_COUNT,
        warningAverageDeliveryLatencyMs:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_AVERAGE_LATENCY_MS,
        criticalAverageDeliveryLatencyMs:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_AVERAGE_LATENCY_MS,
        warningConsecutiveFailures:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_WARNING_CONSECUTIVE_FAILURES,
        criticalConsecutiveFailures:
          DEFAULT_PLATFORM_ALERT_DELIVERY_HEALTH_SLO_CRITICAL_CONSECUTIVE_FAILURES
      };
}

export function loadPlatformAlertReEscalationRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): PlatformAlertReEscalationRuntimeConfig {
  return {
    unacknowledgedCriticalAlertThresholdSeconds: parsePositiveInteger(
      readOptionalRuntimeEnv(
        env,
        "PLATFORM_ALERT_REESCALATION_UNACKNOWLEDGED_SECONDS"
      ) ?? String(DEFAULT_PLATFORM_ALERT_REESCALATION_UNACKNOWLEDGED_SECONDS),
      "PLATFORM_ALERT_REESCALATION_UNACKNOWLEDGED_SECONDS"
    ),
    unownedCriticalAlertThresholdSeconds: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "PLATFORM_ALERT_REESCALATION_UNOWNED_SECONDS") ??
        String(DEFAULT_PLATFORM_ALERT_REESCALATION_UNOWNED_SECONDS),
      "PLATFORM_ALERT_REESCALATION_UNOWNED_SECONDS"
    ),
    repeatIntervalSeconds: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "PLATFORM_ALERT_REESCALATION_REPEAT_SECONDS") ??
        String(DEFAULT_PLATFORM_ALERT_REESCALATION_REPEAT_SECONDS),
      "PLATFORM_ALERT_REESCALATION_REPEAT_SECONDS"
    )
  };
}

export function loadSolvencyRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): SolvencyRuntimeConfig {
  const environment = parseApiRuntimeEnvironment(
    readOptionalRuntimeEnv(env, "NODE_ENV")
  );
  const evidenceStaleAfterSeconds = parsePositiveInteger(
    readOptionalRuntimeEnv(env, "SOLVENCY_EVIDENCE_STALE_AFTER_SECONDS") ??
      "300",
    "SOLVENCY_EVIDENCE_STALE_AFTER_SECONDS"
  );
  const criticalReserveRatioBps = parseIntegerInRange(
    Number(
      readOptionalRuntimeEnv(env, "SOLVENCY_CRITICAL_RESERVE_RATIO_BPS") ??
        "10000"
    ),
    "SOLVENCY_CRITICAL_RESERVE_RATIO_BPS",
    0,
    100000
  );
  const warningReserveRatioBps = parseIntegerInRange(
    Number(
      readOptionalRuntimeEnv(env, "SOLVENCY_WARNING_RESERVE_RATIO_BPS") ??
        "10500"
    ),
    "SOLVENCY_WARNING_RESERVE_RATIO_BPS",
    criticalReserveRatioBps,
    100000
  );
  const configuredReportSignerPrivateKey = readOptionalRuntimeEnv(
    env,
    "SOLVENCY_REPORT_SIGNER_PRIVATE_KEY"
  );
  const configuredResumeRequestRoles = readOptionalRuntimeEnv(
    env,
    "SOLVENCY_RESUME_REQUEST_ALLOWED_OPERATOR_ROLES"
  );
  const configuredResumeApproverRoles = readOptionalRuntimeEnv(
    env,
    "SOLVENCY_RESUME_APPROVER_ALLOWED_OPERATOR_ROLES"
  );
  const reportSignerPrivateKey =
    configuredReportSignerPrivateKey?.trim() ||
    (environment === "production"
      ? ""
      : DEFAULT_LOCAL_SOLVENCY_REPORT_SIGNER_PRIVATE_KEY);

  if (!reportSignerPrivateKey) {
    throw new Error(
      "SOLVENCY_REPORT_SIGNER_PRIVATE_KEY must be configured in production."
    );
  }

  return {
    environment,
    evidenceStaleAfterSeconds,
    warningReserveRatioBps,
    criticalReserveRatioBps,
    reportSignerPrivateKey,
    resumeRequestAllowedOperatorRoles: configuredResumeRequestRoles
      ? parseCommaSeparatedValues(
          configuredResumeRequestRoles,
          "SOLVENCY_RESUME_REQUEST_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_SOLVENCY_RESUME_REQUEST_ALLOWED_OPERATOR_ROLES],
    resumeApproverAllowedOperatorRoles: configuredResumeApproverRoles
      ? parseCommaSeparatedValues(
          configuredResumeApproverRoles,
          "SOLVENCY_RESUME_APPROVER_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_SOLVENCY_RESUME_APPROVER_ALLOWED_OPERATOR_ROLES]
  };
}

export function loadGovernedExecutionRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): GovernedExecutionRuntimeConfig {
  const environment = parseApiRuntimeEnvironment(
    readOptionalRuntimeEnv(env, "NODE_ENV")
  );
  const configuredRequestRoles = readOptionalRuntimeEnv(
    env,
    "GOVERNED_EXECUTION_REQUEST_ALLOWED_OPERATOR_ROLES"
  );
  const configuredApproverRoles = readOptionalRuntimeEnv(
    env,
    "GOVERNED_EXECUTION_APPROVER_ALLOWED_OPERATOR_ROLES"
  );
  const configuredReserveCustodyTypes = readOptionalRuntimeEnv(
    env,
    "GOVERNED_EXECUTION_ALLOWED_RESERVE_CUSTODY_TYPES"
  );
  const executionPackageSignerPrivateKey =
    readOptionalRuntimeEnv(env, "GOVERNED_EXECUTION_PACKAGE_SIGNER_PRIVATE_KEY") ??
    readOptionalRuntimeEnv(env, "SOLVENCY_REPORT_SIGNER_PRIVATE_KEY");

  if (!executionPackageSignerPrivateKey) {
    throw new Error(
      "GOVERNED_EXECUTION_PACKAGE_SIGNER_PRIVATE_KEY is required."
    );
  }

  return {
    environment,
    governedExecutionRequiredInProduction: parseBoolean(
      readOptionalRuntimeEnv(env, "GOVERNED_EXECUTION_REQUIRED_IN_PRODUCTION") ??
        "true",
      "GOVERNED_EXECUTION_REQUIRED_IN_PRODUCTION"
    ),
    governedReserveCustodyTypes: configuredReserveCustodyTypes
      ? parseCommaSeparatedValues(
          configuredReserveCustodyTypes,
          "GOVERNED_EXECUTION_ALLOWED_RESERVE_CUSTODY_TYPES"
        )
      : ["multisig_controlled", "contract_controlled"],
    loanFundingExecutionMode: parseGovernedTreasuryExecutionMode(
      readOptionalRuntimeEnv(env, "GOVERNED_LOAN_FUNDING_EXECUTION_MODE"),
      "GOVERNED_LOAN_FUNDING_EXECUTION_MODE"
    ),
    stakingWriteExecutionMode: parseGovernedTreasuryExecutionMode(
      readOptionalRuntimeEnv(env, "GOVERNED_STAKING_WRITE_EXECUTION_MODE"),
      "GOVERNED_STAKING_WRITE_EXECUTION_MODE"
    ),
    requestAllowedOperatorRoles: configuredRequestRoles
      ? parseCommaSeparatedValues(
          configuredRequestRoles,
          "GOVERNED_EXECUTION_REQUEST_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_GOVERNED_EXECUTION_REQUEST_ALLOWED_OPERATOR_ROLES],
    approverAllowedOperatorRoles: configuredApproverRoles
      ? parseCommaSeparatedValues(
          configuredApproverRoles,
          "GOVERNED_EXECUTION_APPROVER_ALLOWED_OPERATOR_ROLES"
        )
      : [...DEFAULT_GOVERNED_EXECUTION_APPROVER_ALLOWED_OPERATOR_ROLES],
    overrideMaxHours: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "GOVERNED_EXECUTION_OVERRIDE_MAX_HOURS") ??
        String(DEFAULT_GOVERNED_EXECUTION_OVERRIDE_MAX_HOURS),
      "GOVERNED_EXECUTION_OVERRIDE_MAX_HOURS"
    ),
    executionPackageSignerPrivateKey,
    executionClaimLeaseSeconds: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "GOVERNED_EXECUTION_CLAIM_LEASE_SECONDS") ??
        "300",
      "GOVERNED_EXECUTION_CLAIM_LEASE_SECONDS"
    )
  };
}
