import { expect, test, type Page, type Route } from "@playwright/test";

function successResponse(data: unknown, message = "ok") {
  return {
    status: "success",
    message,
    data
  };
}

async function fulfillJson(route: Route, data: unknown, message?: string) {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(successResponse(data, message))
  });
}

async function mockWebApi(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (pathname.endsWith("/auth/login") && request.method() === "POST") {
      return fulfillJson(route, {
        token: "test-token",
        user: {
          id: 1,
          firstName: "Amina",
          lastName: "Rahman",
          email: "amina@example.com",
          supabaseUserId: "supabase_1",
          ethereumAddress: "0x1111222233334444555566667777888899990000"
        }
      });
    }

    if (pathname.endsWith("/assets/supported")) {
      return fulfillJson(route, {
        assets: [
          {
            id: "asset_eth",
            symbol: "ETH",
            displayName: "Ether",
            decimals: 18,
            chainId: 1,
            assetType: "native",
            contractAddress: null
          },
          {
            id: "asset_usdc",
            symbol: "USDC",
            displayName: "USD Coin",
            decimals: 6,
            chainId: 1,
            assetType: "erc20",
            contractAddress: "0x0000000000000000000000000000000000000abc"
          }
        ]
      });
    }

    if (pathname.endsWith("/balances/me")) {
      return fulfillJson(route, {
        customerAccountId: "account_1",
        balances: [
          {
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            availableBalance: "2.5",
            pendingBalance: "0",
            updatedAt: "2026-04-05T10:00:00.000Z"
          },
          {
            asset: {
              id: "asset_usdc",
              symbol: "USDC",
              displayName: "USD Coin",
              decimals: 6,
              chainId: 1
            },
            availableBalance: "100",
            pendingBalance: "10",
            updatedAt: "2026-04-05T10:00:00.000Z"
          }
        ]
      });
    }

    if (pathname.endsWith("/transaction-intents/me/history")) {
      return fulfillJson(route, {
        limit: 100,
        intents: [
          {
            id: "intent_1",
            asset: {
              id: "asset_eth",
              symbol: "ETH",
              displayName: "Ether",
              decimals: 18,
              chainId: 1
            },
            sourceWalletAddress: null,
            destinationWalletAddress: "0x1111222233334444555566667777888899990000",
            externalAddress: null,
            intentType: "deposit",
            status: "requested",
            policyDecision: "pending",
            requestedAmount: "1.25",
            settledAmount: null,
            failureCode: null,
            failureReason: null,
            createdAt: "2026-04-05T10:30:00.000Z",
            updatedAt: "2026-04-05T10:30:00.000Z",
            latestBlockchainTransaction: null
          },
          {
            id: "intent_2",
            asset: {
              id: "asset_usdc",
              symbol: "USDC",
              displayName: "USD Coin",
              decimals: 6,
              chainId: 1
            },
            sourceWalletAddress: "0x1111222233334444555566667777888899990000",
            destinationWalletAddress: null,
            externalAddress: "0x0000000000000000000000000000000000000fed",
            intentType: "withdrawal",
            status: "settled",
            policyDecision: "approved",
            requestedAmount: "10",
            settledAmount: "10",
            failureCode: null,
            failureReason: null,
            createdAt: "2026-04-06T10:30:00.000Z",
            updatedAt: "2026-04-06T10:35:00.000Z",
            latestBlockchainTransaction: null
          }
        ]
      });
    }

    if (
      pathname.endsWith("/transaction-intents/deposit-requests") &&
      request.method() === "POST"
    ) {
      return fulfillJson(route, {
        idempotencyReused: false,
        intent: {
          id: "intent_deposit_1",
          customerAccountId: "account_1",
          asset: {
            id: "asset_eth",
            symbol: "ETH",
            displayName: "Ether",
            decimals: 18,
            chainId: 1
          },
          destinationWalletAddress: "0x1111222233334444555566667777888899990000",
          intentType: "deposit",
          status: "requested",
          policyDecision: "pending",
          requestedAmount: "1.25",
          createdAt: "2026-04-05T10:00:00.000Z",
          updatedAt: "2026-04-05T10:00:00.000Z"
        }
      });
    }

    if (
      pathname.endsWith("/transaction-intents/withdrawal-requests") &&
      request.method() === "POST"
    ) {
      return fulfillJson(route, {
        idempotencyReused: false,
        intent: {
          id: "intent_withdrawal_1",
          customerAccountId: "account_1",
          asset: {
            id: "asset_usdc",
            symbol: "USDC",
            displayName: "USD Coin",
            decimals: 6,
            chainId: 1
          },
          sourceWalletAddress: "0x1111222233334444555566667777888899990000",
          externalAddress: "0x0000000000000000000000000000000000000abc",
          intentType: "withdrawal",
          status: "requested",
          policyDecision: "pending",
          requestedAmount: "25",
          createdAt: "2026-04-05T10:00:00.000Z",
          updatedAt: "2026-04-05T10:00:00.000Z"
        }
      });
    }

    if (pathname.endsWith("/staking/me/snapshot")) {
      return fulfillJson(route, {
        walletAddress: "0x1111222233334444555566667777888899990000",
        accountStatus: "active",
        walletStatus: "active",
        walletCustodyType: "platform_managed",
        readModel: {
          available: true,
          message: "Live reads are available."
        },
        execution: {
          available: false,
          reasonCode: "signer_wallet_mismatch",
          message:
            "Customer staking execution is disabled because contract positions are keyed by the signing wallet, and the configured signer does not match this customer's managed wallet."
        },
        pools: [
          {
            id: 11,
            blockchainPoolId: 1001,
            rewardRate: 4.8,
            totalStakedAmount: "32.5",
            totalRewardsPaid: "1.25",
            poolStatus: "active",
            createdAt: "2026-04-05T10:00:00.000Z",
            updatedAt: "2026-04-05T11:00:00.000Z",
            position: {
              stakedBalance: "1.5",
              pendingReward: "0.25",
              canReadPosition: true
            }
          }
        ]
      });
    }

    return route.fallback();
  });
}

async function seedCustomerSession(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "user-storage",
      JSON.stringify({
        state: {
          token: "test-token",
          user: {
            id: 1,
            firstName: "Amina",
            lastName: "Rahman",
            email: "amina@example.com",
            supabaseUserId: "supabase_1",
            ethereumAddress: "0x1111222233334444555566667777888899990000"
          }
        },
        version: 0
      })
    );
  });
}

test("sign-in switches to Arabic and persists rtl state after reload", async ({
  page
}) => {
  await mockWebApi(page);

  await page.goto("/auth/sign-in");
  await page.getByRole("button", { name: "العربية" }).click();

  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByLabel("البريد الإلكتروني")).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
});

test("authenticated wallet, transactions, and staking flows enforce validation and policy gating", async ({
  page
}) => {
  await seedCustomerSession(page);
  await mockWebApi(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto("/wallet");
  await expect(
    page.getByRole("heading", { name: "Managed Wallet Operations" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Deposit Request" })
  ).toBeEnabled();

  await page.locator("#deposit-amount").fill("abc");
  await page.getByRole("button", { name: "Create Deposit Request" }).click();
  await expect(
    page.getByText(
      "Amount must be a positive decimal string with up to 18 decimal places."
    )
  ).toBeVisible();

  await page.locator("#withdraw-asset").selectOption("USDC");
  await page.getByLabel("Destination Address").fill("invalid");
  await page.locator("#withdraw-amount").fill("25");
  await page.getByRole("button", { name: "Create Withdrawal Request" }).click();
  await expect(
    page.getByText("Destination address must be a valid EVM address.")
  ).toBeVisible();

  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  await page.getByPlaceholder("Search transactions...").fill("0fed");
  await expect(page.getByText("-10 USDC")).toBeVisible();
  await expect(page.getByText("+1.25 ETH")).toHaveCount(0);
  await expect(
    page.locator("bdi").filter({ hasText: "0x0000000000000000000000000000000000000fed" })
  ).toBeVisible();

  await page.goto("/staking");
  await expect(page.getByRole("heading", { name: "Ethereum Staking" })).toBeVisible();
  await expect(
    page.getByText("Customer staking execution remains policy-gated")
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Stake ETH" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Withdraw Stake" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Claim Rewards" })).toBeDisabled();
});
