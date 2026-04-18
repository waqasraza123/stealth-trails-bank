import assert from "node:assert/strict";
import test from "node:test";
import { ethers } from "ethers";
import {
  buildManagedDepositTransferPlan,
  createManagedDepositBroadcaster
} from "./deposit-broadcaster";
import type { WorkerIntentProjection } from "./worker-types";

function createIntent(
  overrides: Partial<WorkerIntentProjection> = {}
): WorkerIntentProjection {
  return {
    id: "intent_1",
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
    sourceWalletCustodyType: "platform_managed",
    externalAddress: "0x0000000000000000000000000000000000000fed",
    chainId: 8453,
    status: "queued",
    requestedAmount: "1.5",
    latestBlockchainTransaction: null,
    ...overrides
  };
}

function createManagedRuntime() {
  return {
    environment: "production" as const,
    workerId: "worker_1",
    internalApiBaseUrl: "http://localhost:9001",
    internalWorkerApiKey: "worker-key",
    executionMode: "managed" as const,
    pollIntervalMs: 10,
    batchLimit: 20,
    requestTimeoutMs: 1000,
    internalApiStartupGracePeriodMs: 45000,
    confirmationBlocks: 2,
    reconciliationScanIntervalMs: 300000,
    solvencySnapshotIntervalMs: 300000,
    platformAlertReEscalationIntervalMs: 300000,
    rpcUrl: "https://rpc.example.com",
    managedWithdrawalClaimTimeoutMs: 60000,
    policyControlledWithdrawalExecutorPrivateKey: null,
    policyControlledWithdrawalPolicySignerPrivateKey: null,
    policyControlledWithdrawalAuthorizationTtlSeconds: 300,
    managedWithdrawalSigners: [],
    depositSignerPrivateKey:
      "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
  };
}

function withManagedWithdrawalDefaults<T extends Record<string, unknown>>(
  runtime: T
): T & {
  solvencySnapshotIntervalMs: number;
  managedWithdrawalClaimTimeoutMs: number;
  policyControlledWithdrawalExecutorPrivateKey: null;
  policyControlledWithdrawalPolicySignerPrivateKey: null;
  policyControlledWithdrawalAuthorizationTtlSeconds: number;
  managedWithdrawalSigners: [];
} {
  return {
    solvencySnapshotIntervalMs: 300000,
    managedWithdrawalClaimTimeoutMs: 60000,
    policyControlledWithdrawalExecutorPrivateKey: null,
    policyControlledWithdrawalPolicySignerPrivateKey: null,
    policyControlledWithdrawalAuthorizationTtlSeconds: 300,
    managedWithdrawalSigners: [],
    ...runtime
  };
}

test("buildManagedDepositTransferPlan creates native transfer plans", () => {
  const plan = buildManagedDepositTransferPlan(createIntent());

  assert.equal(plan.kind, "native");
  assert.equal(plan.toAddress, "0x0000000000000000000000000000000000000abc");
  assert.equal(plan.txToAddress, "0x0000000000000000000000000000000000000abc");
  assert.equal(plan.value.toString(), "1500000000000000000");
});

test("buildManagedDepositTransferPlan creates erc20 transfer plans", () => {
  const plan = buildManagedDepositTransferPlan(
    createIntent({
      asset: {
        id: "asset_2",
        symbol: "USDC",
        displayName: "USD Coin",
        decimals: 6,
        chainId: 8453,
        assetType: "erc20",
        contractAddress: "0x0000000000000000000000000000000000000ccc"
      },
      requestedAmount: "25.125"
    })
  );

  assert.equal(plan.kind, "erc20");
  assert.equal(
    plan.contractAddress,
    "0x0000000000000000000000000000000000000ccc"
  );
  assert.equal(
    plan.destinationAddress,
    "0x0000000000000000000000000000000000000abc"
  );
  assert.equal(plan.amount.toString(), "25125000");
  assert.equal(
    plan.txToAddress,
    "0x0000000000000000000000000000000000000ccc"
  );
});

test("buildManagedDepositTransferPlan rejects malformed intents", () => {
  assert.throws(
    () =>
      buildManagedDepositTransferPlan(
        createIntent({
          destinationWalletAddress: null
        })
      ),
    /missing a destination wallet/
  );
});

test("buildManagedDepositTransferPlan rejects invalid amounts, missing ERC-20 contracts, and unsupported asset types", () => {
  assert.throws(
    () =>
      buildManagedDepositTransferPlan(
        createIntent({
          requestedAmount: "not-a-decimal"
        })
      ),
    /amount is invalid/
  );

  assert.throws(
    () =>
      buildManagedDepositTransferPlan(
        createIntent({
          asset: {
            id: "asset_2",
            symbol: "USDC",
            displayName: "USD Coin",
            decimals: 6,
            chainId: 8453,
            assetType: "erc20",
            contractAddress: null
          }
        })
      ),
    /contract address is missing/
  );

  assert.throws(
    () =>
      buildManagedDepositTransferPlan(
        createIntent({
          asset: {
            id: "asset_3",
            symbol: "NFT",
            displayName: "Unsupported Asset",
            decimals: 18,
            chainId: 8453,
            assetType: "unsupported" as never,
            contractAddress: null
          },
          requestedAmount: "1"
        })
      ),
    /not supported by the managed worker broadcaster/
  );
});

test("createManagedDepositBroadcaster rejects runtimes that are not managed", () => {
  assert.throws(
    () =>
      createManagedDepositBroadcaster(withManagedWithdrawalDefaults({
        environment: "development",
        workerId: "worker_1",
        internalApiBaseUrl: "http://localhost:9001",
        internalWorkerApiKey: "worker-key",
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
      })),
    /WORKER_EXECUTION_MODE=managed/
  );
});

test("createManagedDepositBroadcaster requires rpc and signer configuration in managed mode", () => {
  assert.throws(
    () =>
      createManagedDepositBroadcaster(withManagedWithdrawalDefaults({
        environment: "production",
        workerId: "worker_1",
        internalApiBaseUrl: "http://localhost:9001",
        internalWorkerApiKey: "worker-key",
        executionMode: "managed",
        pollIntervalMs: 10,
        batchLimit: 20,
        requestTimeoutMs: 1000,
        internalApiStartupGracePeriodMs: 45000,
        confirmationBlocks: 2,
        reconciliationScanIntervalMs: 300000,
        platformAlertReEscalationIntervalMs: 300000,
        rpcUrl: null,
        depositSignerPrivateKey: null
      })),
    /RPC_URL is required/
  );

  assert.throws(
    () =>
      createManagedDepositBroadcaster(withManagedWithdrawalDefaults({
        environment: "production",
        workerId: "worker_1",
        internalApiBaseUrl: "http://localhost:9001",
        internalWorkerApiKey: "worker-key",
        executionMode: "managed",
        pollIntervalMs: 10,
        batchLimit: 20,
        requestTimeoutMs: 1000,
        internalApiStartupGracePeriodMs: 45000,
        confirmationBlocks: 2,
        reconciliationScanIntervalMs: 300000,
        platformAlertReEscalationIntervalMs: 300000,
        rpcUrl: "https://rpc.example.com",
        depositSignerPrivateKey: null
      })),
    /WORKER_DEPOSIT_SIGNER_PRIVATE_KEY is required/
  );
});

test("createManagedDepositBroadcaster broadcasts native transfers with the configured signer", async () => {
  const originalSendTransaction = ethers.Wallet.prototype.sendTransaction;
  const sendCalls: Array<{ to: string; value: string }> = [];

  ethers.Wallet.prototype.sendTransaction = async function ({
    to,
    value
  }: {
    to?: string;
    value?: ethers.BigNumberish;
  }) {
    sendCalls.push({
      to: to ?? "",
      value: value ? ethers.BigNumber.from(value).toString() : "0"
    });

    return {
      hash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    } as ethers.providers.TransactionResponse;
  };

  try {
    const broadcaster = createManagedDepositBroadcaster(createManagedRuntime());
    const result = await broadcaster.broadcast(createIntent());

    assert.equal(sendCalls.length, 1);
    assert.deepEqual(sendCalls[0], {
      to: "0x0000000000000000000000000000000000000abc",
      value: "1500000000000000000"
    });
    assert.equal(
      result.txHash,
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    assert.equal(
      result.toAddress,
      "0x0000000000000000000000000000000000000abc"
    );
    assert.match(result.fromAddress, /^0x[a-fA-F0-9]{40}$/);
  } finally {
    ethers.Wallet.prototype.sendTransaction = originalSendTransaction;
  }
});

test("createManagedDepositBroadcaster normalizes broadcast failures into deterministic errors", async () => {
  const originalSendTransaction = ethers.Wallet.prototype.sendTransaction;
  const failureCases: Array<{ thrown: unknown; expectedMessage: RegExp }> = [
    { thrown: new Error("rpc down"), expectedMessage: /rpc down/ },
    { thrown: "string failure", expectedMessage: /string failure/ },
    { thrown: { message: "object failure" }, expectedMessage: /object failure/ },
    { thrown: { reason: "unknown" }, expectedMessage: /Unknown broadcast error/ }
  ];

  try {
    for (const failureCase of failureCases) {
      ethers.Wallet.prototype.sendTransaction = async function () {
        throw failureCase.thrown;
      };

      const broadcaster = createManagedDepositBroadcaster(createManagedRuntime());

      await assert.rejects(
        () => broadcaster.broadcast(createIntent()),
        failureCase.expectedMessage
      );
    }
  } finally {
    ethers.Wallet.prototype.sendTransaction = originalSendTransaction;
  }
});
