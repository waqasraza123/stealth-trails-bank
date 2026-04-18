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
  solvencySnapshotIntervalMs: 300000,
  platformAlertReEscalationIntervalMs: 300000,
  rpcUrl: null,
  depositSignerPrivateKey: null,
  managedWithdrawalClaimTimeoutMs: 60000,
  policyControlledWithdrawalExecutorPrivateKey: null,
  policyControlledWithdrawalPolicySignerPrivateKey: null,
  policyControlledWithdrawalAuthorizationTtlSeconds: 300,
  managedWithdrawalSigners: []
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

      if (
        url.includes("queued") ||
        url.includes("broadcast") ||
        url.includes("confirmed-ready-to-settle")
      ) {
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

      if (url.includes("/loans/internal/worker/agreements/liquidation-candidates")) {
        return Promise.resolve({
          data: {
            status: "success",
            message: "ok",
            data: {
              candidates: [],
              limit: 20
            }
          }
        });
      }

      if (url.includes("/loans/internal/worker/agreements")) {
        return Promise.resolve({
          data: {
            status: "success",
            message: "ok",
            data: {
              agreements: [],
              limit: 20
            }
          }
        });
      }

      if (url.includes("/loans/internal/worker/installments/due")) {
        return Promise.resolve({
          data: {
            status: "success",
            message: "ok",
            data: {
              installments: [],
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

      if (url.includes("/loans/internal/worker/agreements/") && url.endsWith("/run-autopay")) {
        return Promise.resolve({
          data: {
            status: "success",
            message: "ok",
            data: {
              loanAgreementId: "loan_1",
              attempted: true,
              succeeded: true
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
    await client.startManagedWithdrawalExecution("withdrawal_1", {
      reclaimStaleAfterMs: 60000
    });
    await client.recordSignedWithdrawalExecution("withdrawal_1", {
      txHash:
        "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      nonce: 7,
      serializedTransaction: "0xdeadbeef"
    });
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

    await client.listAwaitingFundingLoans(20);
    await client.fundLoanAgreement("loan_1");
    await client.listDueLoanInstallments(20);
    await client.runLoanAutopay("loan_1");
    await client.listValuationMonitorLoans(20);
    await client.refreshLoanValuation("loan_1");
    await client.listGracePeriodExpiredLoans(20);
    await client.escalateLoanDefault("loan_1");
    await client.listLoanLiquidationCandidates(20);

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
        awaitingFundingLoanCount: 0,
        fundedLoanCount: 0,
        dueLoanInstallmentCount: 0,
        autopayLoanSweepCount: 0,
        autopayLoanSuccessCount: 0,
        autopayLoanFailureCount: 0,
        valuationRefreshCandidateCount: 0,
        valuationRefreshCount: 0,
        graceExpiredLoanCount: 0,
        defaultEscalatedLoanCount: 0,
        liquidationCandidateCount: 0,
        reEscalatedCriticalAlertCount: 0
      }
    });
    await client.triggerLedgerReconciliationScan({
      scope: "customer_balance"
    });
    await client.triggerSolvencySnapshot();
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
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/start-execution",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/signed",
        "get:/transaction-intents/internal/worker/withdrawal-requests/broadcast",
        "get:/transaction-intents/internal/worker/withdrawal-requests/confirmed-ready-to-settle",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/broadcast",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/confirm",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/settle",
        "post:/transaction-intents/internal/worker/withdrawal-requests/withdrawal_1/fail",
        "get:/loans/internal/worker/agreements/awaiting-funding",
        "post:/loans/internal/worker/agreements/loan_1/fund",
        "get:/loans/internal/worker/installments/due",
        "post:/loans/internal/worker/agreements/loan_1/run-autopay",
        "get:/loans/internal/worker/agreements/valuation-monitor",
        "post:/loans/internal/worker/agreements/loan_1/refresh-valuation",
        "get:/loans/internal/worker/agreements/grace-period-expired",
        "post:/loans/internal/worker/agreements/loan_1/escalate-default",
        "get:/loans/internal/worker/agreements/liquidation-candidates",
        "post:/operations/internal/worker/heartbeat",
        "post:/ledger/internal/worker/reconciliation/scan",
        "post:/solvency/internal/worker/snapshots/run",
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

test("internal worker api client normalizes non-refused retryable availability errors", async () => {
  const originalCreate = axios.create;
  const timeoutError = new axios.AxiosError("timeout", "ETIMEDOUT");
  const fakeHttpClient = {
    get() {
      return Promise.reject(timeoutError);
    }
  };

  axios.create = (() => fakeHttpClient as never) as unknown as typeof axios.create;

  try {
    const client = createInternalWorkerApiClient(runtime);

    await assert.rejects(
      () => client.listQueuedDepositIntents(1),
      (error: unknown) => {
        assert.ok(error instanceof InternalApiUnavailableError);
        assert.equal(error.code, "ETIMEDOUT");
        assert.match(error.message, /temporarily unavailable/);
        return true;
      }
    );
  } finally {
    axios.create = originalCreate;
  }
});

test("internal worker api client preserves direct errors and wraps non-error failures", async () => {
  const originalCreate = axios.create;

  axios.create = (() =>
    ({
      get() {
        return Promise.reject(new Error("plain failure"));
      }
    }) as never) as unknown as typeof axios.create;

  try {
    const client = createInternalWorkerApiClient(runtime);

    await assert.rejects(() => client.listQueuedDepositIntents(1), /plain failure/);
  } finally {
    axios.create = originalCreate;
  }

  axios.create = (() =>
    ({
      get() {
        return Promise.reject("boom");
      }
    }) as never) as unknown as typeof axios.create;

  try {
    const client = createInternalWorkerApiClient(runtime);

    await assert.rejects(
      () => client.listQueuedDepositIntents(1),
      /Internal API request failed/
    );
  } finally {
    axios.create = originalCreate;
  }
});

test("internal worker api client preserves agreement-shaped liquidation candidate responses", async () => {
  const originalCreate = axios.create;
  const fakeHttpClient = {
    get(url: string) {
      if (url === "/loans/internal/worker/agreements/liquidation-candidates") {
        return Promise.resolve({
          data: {
            status: "success",
            message: "ok",
            data: {
              agreements: [
                {
                  loanAgreementId: "loan_1",
                  customerEmail: "client@example.com",
                  status: "active",
                  collateralStatus: "healthy"
                }
              ],
              limit: 5
            }
          }
        });
      }

      return Promise.resolve({
        data: {
          status: "success",
          message: "ok",
          data: {
            agreements: [],
            limit: 20
          }
        }
      });
    }
  };

  axios.create = (() => fakeHttpClient as never) as unknown as typeof axios.create;

  try {
    const client = createInternalWorkerApiClient(runtime);
    const result = await client.listLoanLiquidationCandidates(5);

    assert.deepEqual(result, {
      agreements: [
        {
          loanAgreementId: "loan_1",
          customerEmail: "client@example.com",
          status: "active",
          collateralStatus: "healthy"
        }
      ],
      limit: 5
    });
  } finally {
    axios.create = originalCreate;
  }
});
