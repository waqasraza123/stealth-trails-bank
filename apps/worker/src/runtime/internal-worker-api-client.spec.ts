import assert from "node:assert/strict";
import test from "node:test";
import {
  createInternalWorkerApiClient,
  InternalApiUnavailableError
} from "./internal-worker-api-client";

test("internal worker api client wraps unavailable upstream errors", async () => {
  const client = createInternalWorkerApiClient({
    environment: "development",
    workerId: "worker-local-1",
    internalApiBaseUrl: "http://localhost:65534",
    internalWorkerApiKey: "local-dev-worker-key",
    executionMode: "synthetic",
    pollIntervalMs: 10,
    batchLimit: 20,
    requestTimeoutMs: 250,
    internalApiStartupGracePeriodMs: 45000,
    confirmationBlocks: 1,
    reconciliationScanIntervalMs: 300000,
    platformAlertReEscalationIntervalMs: 300000,
    rpcUrl: null,
    depositSignerPrivateKey: null
  });

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
