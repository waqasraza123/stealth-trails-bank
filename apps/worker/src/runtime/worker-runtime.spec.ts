import assert from "node:assert/strict";
import test from "node:test";
import {
  loadInternalOperatorRuntimeConfig,
  loadInternalWorkerRuntimeConfig,
  loadWorkerRuntimeConfig
} from "@stealth-trails-bank/config/api";

test("worker runtime config defaults to monitor mode and requires rpc", () => {
  const runtime = loadWorkerRuntimeConfig({
    NODE_ENV: "development",
    WORKER_ID: "worker_1",
    INTERNAL_API_BASE_URL: "http://localhost:9001/",
    INTERNAL_WORKER_API_KEY: "secret",
    RPC_URL: "http://127.0.0.1:8545"
  });

  assert.equal(runtime.executionMode, "monitor");
  assert.equal(runtime.internalApiBaseUrl, "http://localhost:9001");
  assert.equal(runtime.confirmationBlocks, 1);
  assert.equal(runtime.internalApiStartupGracePeriodMs, 45000);
  assert.equal(runtime.reconciliationScanIntervalMs, 300000);
  assert.equal(runtime.governedExecutionDispatchIntervalMs, 60000);
  assert.equal(runtime.depositSignerPrivateKey, null);
  assert.equal(runtime.managedWithdrawalClaimTimeoutMs, 60000);
  assert.equal(runtime.policyControlledWithdrawalExecutorPrivateKey, null);
  assert.equal(runtime.policyControlledWithdrawalPolicySignerPrivateKey, null);
  assert.equal(runtime.policyControlledWithdrawalAuthorizationTtlSeconds, 300);
  assert.deepEqual(runtime.managedWithdrawalSigners, []);
});

test("worker runtime config defaults local development to synthetic mode", () => {
  const runtime = loadWorkerRuntimeConfig({
    NODE_ENV: "development"
  });

  assert.equal(runtime.workerId, "worker-local-1");
  assert.equal(runtime.internalApiBaseUrl, "http://localhost:9001");
  assert.equal(runtime.internalWorkerApiKey, "local-dev-worker-key");
  assert.equal(runtime.executionMode, "synthetic");
  assert.equal(runtime.internalApiStartupGracePeriodMs, 45000);
  assert.equal(runtime.rpcUrl, null);
  assert.equal(runtime.governedExecutionDispatchIntervalMs, 60000);
  assert.equal(runtime.managedWithdrawalClaimTimeoutMs, 60000);
  assert.equal(runtime.policyControlledWithdrawalAuthorizationTtlSeconds, 300);
});

test("worker runtime config allows overriding internal API startup grace period", () => {
  const runtime = loadWorkerRuntimeConfig({
    NODE_ENV: "development",
    WORKER_INTERNAL_API_STARTUP_GRACE_PERIOD_MS: "15000",
    WORKER_GOVERNED_EXECUTION_DISPATCH_INTERVAL_MS: "45000"
  });

  assert.equal(runtime.internalApiStartupGracePeriodMs, 15000);
  assert.equal(runtime.governedExecutionDispatchIntervalMs, 45000);
});

test("worker runtime config parses managed withdrawal signer mappings", () => {
  const runtime = loadWorkerRuntimeConfig({
    NODE_ENV: "production",
    WORKER_ID: "worker_1",
    INTERNAL_API_BASE_URL: "https://internal.example.com",
    INTERNAL_WORKER_API_KEY: "secret",
    WORKER_EXECUTION_MODE: "managed",
    RPC_URL: "https://rpc.example.com",
    WORKER_DEPOSIT_SIGNER_PRIVATE_KEY:
      "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8",
    WORKER_MANAGED_WITHDRAWAL_SIGNERS_JSON:
      '[{"walletAddress":"0x0000000000000000000000000000000000000def","privateKey":"0x8b3a350cf5c34c9194ca3a545d6f7f9f4c6c2a59d71c7b3f1b5e2ad65379b3f7"}]',
    WORKER_MANAGED_WITHDRAWAL_CLAIM_TIMEOUT_MS: "90000"
  });

  assert.equal(runtime.managedWithdrawalClaimTimeoutMs, 90000);
  assert.equal(runtime.policyControlledWithdrawalExecutorPrivateKey, null);
  assert.equal(runtime.policyControlledWithdrawalPolicySignerPrivateKey, null);
  assert.deepEqual(runtime.managedWithdrawalSigners, [
    {
      walletAddress: "0x0000000000000000000000000000000000000def",
      privateKey:
        "0x8b3a350cf5c34c9194ca3a545d6f7f9f4c6c2a59d71c7b3f1b5e2ad65379b3f7"
    }
  ]);
});

test("internal API key config defaults in local development", () => {
  assert.deepEqual(
    loadInternalWorkerRuntimeConfig({
      NODE_ENV: "development"
    }),
    {
      internalWorkerApiKey: "local-dev-worker-key"
    }
  );

  assert.deepEqual(
    loadInternalOperatorRuntimeConfig({
      NODE_ENV: "development"
    }),
    {
      environment: "development",
      internalOperatorApiKey: "local-dev-operator-key"
    }
  );
});

test("worker runtime config rejects synthetic mode in production", () => {
  assert.throws(
    () =>
      loadWorkerRuntimeConfig({
        NODE_ENV: "production",
        WORKER_ID: "worker_1",
        INTERNAL_API_BASE_URL: "https://internal.example.com",
        INTERNAL_WORKER_API_KEY: "secret",
        WORKER_EXECUTION_MODE: "synthetic"
      }),
    /not allowed/
  );
});

test("worker runtime config requires a deposit signer in managed mode", () => {
  assert.throws(
    () =>
      loadWorkerRuntimeConfig({
        NODE_ENV: "production",
        WORKER_ID: "worker_1",
        INTERNAL_API_BASE_URL: "https://internal.example.com",
        INTERNAL_WORKER_API_KEY: "secret",
        WORKER_EXECUTION_MODE: "managed",
        RPC_URL: "https://rpc.example.com"
      }),
    /WORKER_DEPOSIT_SIGNER_PRIVATE_KEY/
  );
});

test("worker runtime config accepts policy-controlled withdrawal signer configuration", () => {
  const runtime = loadWorkerRuntimeConfig({
    NODE_ENV: "production",
    WORKER_ID: "worker_1",
    INTERNAL_API_BASE_URL: "https://internal.example.com",
    INTERNAL_WORKER_API_KEY: "secret",
    WORKER_EXECUTION_MODE: "managed",
    RPC_URL: "https://rpc.example.com",
    WORKER_DEPOSIT_SIGNER_PRIVATE_KEY:
      "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8",
    WORKER_POLICY_CONTROLLED_WITHDRAWAL_EXECUTOR_PRIVATE_KEY:
      "0x8b3a350cf5c34c9194ca3a545d6f7f9f4c6c2a59d71c7b3f1b5e2ad65379b3f7",
    WORKER_POLICY_CONTROLLED_WITHDRAWAL_POLICY_SIGNER_PRIVATE_KEY:
      "0x0dbbe8b82c15f97d8a52f9b54ef8101de9d57f1a6f8ea46e65d9d6f5bf86de1a",
    WORKER_POLICY_CONTROLLED_WITHDRAWAL_AUTHORIZATION_TTL_SECONDS: "900"
  });

  assert.equal(
    runtime.policyControlledWithdrawalExecutorPrivateKey,
    "0x8b3a350cf5c34c9194ca3a545d6f7f9f4c6c2a59d71c7b3f1b5e2ad65379b3f7"
  );
  assert.equal(
    runtime.policyControlledWithdrawalPolicySignerPrivateKey,
    "0x0dbbe8b82c15f97d8a52f9b54ef8101de9d57f1a6f8ea46e65d9d6f5bf86de1a"
  );
  assert.equal(runtime.policyControlledWithdrawalAuthorizationTtlSeconds, 900);
});
