import assert from "node:assert/strict";
import test from "node:test";
import axios from "axios";
import {
  createInternalWorkerApiClient,
  InternalApiUnavailableError
} from "./internal-worker-api-client";

const runtime = {
  environment: "development" as const,
  workerId: "worker-local-1",
  internalApiBaseUrl: "http://localhost:65534",
  internalWorkerApiKey: "local-dev-worker-key",
  executionMode: "synthetic" as const,
  pollIntervalMs: 10,
  batchLimit: 20,
  requestTimeoutMs: 250,
  internalApiStartupGracePeriodMs: 45000,
  confirmationBlocks: 1,
  reconciliationScanIntervalMs: 300000,
  platformAlertReEscalationIntervalMs: 300000,
  rpcUrl: null,
  depositSignerPrivateKey: null
};

test("internal worker api client wraps unavailable upstream errors", async () => {
  const client = createInternalWorkerApiClient(runtime);

  await assert.rejects(
    () => client.listQueuedDepositIntents(1),
    (error: unknown) => {
      assert.ok(error instanceof InternalApiUnavailableError);
      assert.equal(error.baseUrl, "http://localhost:65534");
      assert.equal(error.code, "ECONNREFUSED");
      return true;
    }
  );
});

test("internal worker api client issues every worker request against the expected internal endpoints", async () => {
  const calls: Array<{
    method: "get" | "post";
    url: string;
    payload?: unknown;
    params?: unknown;
  }> = [];
  const originalCreate = axios.create;
  const fakeHttpClient = {
    get(url: string, options?: { params?: unknown }) {
      calls.push({
        method: "get",
        url,
        params: options?.params
      });

      if (url.includes("queued") || url.includes("broadcast") || url.includes("confirmed-ready-to-settle")) {
        return Promise.resolve({
          data: {
            status: "success",
            message: "ok",
            data: {
              intents: [],
              limit: 20
            }
          }
        });
      }

      return Promise.resolve({
        data: {
          status: "success",
          message: "ok",
          data: {}
        }
      });
    },
    post(url: string, payload?: unknown) {
      calls.push({
        method: "post",
        url,
        payload
      });

      if (url === "/ledger/internal/worker/reconciliation/scan") {
        return Promise.resolve({
          data: {
            status: "success",
            message: "ok",
            data: {
              scanRun: {
                id: "scan_1"
              },
              result: {
                activeMismatchCount: 0
              }
            }
          }
        });
      }

      if (url === "/operations/internal/worker/alerts/re-escalate-critical") {
        return Promise.resolve({
          data: {
            status: "success",
            message: "ok",
            data: {
              count: 0
            }
          }
        });
      }

      return Promise.resolve({
        data: {
          status: "success",
          message: "ok",
          data: {
            acknowledged: true
          }
        }
      });
    }
  };

  axios.create = (() => fakeHttpClient as never) as unknown as typeof axios.create;

  try {
    const client = createInternalWorkerApiClient(runtime);

    await client.listQueuedDepositIntents(20);
    await client.listBroadcastDepositIntents(20);
    await client.listConfirmedDepositIntentsReadyToSettle(20);
    await client.recordDepositBroadcast("deposit_1", {
      txHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    });
    await client.confirmDepositIntent("deposit_1", {
      txHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    });
    await client.settleDepositIntent("deposit_1", {
      note: "settled"
    });
    await client.failDepositIntent("deposit_1", {
      failureCode: "onchain_reverted",
      failureReason: "reverted"
    });

    await client.listQueuedWithdrawalIntents(20);
    await client.listBroadcastWithdrawalIntents(20);
    await client.listConfirmedWithdrawalIntentsReadyToSettle(20);
    await client.recordWithdrawalBroadcast("withdrawal_1", {
      txHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    });
    await client.confirmWithdrawalIntent("withdrawal_1", {
      txHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    });
    await client.settleWithdrawalIntent("withdrawal_1", {
      note: "settled"
    });
    await client.failWithdrawalIntent("withdrawal_1", {
      failureCode: "onchain_reverted",
      failureReason: "reverted"
    });

    await client.reportWorkerHeartbeat({
      environment: "development",
      executionMode: "synthetic",
      lastIterationStatus: "succeeded",
      latestIterationMetrics: {
        queuedDepositCount: 0,
        queuedWithdrawalCount: 0,
        broadcastDepositCount: 0,
        broadcastWithdrawalCount: 0,
        confirmedDepositReadyToSettleCount: 0,
        confirmedWithdrawalReadyToSettleCount: 0,
        depositBroadcastRecordedCount: 0,
        withdrawalBroadcastRecordedCount: 0,
        depositConfirmedCount: 0,
        withdrawalConfirmedCount: 0,
        depositSettledCount: 0,
        withdrawalSettledCount: 0,
        depositFailedCount: 0,
        withdrawalFailedCount: 0,
        manualWithdrawalBacklogCount: 0,
        reEscalatedCriticalAlertCount: 0
      }
    });
    await client.triggerLedgerReconciliationScan({
      scope: "customer_balance"
    });
    await client.triggerCriticalAlertReEscalationSweep({
      limit: 10
    });

    assert.deepEqual(
      calls.map((call) => `${call.method}:${call.url}`),
      [
        "get:/transaction-intents/internal/worker/deposit-requests/queued",
        "get:/transaction-intents/internal/worker/deposit-requests/broadcast",
        "get:/transaction-intents/internal/worker/deposit-requests/confirmed-ready-to-settle",
        "post:/transaction-intents/internal/worker/deposit-requests/deposit_1/broadcast",
        "post:/transaction-intents/internal/worker/deposit-requests/deposit_1/confirm",
        "post:/transaction-intents/internal/worker/deposit-requests/deposit_1/settle",
        "post:/transaction-intents/internal/worker/deposit-requests/deposit_1/fail",
        "get:/transaction-intents/internal/worker/withdrawal-requests/queued",
        "get:/transaction-intents/internal/worker/withdrawal-requests/broadcast",
        "get:/transaction-intents/internal/worker/withdrawal-requests/confirmed-ready-to-settle",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/broadcast",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/confirm",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/settle",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/fail",
        "post:/operations/internal/worker/heartbeat",
        "post:/ledger/internal/worker/reconciliation/scan",
        "post:/operations/internal/worker/alerts/re-escalate-critical"
      ]
    );
  } finally {
    axios.create = originalCreate;
  }
});

test("internal worker api client rejects failed envelopes from the internal api", async () => {
  const originalCreate = axios.create;
  const fakeHttpClient = {
    get() {
      return Promise.resolve({
        data: {
          status: "failed",
          message: "upstream rejected"
        }
      });
    }
  };

  axios.create = (() => fakeHttpClient as never) as unknown as typeof axios.create;

  try {
    const client = createInternalWorkerApiClient(runtime);

    await assert.rejects(
      () => client.listQueuedDepositIntents(1),
      /upstream rejected/
    );
  } finally {
    axios.create = originalCreate;
  }
});
