import axios, { type AxiosInstance } from "axios";
import { buildInternalWorkerHeaders } from "@stealth-trails-bank/security";
import type { WorkerRuntime } from "./worker-runtime";
import type {
  ConfirmIntentPayload,
  CriticalAlertReEscalationSweepResult,
  FailIntentPayload,
  ListIntentsResult,
  ListWorkerLoanAgreementsResult,
  ListWorkerLoanInstallmentsResult,
  RecordBroadcastPayload,
  SettleIntentPayload,
  TrackedLedgerReconciliationScanResult,
  WorkerHeartbeatPayload
} from "./worker-types";

type ApiEnvelope<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

const RETRYABLE_INTERNAL_API_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNABORTED"
]);

export class InternalApiUnavailableError extends Error {
  readonly code: string | null;
  readonly baseUrl: string;

  constructor(args: {
    baseUrl: string;
    code: string | null;
    message: string;
    cause: unknown;
  }) {
    super(args.message, {
      cause: args.cause
    });
    this.name = "InternalApiUnavailableError";
    this.code = args.code;
    this.baseUrl = args.baseUrl;
  }
}

function normalizeInternalApiError(baseUrl: string, error: unknown): Error {
  if (
    axios.isAxiosError(error) &&
    !error.response &&
    RETRYABLE_INTERNAL_API_ERROR_CODES.has(error.code ?? "")
  ) {
    return new InternalApiUnavailableError({
      baseUrl,
      code: error.code ?? null,
      message:
        error.code === "ECONNREFUSED"
          ? `Internal API is not accepting connections at ${baseUrl}.`
          : `Internal API is temporarily unavailable at ${baseUrl}.`,
      cause: error
    });
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("Internal API request failed.");
}

async function readResponseData<T>(
  promise: Promise<{ data: ApiEnvelope<T> }>,
  baseUrl: string
): Promise<T> {
  let response: { data: ApiEnvelope<T> };

  try {
    response = await promise;
  } catch (error) {
    throw normalizeInternalApiError(baseUrl, error);
  }

  if (response.data.status !== "success" || !response.data.data) {
    throw new Error(response.data.message || "Internal API request failed.");
  }

  return response.data.data;
}

export type InternalWorkerApiClient = ReturnType<
  typeof createInternalWorkerApiClient
>;

export function createInternalWorkerApiClient(runtime: WorkerRuntime) {
  const httpClient: AxiosInstance = axios.create({
    baseURL: runtime.internalApiBaseUrl,
    timeout: runtime.requestTimeoutMs,
    headers: buildInternalWorkerHeaders({
      apiKey: runtime.internalWorkerApiKey,
      workerId: runtime.workerId
    })
  });
  const baseUrl = runtime.internalApiBaseUrl;

  return {
    async listQueuedDepositIntents(limit: number): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/deposit-requests/queued",
          {
            params: { limit }
          }
        ),
        baseUrl
      );
    },

    async listBroadcastDepositIntents(limit: number): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/deposit-requests/broadcast",
          {
            params: { limit }
          }
        ),
        baseUrl
      );
    },

    async listConfirmedDepositIntentsReadyToSettle(
      limit: number
    ): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/deposit-requests/confirmed-ready-to-settle",
          {
            params: { limit }
          }
        ),
        baseUrl
      );
    },

    async recordDepositBroadcast(
      intentId: string,
      payload: RecordBroadcastPayload
    ): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ intentId: string }>>(
          `/transaction-intents/internal/worker/deposit-requests/${intentId}/broadcast`,
          payload
        ),
        baseUrl
      );
    },

    async confirmDepositIntent(
      intentId: string,
      payload: ConfirmIntentPayload
    ): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ intentId: string }>>(
          `/transaction-intents/internal/worker/deposit-requests/${intentId}/confirm`,
          payload
        ),
        baseUrl
      );
    },

    async settleDepositIntent(
      intentId: string,
      payload: SettleIntentPayload
    ): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ intentId: string }>>(
          `/transaction-intents/internal/worker/deposit-requests/${intentId}/settle`,
          payload
        ),
        baseUrl
      );
    },

    async failDepositIntent(
      intentId: string,
      payload: FailIntentPayload
    ): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ intentId: string }>>(
          `/transaction-intents/internal/worker/deposit-requests/${intentId}/fail`,
          payload
        ),
        baseUrl
      );
    },

    async listQueuedWithdrawalIntents(limit: number): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/withdrawal-requests/queued",
          {
            params: { limit }
          }
        ),
        baseUrl
      );
    },

    async listAwaitingFundingLoans(
      limit: number
    ): Promise<ListWorkerLoanAgreementsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListWorkerLoanAgreementsResult>>(
          "/loans/internal/worker/agreements/awaiting-funding",
          { params: { limit } }
        ),
        baseUrl
      );
    },

    async fundLoanAgreement(loanAgreementId: string): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ loanAgreementId: string }>>(
          `/loans/internal/worker/agreements/${loanAgreementId}/fund`
        ),
        baseUrl
      );
    },

    async listDueLoanInstallments(
      limit: number
    ): Promise<ListWorkerLoanInstallmentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListWorkerLoanInstallmentsResult>>(
          "/loans/internal/worker/installments/due",
          { params: { limit } }
        ),
        baseUrl
      );
    },

    async runLoanAutopay(
      loanAgreementId: string
    ): Promise<{ loanAgreementId: string; attempted: boolean; succeeded?: boolean }> {
      return readResponseData(
        httpClient.post<
          ApiEnvelope<{ loanAgreementId: string; attempted: boolean; succeeded?: boolean }>
        >(`/loans/internal/worker/agreements/${loanAgreementId}/run-autopay`),
        baseUrl
      );
    },

    async listValuationMonitorLoans(
      limit: number
    ): Promise<ListWorkerLoanAgreementsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListWorkerLoanAgreementsResult>>(
          "/loans/internal/worker/agreements/valuation-monitor",
          { params: { limit } }
        ),
        baseUrl
      );
    },

    async refreshLoanValuation(loanAgreementId: string): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ loanAgreementId: string }>>(
          `/loans/internal/worker/agreements/${loanAgreementId}/refresh-valuation`
        ),
        baseUrl
      );
    },

    async listGracePeriodExpiredLoans(
      limit: number
    ): Promise<ListWorkerLoanAgreementsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListWorkerLoanAgreementsResult>>(
          "/loans/internal/worker/agreements/grace-period-expired",
          { params: { limit } }
        ),
        baseUrl
      );
    },

    async escalateLoanDefault(loanAgreementId: string): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ loanAgreementId: string }>>(
          `/loans/internal/worker/agreements/${loanAgreementId}/escalate-default`
        ),
        baseUrl
      );
    },

    async listLoanLiquidationCandidates(
      limit: number
    ): Promise<ListWorkerLoanAgreementsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListWorkerLoanAgreementsResult>>(
          "/loans/internal/worker/agreements/liquidation-candidates",
          { params: { limit } }
        ),
        baseUrl
      );
    },

    async listBroadcastWithdrawalIntents(
      limit: number
    ): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/withdrawal-requests/broadcast",
          {
            params: { limit }
          }
        ),
        baseUrl
      );
    },

    async listConfirmedWithdrawalIntentsReadyToSettle(
      limit: number
    ): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/withdrawal-requests/confirmed-ready-to-settle",
          {
            params: { limit }
          }
        ),
        baseUrl
      );
    },

    async recordWithdrawalBroadcast(
      intentId: string,
      payload: RecordBroadcastPayload
    ): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ intentId: string }>>(
          `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/broadcast`,
          payload
        ),
        baseUrl
      );
    },

    async confirmWithdrawalIntent(
      intentId: string,
      payload: ConfirmIntentPayload
    ): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ intentId: string }>>(
          `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/confirm`,
          payload
        ),
        baseUrl
      );
    },

    async settleWithdrawalIntent(
      intentId: string,
      payload: SettleIntentPayload
    ): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ intentId: string }>>(
          `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/settle`,
          payload
        ),
        baseUrl
      );
    },

    async failWithdrawalIntent(
      intentId: string,
      payload: FailIntentPayload
    ): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ intentId: string }>>(
          `/transaction-intents/internal/worker/withdrawal-requests/${intentId}/fail`,
          payload
        ),
        baseUrl
      );
    },

    async reportWorkerHeartbeat(payload: WorkerHeartbeatPayload): Promise<void> {
      await readResponseData(
        httpClient.post<ApiEnvelope<{ workerId: string }>>(
          "/operations/internal/worker/heartbeat",
          payload
        ),
        baseUrl
      );
    },

    async triggerLedgerReconciliationScan(
      payload: Record<string, string | number | undefined>
    ): Promise<TrackedLedgerReconciliationScanResult> {
      return readResponseData(
        httpClient.post<ApiEnvelope<TrackedLedgerReconciliationScanResult>>(
          "/ledger/internal/worker/reconciliation/scan",
          payload
        ),
        baseUrl
      );
    },

    async triggerCriticalAlertReEscalationSweep(
      payload: Record<string, string | number | undefined> = {}
    ): Promise<CriticalAlertReEscalationSweepResult> {
      return readResponseData(
        httpClient.post<ApiEnvelope<CriticalAlertReEscalationSweepResult>>(
          "/operations/internal/worker/alerts/re-escalate-critical",
          payload
        ),
        baseUrl
      );
    }
  };
}
