import assert from "node:assert/strict";
import test from "node:test";
import { ManagedExecutionIntentError } from "./deposit-broadcaster";
import { WorkerOrchestrator } from "./worker-orchestrator";
import type { WorkerIntentProjection, WorkerLogger } from "./worker-types";

function createIntent(
  id: string,
  overrides: Partial<WorkerIntentProjection> = {}
): WorkerIntentProjection {
  return {
    id,
    customerAccountId: "account_1",
    asset: {
      id: "asset_1",
      symbol: "ETH",
      displayName: "Ether",
      decimals: 18,
      chainId: 8453,
      assetType: "native",
      contractAddress: null
    },
    destinationWalletAddress: "0x0000000000000000000000000000000000000abc",
    sourceWalletAddress: "0x0000000000000000000000000000000000000def",
    externalAddress: "0x0000000000000000000000000000000000000fed",
    chainId: 8453,
    status: "queued",
    requestedAmount: "1.25",
    latestBlockchainTransaction: null,
    ...overrides
  };
}

function createLogger(): WorkerLogger {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

function createCapturingLogger() {
  const warnings: Array<{ event: string; metadata: Record<string, unknown> }> = [];

  const logger: WorkerLogger = {
    info() {},
    warn(event, metadata) {
      warnings.push({ event, metadata });
    },
    error() {}
  };

  return {
    logger,
    warnings
  };
}

test("synthetic mode records broadcasts and settles them", async () => {
  const queuedDepositIntent = createIntent("deposit_1");
  const queuedWithdrawalIntent = createIntent("withdrawal_1");
  const operations: string[] = [];

  const client = {
    async listQueuedDepositIntents() {
      return { intents: [queuedDepositIntent], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [queuedWithdrawalIntent], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return {
        intents: [
          createIntent("deposit_1", {
            status: "broadcast",
            latestBlockchainTransaction: {
              id: "btx_1",
              txHash:
                "0x1111111111111111111111111111111111111111111111111111111111111111",
              status: "broadcast",
              fromAddress: "0x000000000000000000000000000000000000dEaD",
              toAddress: "0x0000000000000000000000000000000000000abc",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          })
        ],
        limit: 20
      };
    },
    async listBroadcastWithdrawalIntents() {
      return {
        intents: [
          createIntent("withdrawal_1", {
            status: "broadcast",
            latestBlockchainTransaction: {
              id: "btx_2",
              txHash:
                "0x2222222222222222222222222222222222222222222222222222222222222222",
              status: "broadcast",
              fromAddress: "0x0000000000000000000000000000000000000def",
              toAddress: "0x0000000000000000000000000000000000000fed",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          })
        ],
        limit: 20
      };
    },
    async recordDepositBroadcast(intentId: string) {
      operations.push(`recordDepositBroadcast:${intentId}`);
    },
    async confirmDepositIntent(intentId: string) {
      operations.push(`confirmDepositIntent:${intentId}`);
    },
    async settleDepositIntent(intentId: string) {
      operations.push(`settleDepositIntent:${intentId}`);
    },
    async failDepositIntent() {
      throw new Error("should not fail deposit intent in synthetic mode");
    },
    async recordWithdrawalBroadcast(intentId: string) {
      operations.push(`recordWithdrawalBroadcast:${intentId}`);
    },
    async confirmWithdrawalIntent(intentId: string) {
      operations.push(`confirmWithdrawalIntent:${intentId}`);
    },
    async settleWithdrawalIntent(intentId: string) {
      operations.push(`settleWithdrawalIntent:${intentId}`);
    },
    async failWithdrawalIntent() {
      throw new Error("should not fail withdrawal intent in synthetic mode");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  };

  const orchestrator = new WorkerOrchestrator({
    runtime: {
      environment: "development",
      workerId: "worker_1",
      internalApiBaseUrl: "http://localhost:9001",
      internalWorkerApiKey: "secret",
      executionMode: "synthetic",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 1,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: null,
      depositSignerPrivateKey: null
    },
    internalApiClient: client,
    rpcClient: null,
    depositBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "recordDepositBroadcast:deposit_1",
    "recordWithdrawalBroadcast:withdrawal_1",
    "confirmDepositIntent:deposit_1",
    "settleDepositIntent:deposit_1",
    "confirmWithdrawalIntent:withdrawal_1",
    "settleWithdrawalIntent:withdrawal_1"
  ]);
});

test("monitor mode confirms and settles broadcast intents with enough confirmations", async () => {
  const operations: string[] = [];

  const client = {
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return {
        intents: [
          createIntent("deposit_1", {
            status: "broadcast",
            latestBlockchainTransaction: {
              id: "btx_1",
              txHash:
                "0x3333333333333333333333333333333333333333333333333333333333333333",
              status: "broadcast",
              fromAddress: "0x000000000000000000000000000000000000dEaD",
              toAddress: "0x0000000000000000000000000000000000000abc",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: null
            }
          })
        ],
        limit: 20
      };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("should not broadcast in monitor mode");
    },
    async confirmDepositIntent(intentId: string) {
      operations.push(`confirmDepositIntent:${intentId}`);
    },
    async settleDepositIntent(intentId: string) {
      operations.push(`settleDepositIntent:${intentId}`);
    },
    async failDepositIntent() {
      throw new Error("should not fail a successful monitored intent");
    },
    async recordWithdrawalBroadcast() {
      throw new Error("should not broadcast in monitor mode");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no withdrawal intents expected");
    },
    async settleWithdrawalIntent() {
      throw new Error("no withdrawal intents expected");
    },
    async failWithdrawalIntent() {
      throw new Error("no withdrawal intents expected");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  };

  const orchestrator = new WorkerOrchestrator({
    runtime: {
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey: null
    },
    internalApiClient: client,
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0x3333333333333333333333333333333333333333333333333333333333333333",
          fromAddress: "0x000000000000000000000000000000000000dEaD",
          toAddress: "0x0000000000000000000000000000000000000abc",
          blockNumber: 100n,
          succeeded: true
        };
      }
    },
    depositBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "confirmDepositIntent:deposit_1",
    "settleDepositIntent:deposit_1"
  ]);
});

test("managed mode broadcasts queued deposits and leaves withdrawals for manual custody execution", async () => {
  const operations: string[] = [];
  const { logger, warnings } = createCapturingLogger();

  const client = {
    async listQueuedDepositIntents() {
      return { intents: [createIntent("deposit_1")], limit: 20 };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [createIntent("withdrawal_1")], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast(intentId: string, payload: { txHash: string }) {
      operations.push(`recordDepositBroadcast:${intentId}:${payload.txHash}`);
    },
    async confirmDepositIntent() {
      throw new Error("no monitored deposits expected");
    },
    async settleDepositIntent() {
      throw new Error("no monitored deposits expected");
    },
    async failDepositIntent() {
      throw new Error("deposit should broadcast successfully");
    },
    async recordWithdrawalBroadcast() {
      throw new Error("withdrawals must not auto-broadcast in managed mode");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no monitored withdrawals expected");
    },
    async settleWithdrawalIntent() {
      throw new Error("no monitored withdrawals expected");
    },
    async failWithdrawalIntent() {
      throw new Error("withdrawals should stay queued for manual handling");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  };

  const orchestrator = new WorkerOrchestrator({
    runtime: {
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    },
    internalApiClient: client,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        return {
          txHash:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          fromAddress: "0x0000000000000000000000000000000000000aaa",
          toAddress: "0x0000000000000000000000000000000000000abc"
        };
      }
    },
    logger
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "recordDepositBroadcast:deposit_1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  ]);
  assert.equal(warnings.length, 1);
  assert.equal(
    warnings[0]?.event,
    "queued_withdrawals_require_manual_custody_execution"
  );
});

test("managed mode permanently fails malformed deposit intents", async () => {
  const operations: string[] = [];

  const client = {
    async listQueuedDepositIntents() {
      return {
        intents: [
          createIntent("deposit_1", {
            destinationWalletAddress: null
          })
        ],
        limit: 20
      };
    },
    async listQueuedWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastDepositIntents() {
      return { intents: [], limit: 20 };
    },
    async listBroadcastWithdrawalIntents() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("malformed deposit intent should not broadcast");
    },
    async confirmDepositIntent() {
      throw new Error("no monitored deposits expected");
    },
    async settleDepositIntent() {
      throw new Error("no monitored deposits expected");
    },
    async failDepositIntent(intentId: string, payload: { failureCode: string }) {
      operations.push(`failDepositIntent:${intentId}:${payload.failureCode}`);
    },
    async recordWithdrawalBroadcast() {
      throw new Error("no withdrawals expected");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async settleWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async failWithdrawalIntent() {
      throw new Error("no withdrawals expected");
    },
    async reportWorkerHeartbeat() {
      throw new Error("worker heartbeat reporting is handled outside the orchestrator");
    },
    async triggerLedgerReconciliationScan() {
      throw new Error("reconciliation scan scheduling is handled outside the orchestrator");
    },
    async triggerCriticalAlertReEscalationSweep() {
      throw new Error("platform alert re-escalation is handled outside the orchestrator");
    }
  };

  const orchestrator = new WorkerOrchestrator({
    runtime: {
      environment: "production",
      workerId: "worker_1",
      internalApiBaseUrl: "https://internal.example.com",
      internalWorkerApiKey: "secret",
      executionMode: "managed",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 2,
      reconciliationScanIntervalMs: 300000,
      platformAlertReEscalationIntervalMs: 300000,
      rpcUrl: "https://rpc.example.com",
      depositSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    },
    internalApiClient: client,
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: {
      signerAddress: "0x0000000000000000000000000000000000000aaa",
      async broadcast() {
        throw new ManagedExecutionIntentError({
          failureCode: "missing_destination_wallet",
          failureReason:
            "Deposit intent is missing a destination wallet address and cannot be broadcast."
        });
      }
    },
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failDepositIntent:deposit_1:missing_destination_wallet"
  ]);
});
