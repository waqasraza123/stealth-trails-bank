import assert from "node:assert/strict";
import test from "node:test";
import { loadWorkerRuntimeConfig } from "@stealth-trails-bank/config/api";

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
  assert.equal(runtime.depositSignerPrivateKey, null);
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
