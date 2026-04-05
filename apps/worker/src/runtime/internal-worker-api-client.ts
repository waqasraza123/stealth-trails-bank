import axios, { type AxiosInstance } from "axios";
import type { WorkerRuntime } from "./worker-runtime";
import type {
  ConfirmIntentPayload,
  FailIntentPayload,
  ListIntentsResult,
  RecordBroadcastPayload,
  SettleIntentPayload
} from "./worker-types";

type ApiEnvelope<T> = {
  status: "success" | "failed";
  message: string;
  data?: T;
};

async function readResponseData<T>(
  promise: Promise<{ data: ApiEnvelope<T> }>
): Promise<T> {
  const response = await promise;

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
    headers: {
      "x-worker-api-key": runtime.internalWorkerApiKey,
      "x-worker-id": runtime.workerId
    }
  });

  return {
    async listQueuedDepositIntents(limit: number): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/deposit-requests/queued",
          {
            params: { limit }
          }
        )
      );
    },

    async listBroadcastDepositIntents(limit: number): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/deposit-requests/broadcast",
          {
            params: { limit }
          }
        )
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
        )
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
        )
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
        )
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
        )
      );
    },

    async listQueuedWithdrawalIntents(limit: number): Promise<ListIntentsResult> {
      return readResponseData(
        httpClient.get<ApiEnvelope<ListIntentsResult>>(
          "/transaction-intents/internal/worker/withdrawal-requests/queued",
          {
            params: { limit }
          }
        )
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
        )
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
        )
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
        )
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
        )
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
        )
      );
    }
  };
}
