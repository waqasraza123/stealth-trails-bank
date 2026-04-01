import dotenv from "dotenv";
import {
  readOptionalRuntimeEnv,
  readRequiredRuntimeEnv,
  type RuntimeEnvShape
} from "./runtime-env";

const DEFAULT_PRODUCT_CHAIN_ID = 8453;

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

export type InternalOperatorRuntimeConfig = {
  readonly internalOperatorApiKey: string;
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
