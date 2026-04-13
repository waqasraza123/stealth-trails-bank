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

function cloneData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatLoanAmount(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function loanTimelineEvent(
  id: string,
  label: string,
  tone: "neutral" | "positive" | "warning" | "critical" | "technical",
  description: string,
  hoursAgo = 0
) {
  return {
    id,
    label,
    tone,
    timestamp: isoAt(hoursAgo),
    description
  };
}

function buildLoanPolicyPacks() {
  return [
    {
      jurisdiction: "usa",
      displayName: "United States",
      disclosureTitle: "US managed lending disclosure",
      disclosureBody:
        "Collateralized lending uses a fixed service fee, explicit grace periods, and operator review before activation.",
      serviceFeeRateBps: 275,
      warningLtvBps: 6800,
      liquidationLtvBps: 8000,
      gracePeriodDays: 10
    },
    {
      jurisdiction: "uae",
      displayName: "United Arab Emirates",
      disclosureTitle: "UAE managed lending disclosure",
      disclosureBody:
        "Requests remain asset-backed with fixed disclosed fees and governed servicing actions.",
      serviceFeeRateBps: 250,
      warningLtvBps: 6700,
      liquidationLtvBps: 7900,
      gracePeriodDays: 7
    },
    {
      jurisdiction: "saudi_arabia",
      displayName: "Saudi Arabia",
      disclosureTitle: "Saudi managed lending disclosure",
      disclosureBody:
        "Origination remains policy-gated, with fixed fees and liquidation thresholds disclosed before submission.",
      serviceFeeRateBps: 260,
      warningLtvBps: 6600,
      liquidationLtvBps: 7800,
      gracePeriodDays: 7
    }
  ] as const;
}

function buildLoanQuotePreview(
  overrides: Partial<{
    applicationReferenceId: string;
    jurisdiction: string;
    borrowAssetSymbol: string;
    collateralAssetSymbol: string;
    principalAmount: string;
    collateralAmount: string;
    serviceFeeAmount: string;
    totalRepayableAmount: string;
    installmentAmount: string;
    installmentCount: number;
    termMonths: number;
    initialLtvBps: number;
    warningLtvBps: number;
    liquidationLtvBps: number;
    gracePeriodDays: number;
    autopayEnabled: boolean;
    disclosureSummary: string;
    requestedCollateralRatioBps: number;
    policyPack: ReturnType<typeof buildLoanPolicyPacks>[number];
  }> = {}
) {
  const policyPacks = buildLoanPolicyPacks();
  const selectedPolicy =
    policyPacks.find((pack) => pack.jurisdiction === overrides.jurisdiction) ?? policyPacks[0];

  return {
    applicationReferenceId: overrides.applicationReferenceId ?? "quote-preview-1",
    jurisdiction: overrides.jurisdiction ?? selectedPolicy.jurisdiction,
    borrowAssetSymbol: overrides.borrowAssetSymbol ?? "USDC",
    collateralAssetSymbol: overrides.collateralAssetSymbol ?? "ETH",
    principalAmount: overrides.principalAmount ?? "1000",
    collateralAmount: overrides.collateralAmount ?? "1600",
    serviceFeeAmount: overrides.serviceFeeAmount ?? "27.5",
    totalRepayableAmount: overrides.totalRepayableAmount ?? "1027.5",
    installmentAmount: overrides.installmentAmount ?? "171.25",
    installmentCount: overrides.installmentCount ?? 6,
    termMonths: overrides.termMonths ?? 6,
    initialLtvBps: overrides.initialLtvBps ?? 6250,
    warningLtvBps: overrides.warningLtvBps ?? selectedPolicy.warningLtvBps,
    liquidationLtvBps:
      overrides.liquidationLtvBps ?? selectedPolicy.liquidationLtvBps,
    gracePeriodDays: overrides.gracePeriodDays ?? selectedPolicy.gracePeriodDays,
    autopayEnabled: overrides.autopayEnabled ?? true,
    disclosureSummary:
      overrides.disclosureSummary ??
      "Managed lending remains collateralized and uses a fixed disclosed service fee.",
    requestedCollateralRatioBps: overrides.requestedCollateralRatioBps ?? 16000,
    policyPack: selectedPolicy
  };
}

function buildLoanApplication(
  overrides: Partial<{
    id: string;
    status: string;
    jurisdiction: string;
    requestedBorrowAmount: string;
    requestedCollateralAmount: string;
    requestedTermMonths: number;
    serviceFeeAmount: string;
    submittedAt: string;
    reviewedAt: string | null;
    note: string | null;
    linkedLoanAgreementId: string | null;
    timeline: Array<{
      id: string;
      label: string;
      tone: "neutral" | "positive" | "warning" | "critical" | "technical";
      timestamp: string;
      description: string;
    }>;
  }> = {}
) {
  return {
    id: overrides.id ?? "loan_application_1",
    status: overrides.status ?? "under_review",
    jurisdiction: overrides.jurisdiction ?? "usa",
    requestedBorrowAmount: overrides.requestedBorrowAmount ?? "1000",
    requestedCollateralAmount: overrides.requestedCollateralAmount ?? "1600",
    requestedTermMonths: overrides.requestedTermMonths ?? 6,
    serviceFeeAmount: overrides.serviceFeeAmount ?? "27.5",
    borrowAsset: {
      symbol: "USDC",
      displayName: "USD Coin"
    },
    collateralAsset: {
      symbol: "ETH",
      displayName: "Ethereum"
    },
    submittedAt: overrides.submittedAt ?? isoAt(48),
    reviewedAt: overrides.reviewedAt ?? null,
    note: overrides.note ?? "Manual review is validating the pledged collateral wallet.",
    linkedLoanAgreementId: overrides.linkedLoanAgreementId ?? null,
    timeline: overrides.timeline ?? [
      loanTimelineEvent(
        "loan_application_event_1",
        "Submitted",
        "technical",
        "Customer submitted a managed lending application.",
        48
      ),
      loanTimelineEvent(
        "loan_application_event_2",
        "Under review",
        "warning",
        "Operator review is validating disclosures, collateral, and funding posture.",
        36
      )
    ]
  };
}

function buildLoanAgreement(
  overrides: Partial<{
    id: string;
    status: string;
    jurisdiction: string;
    principalAmount: string;
    collateralAmount: string;
    serviceFeeAmount: string;
    outstandingPrincipalAmount: string;
    outstandingServiceFeeAmount: string;
    outstandingTotalAmount: string;
    installmentAmount: string;
    installmentCount: number;
    termMonths: number;
    autopayEnabled: boolean;
    nextDueAt: string | null;
    fundedAt: string | null;
    activatedAt: string | null;
    gracePeriodEndsAt: string | null;
    installments: Array<{
      id: string;
      installmentNumber: number;
      dueAt: string;
      status: string;
      scheduledPrincipalAmount: string;
      scheduledServiceFeeAmount: string;
      scheduledTotalAmount: string;
      paidTotalAmount: string;
    }>;
    timeline: Array<{
      id: string;
      label: string;
      tone: "neutral" | "positive" | "warning" | "critical" | "technical";
      timestamp: string;
      description: string;
    }>;
    notice: string;
  }> = {}
) {
  const autopayEnabled = overrides.autopayEnabled ?? true;

  return {
    id: overrides.id ?? "loan_agreement_1",
    status: overrides.status ?? "active",
    jurisdiction: overrides.jurisdiction ?? "usa",
    principalAmount: overrides.principalAmount ?? "1000",
    collateralAmount: overrides.collateralAmount ?? "1600",
    serviceFeeAmount: overrides.serviceFeeAmount ?? "27.5",
    outstandingPrincipalAmount: overrides.outstandingPrincipalAmount ?? "1000",
    outstandingServiceFeeAmount: overrides.outstandingServiceFeeAmount ?? "27.5",
    outstandingTotalAmount: overrides.outstandingTotalAmount ?? "1027.5",
    installmentAmount: overrides.installmentAmount ?? "171.25",
    installmentCount: overrides.installmentCount ?? 6,
    termMonths: overrides.termMonths ?? 6,
    autopayEnabled,
    borrowAsset: {
      symbol: "USDC",
      displayName: "USD Coin"
    },
    collateralAsset: {
      symbol: "ETH",
      displayName: "Ethereum"
    },
    nextDueAt: overrides.nextDueAt ?? isoAt(-24 * 14),
    fundedAt: overrides.fundedAt ?? isoAt(24),
    activatedAt: overrides.activatedAt ?? isoAt(24),
    gracePeriodEndsAt: overrides.gracePeriodEndsAt ?? null,
    statementReferences: [
      {
        id: "statement_1",
        referenceId: "loan-statement-2026-04",
        statementDate: "2026-04-01"
      }
    ],
    collateralPositions: [
      {
        id: "loan_collateral_1",
        assetId: ethAsset.id,
        amount: "1600",
        status: "active",
        walletAddress: defaultUser.ethereumAddress,
        currentValuationUsd: "1625",
        latestLtvBps: 6320
      }
    ],
    installments: overrides.installments ?? [
      {
        id: "installment_1",
        installmentNumber: 1,
        dueAt: isoAt(-24 * 14),
        status: "due",
        scheduledPrincipalAmount: "166.67",
        scheduledServiceFeeAmount: "4.58",
        scheduledTotalAmount: "171.25",
        paidTotalAmount: "0"
      },
      {
        id: "installment_2",
        installmentNumber: 2,
        dueAt: isoAt(-24 * 44),
        status: "scheduled",
        scheduledPrincipalAmount: "166.67",
        scheduledServiceFeeAmount: "4.58",
        scheduledTotalAmount: "171.25",
        paidTotalAmount: "0"
      }
    ],
    liquidationCases: [],
    timeline: overrides.timeline ?? [
      loanTimelineEvent(
        "loan_agreement_event_1",
        "Funded",
        "positive",
        "Funding workflow completed and the agreement is active.",
        24
      ),
      loanTimelineEvent(
        "loan_agreement_event_2",
        autopayEnabled ? "Autopay enabled" : "Autopay disabled",
        autopayEnabled ? "technical" : "warning",
        autopayEnabled
          ? "Managed balance autopay will attempt the next installment automatically."
          : "Autopay is disabled and upcoming installments require manual action.",
        12
      )
    ],
    notice:
      overrides.notice ??
      (autopayEnabled
        ? "Autopay is enabled and the next scheduled installment will attempt against your managed balance."
        : "Autopay is disabled. Ensure managed balances are ready before the next due date.")
  };
}

function buildLoansDashboard() {
  return {
    account: {
      customerId: "customer_1",
      customerAccountId: "account_1",
      email: defaultUser.email,
      walletAddress: defaultUser.ethereumAddress,
      accountStatus: "active",
      walletStatus: "active",
      custodyType: "platform_managed"
    },
    eligibility: {
      eligible: true,
      accountReady: true,
      custodyReady: true,
      anyCollateralReady: true,
      reasons: [],
      borrowingCapacity: {
        ETH: "1.5",
        USDC: "7500"
      }
    },
    policyPacks: buildLoanPolicyPacks(),
    supportedBorrowAssets: ["ETH", "USDC"],
    supportedCollateralAssets: ["ETH", "USDC"],
    balances: [
      {
        asset: ethAsset,
        availableBalance: "2.5",
        pendingBalance: "0"
      },
      {
        asset: usdcAsset,
        availableBalance: "5000",
        pendingBalance: "250"
      }
    ],
    applications: [buildLoanApplication()],
    agreements: [buildLoanAgreement()]
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
  loansDashboard: MockResponseSpec<ReturnType<typeof buildLoansDashboard>>;
  loanQuotePreview: MockResponseSpec<ReturnType<typeof buildLoanQuotePreview>>;
  createLoanApplication: MockResponseSpec<{
    applicationId: string;
    status: string;
    quote: ReturnType<typeof buildLoanQuotePreview>;
  }>;
  setLoanAutopay: MockResponseSpec<{
    loanAgreementId: string;
    autopayEnabled: boolean;
  }>;
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
    },
    loansDashboard: {
      data: buildLoansDashboard()
    },
    loanQuotePreview: {
      data: buildLoanQuotePreview()
    },
    createLoanApplication: {
      data: {
        applicationId: "loan_application_created",
        status: "submitted_for_review",
        quote: buildLoanQuotePreview()
      }
    },
    setLoanAutopay: {
      data: {
        loanAgreementId: "loan_agreement_1",
        autopayEnabled: false
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
    happy.loansDashboard = {
      data: {
        ...buildLoansDashboard(),
        applications: [],
        agreements: []
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
    happy.loansDashboard = {
      ok: false,
      statusCode: 500,
      message: "Failed to load customer loans."
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
  const currentLoansDashboard = cloneData(
    resolvedScenario.loansDashboard.data ?? buildLoansDashboard()
  );
  let currentLoanQuote = cloneData(
    resolvedScenario.loanQuotePreview.data ?? buildLoanQuotePreview()
  );
  let loanApplicationCounter = currentLoansDashboard.applications.length + 1;

  function buildPreviewFromPayload(payload: Record<string, unknown>) {
    const principalAmount = Number(payload.borrowAmount ?? 0);
    const collateralAmount = Number(payload.collateralAmount ?? 0);
    const termMonths = Number(payload.termMonths ?? 0) || 1;
    const jurisdiction = String(payload.jurisdiction ?? "usa");
    const borrowAssetSymbol = String(payload.borrowAssetSymbol ?? "USDC");
    const collateralAssetSymbol = String(payload.collateralAssetSymbol ?? "ETH");
    const autopayEnabled = Boolean(payload.autopayEnabled);
    const policyPack =
      currentLoansDashboard.policyPacks.find((pack) => pack.jurisdiction === jurisdiction) ??
      currentLoansDashboard.policyPacks[0];
    const serviceFeeAmount = principalAmount * (policyPack.serviceFeeRateBps / 10000);
    const totalRepayableAmount = principalAmount + serviceFeeAmount;
    const requestedCollateralRatioBps =
      principalAmount > 0 ? Math.round((collateralAmount / principalAmount) * 10000) : 0;
    const initialLtvBps =
      collateralAmount > 0 ? Math.round((principalAmount / collateralAmount) * 10000) : 0;

    return buildLoanQuotePreview({
      applicationReferenceId: `quote-preview-${loanApplicationCounter}`,
      jurisdiction,
      borrowAssetSymbol,
      collateralAssetSymbol,
      principalAmount: formatLoanAmount(principalAmount),
      collateralAmount: formatLoanAmount(collateralAmount),
      serviceFeeAmount: formatLoanAmount(serviceFeeAmount),
      totalRepayableAmount: formatLoanAmount(totalRepayableAmount),
      installmentAmount: formatLoanAmount(totalRepayableAmount / termMonths),
      installmentCount: termMonths,
      termMonths,
      initialLtvBps,
      warningLtvBps: policyPack.warningLtvBps,
      liquidationLtvBps: policyPack.liquidationLtvBps,
      gracePeriodDays: policyPack.gracePeriodDays,
      autopayEnabled,
      disclosureSummary: policyPack.disclosureBody,
      requestedCollateralRatioBps
    });
  }

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

    if (pathname.endsWith("/loans/me/dashboard") && request.method() === "GET") {
      if (resolvedScenario.loansDashboard.ok === false) {
        return fulfillJson(route, resolvedScenario.loansDashboard);
      }

      return fulfillJson(route, {
        ...resolvedScenario.loansDashboard,
        data: currentLoansDashboard
      });
    }

    if (pathname.endsWith("/loans/me/quote-preview") && request.method() === "POST") {
      if (resolvedScenario.loanQuotePreview.ok === false) {
        return fulfillJson(route, resolvedScenario.loanQuotePreview);
      }

      const payload = (request.postDataJSON() as Record<string, unknown> | null) ?? {};
      currentLoanQuote = buildPreviewFromPayload(payload);

      return fulfillJson(route, {
        ...resolvedScenario.loanQuotePreview,
        data: currentLoanQuote
      });
    }

    if (pathname.endsWith("/loans/me/applications") && request.method() === "POST") {
      if (resolvedScenario.createLoanApplication.ok === false) {
        return fulfillJson(route, resolvedScenario.createLoanApplication);
      }

      const payload = (request.postDataJSON() as Record<string, unknown> | null) ?? {};
      const applicationId = `loan_application_${loanApplicationCounter++}`;
      const status = resolvedScenario.createLoanApplication.data?.status ?? "submitted_for_review";
      const submittedAt = isoAt(0);
      const supportNote =
        typeof payload.supportNote === "string" && payload.supportNote.trim().length > 0
          ? payload.supportNote.trim()
          : null;

      currentLoansDashboard.applications.unshift(
        buildLoanApplication({
          id: applicationId,
          status,
          jurisdiction: String(payload.jurisdiction ?? currentLoanQuote.jurisdiction),
          requestedBorrowAmount: String(
            payload.borrowAmount ?? currentLoanQuote.principalAmount
          ),
          requestedCollateralAmount: String(
            payload.collateralAmount ?? currentLoanQuote.collateralAmount
          ),
          requestedTermMonths: Number(
            payload.termMonths ?? currentLoanQuote.termMonths
          ),
          serviceFeeAmount: currentLoanQuote.serviceFeeAmount,
          submittedAt,
          note: supportNote,
          linkedLoanAgreementId: null,
          timeline: [
            loanTimelineEvent(
              `${applicationId}_event_1`,
              "Submitted for review",
              "technical",
              "The governed lending request was submitted and queued for operator review."
            ),
            ...(supportNote
              ? [
                  loanTimelineEvent(
                    `${applicationId}_event_2`,
                    "Support context added",
                    "neutral",
                    supportNote
                  )
                ]
              : [])
          ]
        })
      );

      return fulfillJson(route, {
        ...resolvedScenario.createLoanApplication,
        data: {
          applicationId,
          status,
          quote: currentLoanQuote
        }
      });
    }

    if (/\/loans\/me\/[^/]+\/autopay$/.test(pathname) && request.method() === "POST") {
      if (resolvedScenario.setLoanAutopay.ok === false) {
        return fulfillJson(route, resolvedScenario.setLoanAutopay);
      }

      const agreementId = pathname.split("/").slice(-2)[0];
      const payload = (request.postDataJSON() as Record<string, unknown> | null) ?? {};
      const enabled = Boolean(payload.policyOverride);
      const targetAgreement = currentLoansDashboard.agreements.find(
        (agreement) => agreement.id === agreementId
      );

      if (targetAgreement) {
        targetAgreement.autopayEnabled = enabled;
        targetAgreement.notice = enabled
          ? "Autopay is enabled and the next scheduled installment will attempt against your managed balance."
          : "Autopay is disabled. Ensure managed balances are ready before the next due date.";
        targetAgreement.timeline.unshift(
          loanTimelineEvent(
            `${agreementId}_autopay_${enabled ? "enabled" : "disabled"}`,
            enabled ? "Autopay enabled" : "Autopay disabled",
            enabled ? "technical" : "warning",
            enabled
              ? "Managed balance autopay was enabled for the agreement."
              : "Managed balance autopay was disabled for the agreement."
          )
        );
      }

      return fulfillJson(route, {
        ...resolvedScenario.setLoanAutopay,
        data: {
          loanAgreementId: agreementId,
          autopayEnabled: enabled
        }
      });
    }

    return route.fallback();
  });
}

export function customerUser() {
  return defaultUser;
}
