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
  const infos: Array<{ event: string; metadata: Record<string, unknown> }> = [];
  const errors: Array<{ event: string; metadata: Record<string, unknown> }> = [];

  const logger: WorkerLogger = {
    info(event, metadata) {
      infos.push({ event, metadata });
    },
    warn(event, metadata) {
      warnings.push({ event, metadata });
    },
    error(event, metadata) {
      errors.push({ event, metadata });
    }
  };

  return {
    logger,
    warnings,
    infos,
    errors
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
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
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
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
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

test("worker settles confirmed recovery backlog after the broadcast pass", async () => {
  const operations: string[] = [];

  const client = {
    async listQueuedDepositIntents() {
      return { intents: [], limit: 20 };
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
    async listConfirmedDepositIntentsReadyToSettle() {
      return {
        intents: [
          createIntent("deposit_confirmed_1", {
            status: "confirmed",
            latestBlockchainTransaction: {
              id: "btx_3",
              txHash:
                "0x4444444444444444444444444444444444444444444444444444444444444444",
              status: "confirmed",
              fromAddress: "0x000000000000000000000000000000000000dEaD",
              toAddress: "0x0000000000000000000000000000000000000abc",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: new Date().toISOString()
            }
          })
        ],
        limit: 20
      };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return {
        intents: [
          createIntent("withdrawal_confirmed_1", {
            status: "confirmed",
            latestBlockchainTransaction: {
              id: "btx_4",
              txHash:
                "0x5555555555555555555555555555555555555555555555555555555555555555",
              status: "confirmed",
              fromAddress: "0x0000000000000000000000000000000000000def",
              toAddress: "0x0000000000000000000000000000000000000fed",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              confirmedAt: new Date().toISOString()
            }
          })
        ],
        limit: 20
      };
    },
    async recordDepositBroadcast() {
      throw new Error("no broadcast expected");
    },
    async confirmDepositIntent() {
      throw new Error("no confirm expected");
    },
    async settleDepositIntent(intentId: string) {
      operations.push(`settleDepositIntent:${intentId}`);
    },
    async failDepositIntent() {
      throw new Error("no deposit failure expected");
    },
    async recordWithdrawalBroadcast() {
      throw new Error("no broadcast expected");
    },
    async confirmWithdrawalIntent() {
      throw new Error("no confirm expected");
    },
    async settleWithdrawalIntent(intentId: string) {
      operations.push(`settleWithdrawalIntent:${intentId}`);
    },
    async failWithdrawalIntent() {
      throw new Error("no withdrawal failure expected");
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
        return null;
      }
    },
    depositBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "settleDepositIntent:deposit_confirmed_1",
    "settleWithdrawalIntent:withdrawal_confirmed_1"
  ]);
});

test("monitor mode waits when a broadcast intent does not yet have enough confirmations", async () => {
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
          createIntent("deposit_waiting_1", {
            status: "broadcast",
            latestBlockchainTransaction: {
              id: "btx_waiting_1",
              txHash:
                "0x6666666666666666666666666666666666666666666666666666666666666666",
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
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async recordDepositBroadcast() {
      throw new Error("monitor mode should not record broadcasts");
    },
    async confirmDepositIntent(intentId: string) {
      operations.push(`confirmDepositIntent:${intentId}`);
    },
    async settleDepositIntent(intentId: string) {
      operations.push(`settleDepositIntent:${intentId}`);
    },
    async failDepositIntent() {
      throw new Error("successful receipts should not fail");
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
      executionMode: "monitor",
      pollIntervalMs: 10,
      batchLimit: 20,
      requestTimeoutMs: 1000,
      internalApiStartupGracePeriodMs: 45000,
      confirmationBlocks: 3,
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
            "0x6666666666666666666666666666666666666666666666666666666666666666",
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

  assert.deepEqual(operations, []);
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
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
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
    async listConfirmedDepositIntentsReadyToSettle() {
      return { intents: [], limit: 20 };
    },
    async listConfirmedWithdrawalIntentsReadyToSettle() {
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

test("monitor mode warns and skips broadcast intents that are missing a tx hash", async () => {
  const { logger, warnings } = createCapturingLogger();

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
    internalApiClient: {
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return {
          intents: [
            createIntent("deposit_missing_hash_1", {
              status: "broadcast",
              latestBlockchainTransaction: null
            })
          ],
          limit: 20
        };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
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
    },
    rpcClient: {
      async getBlockNumber() {
        throw new Error("missing tx hash should return before block lookup");
      },
      async getTransactionReceipt() {
        throw new Error("missing tx hash should return before receipt lookup");
      }
    },
    depositBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.event, "broadcast_intent_missing_tx_hash");
});

test("monitor mode marks reverted withdrawal receipts as failed", async () => {
  const operations: string[] = [];
  const { logger, warnings } = createCapturingLogger();

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
    internalApiClient: {
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return {
          intents: [
            createIntent("withdrawal_reverted_1", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "btx_reverted_1",
                txHash:
                  "0x7777777777777777777777777777777777777777777777777777777777777777",
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
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent(intentId: string, payload: { failureCode: string }) {
        operations.push(`failWithdrawalIntent:${intentId}:${payload.failureCode}`);
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
    },
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0x7777777777777777777777777777777777777777777777777777777777777777",
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000fed",
          blockNumber: 100n,
          succeeded: false
        };
      }
    },
    depositBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failWithdrawalIntent:withdrawal_reverted_1:onchain_reverted"
  ]);
  assert.equal(warnings[0]?.event, "broadcast_intent_marked_failed");
});

test("monitor mode marks reverted deposit receipts as failed", async () => {
  const operations: string[] = [];

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
    internalApiClient: {
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return {
          intents: [
            createIntent("deposit_reverted_1", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "btx_reverted_deposit_1",
                txHash:
                  "0x9999999999999999999999999999999999999999999999999999999999999999",
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
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent(intentId: string, payload: { failureCode: string }) {
        operations.push(`failDepositIntent:${intentId}:${payload.failureCode}`);
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
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
    },
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0x9999999999999999999999999999999999999999999999999999999999999999",
          fromAddress: "0x000000000000000000000000000000000000dEaD",
          toAddress: "0x0000000000000000000000000000000000000abc",
          blockNumber: 100n,
          succeeded: false
        };
      }
    },
    depositBroadcaster: null,
    logger: createLogger()
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, [
    "failDepositIntent:deposit_reverted_1:onchain_reverted"
  ]);
});

test("monitor mode confirms and settles withdrawal intents with enough confirmations", async () => {
  const operations: string[] = [];

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
    internalApiClient: {
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return {
          intents: [
            createIntent("withdrawal_confirmed_2", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "btx_confirmed_withdrawal_2",
                txHash:
                  "0xabababababababababababababababababababababababababababababababab",
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
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent(intentId: string) {
        operations.push(`confirmWithdrawalIntent:${intentId}`);
      },
      async settleWithdrawalIntent(intentId: string) {
        operations.push(`settleWithdrawalIntent:${intentId}`);
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
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
    },
    rpcClient: {
      async getBlockNumber() {
        return 101n;
      },
      async getTransactionReceipt() {
        return {
          txHash:
            "0xabababababababababababababababababababababababababababababababab",
          fromAddress: "0x0000000000000000000000000000000000000def",
          toAddress: "0x0000000000000000000000000000000000000fed",
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
    "confirmWithdrawalIntent:withdrawal_confirmed_2",
    "settleWithdrawalIntent:withdrawal_confirmed_2"
  ]);
});

test("monitor mode requires an rpc client once broadcast intents need confirmation checks", async () => {
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
    internalApiClient: {
      async listQueuedDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return {
          intents: [
            createIntent("deposit_requires_rpc_1", {
              status: "broadcast",
              latestBlockchainTransaction: {
                id: "btx_requires_rpc_1",
                txHash:
                  "0x8888888888888888888888888888888888888888888888888888888888888888",
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
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
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
    },
    rpcClient: null,
    depositBroadcaster: null,
    logger: createLogger()
  });

  await assert.rejects(() => orchestrator.runOnce(), /RPC client is required/);
});

test("monitor mode logs queued backlog when an external broadcaster is still responsible", async () => {
  const { logger, warnings } = createCapturingLogger();

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
    internalApiClient: {
      async listQueuedDepositIntents() {
        return { intents: [createIntent("deposit_backlog_1")], limit: 20 };
      },
      async listQueuedWithdrawalIntents() {
        return { intents: [createIntent("withdrawal_backlog_1")], limit: 20 };
      },
      async listBroadcastDepositIntents() {
        return { intents: [], limit: 20 };
      },
      async listBroadcastWithdrawalIntents() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
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
    },
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: null,
    logger
  });

  await orchestrator.runOnce();

  assert.equal(warnings.length, 2);
  assert.equal(
    warnings[0]?.event,
    "queued_execution_pending_external_broadcaster"
  );
  assert.equal(
    warnings[1]?.event,
    "queued_execution_pending_external_broadcaster"
  );
});

test("managed mode logs retryable deposit broadcaster failures without marking the intent failed", async () => {
  const operations: string[] = [];
  const { logger, errors } = createCapturingLogger();

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
    internalApiClient: {
      async listQueuedDepositIntents() {
        return { intents: [createIntent("deposit_retryable_1")], limit: 20 };
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
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast(intentId: string) {
        operations.push(`recordDepositBroadcast:${intentId}`);
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent(intentId: string) {
        operations.push(`failDepositIntent:${intentId}`);
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
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
    },
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
        throw new Error("rpc down");
      }
    },
    logger
  });

  await orchestrator.runOnce();

  assert.deepEqual(operations, []);
  assert.equal(errors[0]?.event, "managed_deposit_execution_failed_retryable");
});

test("managed mode requires a deposit broadcaster when queued deposits exist", async () => {
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
    internalApiClient: {
      async listQueuedDepositIntents() {
        return { intents: [createIntent("deposit_missing_broadcaster_1")], limit: 20 };
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
      async listConfirmedDepositIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async listConfirmedWithdrawalIntentsReadyToSettle() {
        return { intents: [], limit: 20 };
      },
      async recordDepositBroadcast() {
        throw new Error("not expected");
      },
      async confirmDepositIntent() {
        throw new Error("not expected");
      },
      async settleDepositIntent() {
        throw new Error("not expected");
      },
      async failDepositIntent() {
        throw new Error("not expected");
      },
      async recordWithdrawalBroadcast() {
        throw new Error("not expected");
      },
      async confirmWithdrawalIntent() {
        throw new Error("not expected");
      },
      async settleWithdrawalIntent() {
        throw new Error("not expected");
      },
      async failWithdrawalIntent() {
        throw new Error("not expected");
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
    },
    rpcClient: {
      async getBlockNumber() {
        return 100n;
      },
      async getTransactionReceipt() {
        return null;
      }
    },
    depositBroadcaster: null,
    logger: createLogger()
  });

  await assert.rejects(
    () => orchestrator.runOnce(),
    /Managed deposit broadcaster is required/
  );
});
