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
const DEFAULT_WORKER_POLL_INTERVAL_MS = 10_000;
const DEFAULT_WORKER_BATCH_LIMIT = 20;
const DEFAULT_WORKER_REQUEST_TIMEOUT_MS = 10_000;
const DEFAULT_WORKER_CONFIRMATION_BLOCKS = 1;

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
};

export type BlockchainContractWriteRuntimeConfig = {
  readonly rpcUrl: string;
  readonly stakingContractAddress: string;
  readonly ethereumPrivateKey: string;
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

export type WorkerRuntimeConfig = {
  readonly environment: ApiRuntimeEnvironment;
  readonly workerId: string;
  readonly internalApiBaseUrl: string;
  readonly internalWorkerApiKey: string;
  readonly executionMode: WorkerExecutionMode;
  readonly pollIntervalMs: number;
  readonly batchLimit: number;
  readonly requestTimeoutMs: number;
  readonly confirmationBlocks: number;
  readonly rpcUrl: string | null;
  readonly depositSignerPrivateKey: string | null;
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
    )
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
    ethereumPrivateKey: readRequiredRuntimeEnv(env, "ETHEREUM_PRIVATE_KEY")
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
  const executionMode = parseWorkerExecutionMode(
    readOptionalRuntimeEnv(env, "WORKER_EXECUTION_MODE")
  );
  const rpcUrl = readOptionalRuntimeEnv(env, "RPC_URL");

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

  if (executionMode === "managed" && !depositSignerPrivateKey) {
    throw new Error(
      "WORKER_DEPOSIT_SIGNER_PRIVATE_KEY is required when WORKER_EXECUTION_MODE=managed."
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
    workerId: readRequiredRuntimeEnv(env, "WORKER_ID"),
    internalApiBaseUrl: normalizeBaseUrl(
      readRequiredRuntimeEnv(env, "INTERNAL_API_BASE_URL"),
      "INTERNAL_API_BASE_URL"
    ),
    internalWorkerApiKey: readRequiredRuntimeEnv(env, "INTERNAL_WORKER_API_KEY"),
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
    confirmationBlocks: parsePositiveInteger(
      readOptionalRuntimeEnv(env, "WORKER_CONFIRMATION_BLOCKS") ??
        String(DEFAULT_WORKER_CONFIRMATION_BLOCKS),
      "WORKER_CONFIRMATION_BLOCKS"
    ),
    rpcUrl: rpcUrl ?? null,
    depositSignerPrivateKey: depositSignerPrivateKey ?? null
  };
}

export function loadInternalOperatorRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): InternalOperatorRuntimeConfig {
  return {
    internalOperatorApiKey: readRequiredRuntimeEnv(
      env,
      "INTERNAL_OPERATOR_API_KEY"
    )
  };
}

export function loadInternalWorkerRuntimeConfig(
  env: RuntimeEnvShape = getNodeRuntimeEnv()
): InternalWorkerRuntimeConfig {
  return {
    internalWorkerApiKey: readRequiredRuntimeEnv(env, "INTERNAL_WORKER_API_KEY")
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
