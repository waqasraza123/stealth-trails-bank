import assert from "node:assert/strict";
import test from "node:test";
import { buildManagedDepositTransferPlan } from "./deposit-broadcaster";
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
    externalAddress: "0x0000000000000000000000000000000000000fed",
    chainId: 8453,
    status: "queued",
    requestedAmount: "1.5",
    latestBlockchainTransaction: null,
    ...overrides
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
