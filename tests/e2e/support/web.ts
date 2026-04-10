import type { Page } from "@playwright/test";
import { fulfillJson, isoAt, type MockResponseSpec } from "./common";

export const webLocaleStorageKey = "stealth-trails-bank.web.locale";
export const customerSessionStorageKey = "user-storage";

const defaultUser = {
  id: 1,
  firstName: "Amina",
  lastName: "Rahman",
  email: "amina@example.com",
  supabaseUserId: "supabase_1",
  ethereumAddress: "0x1111222233334444555566667777888899990000"
};

const ethAsset = {
  id: "asset_eth",
  symbol: "ETH",
  displayName: "Ether",
  decimals: 18,
  chainId: 1,
  assetType: "native",
  contractAddress: null
};

const usdcAsset = {
  id: "asset_usdc",
  symbol: "USDC",
  displayName: "USD Coin",
  decimals: 6,
  chainId: 1,
  assetType: "erc20",
  contractAddress: "0x0000000000000000000000000000000000000abc"
};

function buildBalances(hoursAgo = 2) {
  return {
    customerAccountId: "account_1",
    balances: [
      {
        asset: {
          id: ethAsset.id,
          symbol: ethAsset.symbol,
          displayName: ethAsset.displayName,
          decimals: ethAsset.decimals,
          chainId: ethAsset.chainId
        },
        availableBalance: "2.5",
        pendingBalance: "0",
        updatedAt: isoAt(hoursAgo)
      },
      {
        asset: {
          id: usdcAsset.id,
          symbol: usdcAsset.symbol,
          displayName: usdcAsset.displayName,
          decimals: usdcAsset.decimals,
          chainId: usdcAsset.chainId
        },
        availableBalance: "100",
        pendingBalance: "10",
        updatedAt: isoAt(hoursAgo)
      }
    ]
  };
}

function buildHistory(hoursAgo = 2) {
  return {
    limit: 100,
    intents: [
      {
        id: "intent_deposit_1",
        asset: {
          id: ethAsset.id,
          symbol: ethAsset.symbol,
          displayName: ethAsset.displayName,
          decimals: ethAsset.decimals,
          chainId: ethAsset.chainId
        },
        sourceWalletAddress: null,
        destinationWalletAddress: defaultUser.ethereumAddress,
        externalAddress: null,
        intentType: "deposit",
        status: "queued",
        policyDecision: "pending",
        requestedAmount: "1.25",
        settledAmount: null,
        failureCode: null,
        failureReason: null,
        createdAt: isoAt(hoursAgo + 4),
        updatedAt: isoAt(hoursAgo),
        latestBlockchainTransaction: {
          id: "chain_tx_1",
          txHash: "0xfeed1111222233334444555566667777888899990000aaaabbbbccccdddd0001",
          status: "broadcast",
          fromAddress: "0x9999222233334444555566667777888899990000",
          toAddress: defaultUser.ethereumAddress,
          createdAt: isoAt(hoursAgo + 3),
          updatedAt: isoAt(hoursAgo),
          confirmedAt: null
        }
      },
      {
        id: "intent_withdrawal_1",
        asset: {
          id: usdcAsset.id,
          symbol: usdcAsset.symbol,
          displayName: usdcAsset.displayName,
          decimals: usdcAsset.decimals,
          chainId: usdcAsset.chainId
        },
        sourceWalletAddress: defaultUser.ethereumAddress,
        destinationWalletAddress: null,
        externalAddress: "0x0000000000000000000000000000000000000fed",
        intentType: "withdrawal",
        status: "settled",
        policyDecision: "approved",
        requestedAmount: "10",
        settledAmount: "10",
        failureCode: null,
        failureReason: null,
        createdAt: isoAt(hoursAgo + 8),
        updatedAt: isoAt(hoursAgo + 7),
        latestBlockchainTransaction: {
          id: "chain_tx_2",
          txHash: "0xfeed1111222233334444555566667777888899990000aaaabbbbccccdddd0002",
          status: "confirmed",
          fromAddress: defaultUser.ethereumAddress,
          toAddress: "0x0000000000000000000000000000000000000fed",
          createdAt: isoAt(hoursAgo + 8),
          updatedAt: isoAt(hoursAgo + 7),
          confirmedAt: isoAt(hoursAgo + 7)
        }
      }
    ]
  };
}

function buildDepositResult() {
  return {
    idempotencyReused: false,
    intent: {
      id: "intent_deposit_created",
      customerAccountId: "account_1",
      asset: {
        id: ethAsset.id,
        symbol: ethAsset.symbol,
        displayName: ethAsset.displayName,
        decimals: ethAsset.decimals,
        chainId: ethAsset.chainId
      },
      destinationWalletAddress: defaultUser.ethereumAddress,
      intentType: "deposit",
      status: "requested",
      policyDecision: "pending",
      requestedAmount: "1.25",
      createdAt: isoAt(0),
      updatedAt: isoAt(0)
    }
  };
}

function buildWithdrawalResult() {
  return {
    idempotencyReused: false,
    intent: {
      id: "intent_withdrawal_created",
      customerAccountId: "account_1",
      asset: {
        id: usdcAsset.id,
        symbol: usdcAsset.symbol,
        displayName: usdcAsset.displayName,
        decimals: usdcAsset.decimals,
        chainId: usdcAsset.chainId
      },
      sourceWalletAddress: defaultUser.ethereumAddress,
      externalAddress: "0x0000000000000000000000000000000000000abc",
      intentType: "withdrawal",
      status: "review_required",
      policyDecision: "review_required",
      requestedAmount: "25",
      createdAt: isoAt(0),
      updatedAt: isoAt(0)
    }
  };
}

function buildYieldSnapshot(executionAvailable = false) {
  return {
    walletAddress: defaultUser.ethereumAddress,
    accountStatus: "active",
    walletStatus: "active",
    walletCustodyType: "platform_managed",
    readModel: {
      available: true,
      message: "Live reads are available."
    },
    execution: {
      available: executionAvailable,
      reasonCode: executionAvailable ? null : "signer_wallet_mismatch",
      message: executionAvailable
        ? "Managed staking execution is enabled."
        : "Customer staking execution is disabled because contract positions are keyed by the signing wallet, and the configured signer does not match this customer's managed wallet."
    },
    pools: [
      {
        id: 11,
        blockchainPoolId: 1001,
        rewardRate: 4.8,
        totalStakedAmount: "32.5",
        totalRewardsPaid: "1.25",
        poolStatus: "active",
        createdAt: isoAt(12),
        updatedAt: isoAt(2),
        position: {
          stakedBalance: "1.5",
          pendingReward: "0.25",
          canReadPosition: true
        }
      }
    ]
  };
}

function buildProfile() {
  return {
    id: defaultUser.id,
    customerId: "customer_1",
    supabaseUserId: defaultUser.supabaseUserId,
    email: defaultUser.email,
    firstName: defaultUser.firstName,
    lastName: defaultUser.lastName,
    ethereumAddress: defaultUser.ethereumAddress,
    accountStatus: "active",
    activatedAt: isoAt(72),
    restrictedAt: null,
    frozenAt: null,
    closedAt: null,
    passwordRotationAvailable: true,
    notificationPreferences: {
      depositEmails: true,
      withdrawalEmails: true,
      loanEmails: true,
      productUpdateEmails: false
    }
  };
}

export type WebScenario = {
  login: MockResponseSpec<{ token: string; user: typeof defaultUser }>;
  profile: MockResponseSpec<ReturnType<typeof buildProfile>>;
  supportedAssets: MockResponseSpec<{ assets: Array<typeof ethAsset> }>;
  balances: MockResponseSpec<ReturnType<typeof buildBalances>>;
  history: MockResponseSpec<ReturnType<typeof buildHistory>>;
  deposit: MockResponseSpec<ReturnType<typeof buildDepositResult>>;
  withdrawal: MockResponseSpec<ReturnType<typeof buildWithdrawalResult>>;
  updatePassword: MockResponseSpec<{ passwordRotationAvailable: boolean }>;
  updateNotificationPreferences: MockResponseSpec<{
    notificationPreferences: NonNullable<
      ReturnType<typeof buildProfile>["notificationPreferences"]
    >;
  }>;
  stakingSnapshot: MockResponseSpec<ReturnType<typeof buildYieldSnapshot>>;
  stakingDeposit: MockResponseSpec<{ transactionHash: string }>;
  stakingWithdraw: MockResponseSpec<{ transactionHash: string }>;
  stakingClaimReward: MockResponseSpec<{ transactionHash: string }>;
  stakingEmergencyWithdraw: MockResponseSpec<{ transactionHash: string }>;
};

export function buildWebScenario(
  kind: "happy" | "empty" | "stale" | "api_error" = "happy",
  overrides: Partial<WebScenario> = {}
): WebScenario {
  const happy: WebScenario = {
    login: {
      data: {
        token: "test-token",
        user: defaultUser
      }
    },
    profile: {
      data: buildProfile()
    },
    supportedAssets: {
      data: {
        assets: [ethAsset, usdcAsset]
      }
    },
    balances: {
      data: buildBalances()
    },
    history: {
      data: buildHistory()
    },
    deposit: {
      data: buildDepositResult()
    },
    withdrawal: {
      data: buildWithdrawalResult()
    },
    updatePassword: {
      data: {
        passwordRotationAvailable: true
      }
    },
    updateNotificationPreferences: {
      data: {
        notificationPreferences: buildProfile().notificationPreferences
      }
    },
    stakingSnapshot: {
      data: buildYieldSnapshot(false)
    },
    stakingDeposit: {
      data: {
        transactionHash:
          "0x1111222233334444555566667777888899990000aaaabbbbccccdddd00000001"
      }
    },
    stakingWithdraw: {
      data: {
        transactionHash:
          "0x1111222233334444555566667777888899990000aaaabbbbccccdddd00000002"
      }
    },
    stakingClaimReward: {
      data: {
        transactionHash:
          "0x1111222233334444555566667777888899990000aaaabbbbccccdddd00000003"
      }
    },
    stakingEmergencyWithdraw: {
      data: {
        transactionHash:
          "0x1111222233334444555566667777888899990000aaaabbbbccccdddd00000004"
      }
    }
  };

  if (kind === "empty") {
    happy.balances = {
      data: {
        customerAccountId: "account_1",
        balances: []
      }
    };
    happy.history = {
      data: {
        limit: 100,
        intents: []
      }
    };
    happy.stakingSnapshot = {
      data: {
        ...buildYieldSnapshot(false),
        pools: []
      }
    };
  }

  if (kind === "stale") {
    happy.balances = {
      data: buildBalances(48)
    };
    happy.history = {
      data: buildHistory(48)
    };
  }

  if (kind === "api_error") {
    happy.supportedAssets = {
      ok: false,
      statusCode: 500,
      message: "Failed to load supported assets."
    };
    happy.balances = {
      ok: false,
      statusCode: 500,
      message: "Failed to load customer balances."
    };
    happy.history = {
      ok: false,
      statusCode: 500,
      message: "Failed to load transaction history."
    };
    happy.stakingSnapshot = {
      ok: false,
      statusCode: 500,
      message: "Failed to load staking snapshot."
    };
  }

  return {
    ...happy,
    ...overrides
  };
}

export async function seedCustomerSession(
  page: Page,
  {
    token = "test-token",
    user = defaultUser
  }: {
    token?: string;
    user?: typeof defaultUser | null;
  } = {}
): Promise<void> {
  await page.addInitScript(
    ({ storageKey, state }) => {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          state,
          version: 0
        })
      );
    },
    {
      storageKey: customerSessionStorageKey,
      state: {
        token,
        user
      }
    }
  );
}

export async function seedWebLocale(page: Page, locale: "en" | "ar"): Promise<void> {
  await page.addInitScript(
    ({ storageKey, value }) => {
      window.localStorage.setItem(storageKey, value);
    },
    {
      storageKey: webLocaleStorageKey,
      value: locale
    }
  );
}

export async function mockWebApi(
  page: Page,
  scenario: Partial<WebScenario> = {}
): Promise<void> {
  const resolvedScenario = buildWebScenario("happy", scenario);

  await page.route("**/*", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;

    if (pathname.endsWith("/auth/login") && request.method() === "POST") {
      return fulfillJson(route, resolvedScenario.login);
    }

    if (pathname.startsWith("/user/") && request.method() === "GET") {
      return fulfillJson(route, resolvedScenario.profile);
    }

    if (pathname.endsWith("/auth/password") && request.method() === "PATCH") {
      return fulfillJson(route, resolvedScenario.updatePassword);
    }

    if (
      pathname.endsWith("/notification-preferences") &&
      request.method() === "PATCH"
    ) {
      return fulfillJson(route, resolvedScenario.updateNotificationPreferences);
    }

    if (pathname.endsWith("/assets/supported") && request.method() === "GET") {
      return fulfillJson(route, resolvedScenario.supportedAssets);
    }

    if (pathname.endsWith("/balances/me") && request.method() === "GET") {
      return fulfillJson(route, resolvedScenario.balances);
    }

    if (pathname.endsWith("/transaction-intents/me/history") && request.method() === "GET") {
      return fulfillJson(route, resolvedScenario.history);
    }

    if (
      pathname.endsWith("/transaction-intents/deposit-requests") &&
      request.method() === "POST"
    ) {
      return fulfillJson(route, resolvedScenario.deposit);
    }

    if (
      pathname.endsWith("/transaction-intents/withdrawal-requests") &&
      request.method() === "POST"
    ) {
      return fulfillJson(route, resolvedScenario.withdrawal);
    }

    if (pathname.endsWith("/staking/me/snapshot") && request.method() === "GET") {
      return fulfillJson(route, resolvedScenario.stakingSnapshot);
    }

    if (pathname.endsWith("/staking/deposit") && request.method() === "POST") {
      return fulfillJson(route, resolvedScenario.stakingDeposit);
    }

    if (pathname.endsWith("/staking/withdraw") && request.method() === "POST") {
      return fulfillJson(route, resolvedScenario.stakingWithdraw);
    }

    if (pathname.endsWith("/staking/claim-reward") && request.method() === "POST") {
      return fulfillJson(route, resolvedScenario.stakingClaimReward);
    }

    if (
      pathname.endsWith("/staking/emergency-withdraw") &&
      request.method() === "POST"
    ) {
      return fulfillJson(route, resolvedScenario.stakingEmergencyWithdraw);
    }

    return route.fallback();
  });
}

export function customerUser() {
  return defaultUser;
}
