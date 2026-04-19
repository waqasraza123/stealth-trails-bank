import type {
  CustomerMfaStatus,
  CustomerNotificationPreferences,
  CustomerSecurityActivityProjection,
  CustomerSessionProjection,
  UserProfileProjection,
} from "@stealth-trails-bank/types";

export type ApiEnvelope<T> = {
  status: "success" | "failed";
  message: string;
  error?: unknown;
  data?: T;
};

export type SessionUser = {
  id: number;
  supabaseUserId: string;
  firstName: string;
  lastName: string;
  email: string;
  ethereumAddress: string;
  passwordRotationAvailable?: boolean;
  notificationPreferences?: CustomerNotificationPreferences | null;
  mfa?: CustomerMfaStatus;
};

export type SessionRefresh = {
  token: string;
  revokedOtherSessions: boolean;
};

export type MfaStatusResponseData = {
  mfa: CustomerMfaStatus;
};

export type StartTotpEnrollmentResult = {
  mfa: CustomerMfaStatus;
  secret: string;
  otpAuthUri: string;
};

export type StartEmailEnrollmentResult = {
  mfa: CustomerMfaStatus;
  challengeId: string;
  expiresAt: string;
  deliveryChannel: "email";
  previewCode: string | null;
};

export type StartEmailRecoveryResult = StartEmailEnrollmentResult;

export type StartMfaChallengeResult = {
  mfa: CustomerMfaStatus;
  challengeId: string;
  method: "totp" | "email_otp";
  purpose: "withdrawal_step_up" | "password_step_up";
  expiresAt: string;
  previewCode: string | null;
};

export type VerifyMfaResult = {
  mfa: CustomerMfaStatus;
  session?: SessionRefresh;
};

export type SupportedAsset = {
  id: string;
  symbol: string;
  displayName: string;
  decimals: number;
  chainId: number;
  assetType: string;
  contractAddress: string | null;
};

export type CustomerAssetBalance = {
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  availableBalance: string;
  pendingBalance: string;
  updatedAt: string;
};

export type ListSupportedAssetsResult = {
  assets: SupportedAsset[];
};

export type ListMyBalancesResult = {
  customerAccountId: string;
  balances: CustomerAssetBalance[];
};

export type TransactionHistoryIntent = {
  id: string;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  sourceWalletAddress: string | null;
  destinationWalletAddress: string | null;
  externalAddress: string | null;
  intentType: "deposit" | "withdrawal";
  status:
    | "requested"
    | "review_required"
    | "approved"
    | "queued"
    | "broadcast"
    | "confirmed"
    | "settled"
    | "failed"
    | "cancelled"
    | "manually_resolved";
  policyDecision: "pending" | "approved" | "denied" | "review_required";
  requestedAmount: string;
  settledAmount: string | null;
  failureCode: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  latestBlockchainTransaction: {
    id: string;
    txHash: string | null;
    status: string;
    fromAddress: string | null;
    toAddress: string | null;
    createdAt: string;
    updatedAt: string;
    confirmedAt: string | null;
  } | null;
};

export type ListMyTransactionHistoryResult = {
  intents: TransactionHistoryIntent[];
  limit: number;
};

export type DepositIntentProjection = {
  id: string;
  customerAccountId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  destinationWalletAddress: string | null;
  intentType: "deposit";
  status: string;
  policyDecision: string;
  requestedAmount: string;
  createdAt: string;
  updatedAt: string;
};

export type WithdrawalIntentProjection = {
  id: string;
  customerAccountId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  sourceWalletAddress: string | null;
  externalAddress: string | null;
  intentType: "withdrawal";
  status: string;
  policyDecision: string;
  requestedAmount: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateDepositIntentResult = {
  intent: DepositIntentProjection;
  idempotencyReused: boolean;
};

export type CreateWithdrawalIntentResult = {
  intent: WithdrawalIntentProjection;
  idempotencyReused: boolean;
};

export type StakingExecutionCapability = {
  available: boolean;
  reasonCode:
    | "staking_contract_unconfigured"
    | "staking_write_unconfigured"
    | "customer_wallet_missing"
    | "customer_account_not_active"
    | "customer_wallet_not_active"
    | "wallet_custody_unsupported"
    | "signer_wallet_mismatch"
    | null;
  message: string;
};

export type CustomerStakingPoolSnapshot = {
  id: number;
  blockchainPoolId: number | null;
  rewardRate: number;
  totalStakedAmount: string;
  totalRewardsPaid: string;
  poolStatus: "active" | "disabled" | "paused" | "closed" | "completed";
  createdAt: string;
  updatedAt: string;
  position: {
    stakedBalance: string;
    pendingReward: string;
    canReadPosition: boolean;
  };
};

export type CustomerStakingSnapshot = {
  walletAddress: string | null;
  accountStatus: string;
  walletStatus: string;
  walletCustodyType: string;
  readModel: {
    available: boolean;
    message: string;
  };
  execution: StakingExecutionCapability;
  pools: CustomerStakingPoolSnapshot[];
};

export type StakingMutationResult = {
  transactionHash: string;
};

export type LoanPolicyPack = {
  jurisdiction: "saudi_arabia" | "uae" | "usa";
  displayName: string;
  disclosureTitle: string;
  disclosureBody: string;
  serviceFeeRateBps: number;
  warningLtvBps: number;
  liquidationLtvBps: number;
  gracePeriodDays: number;
};

export type LoanApplicationSummary = {
  id: string;
  status: string;
  jurisdiction: string;
  requestedBorrowAmount: string;
  requestedCollateralAmount: string;
  requestedTermMonths: number;
  serviceFeeAmount: string;
  borrowAsset: {
    symbol: string;
    displayName: string;
  };
  collateralAsset: {
    symbol: string;
    displayName: string;
  };
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
};

export type LoanAgreementSummary = {
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
  borrowAsset: {
    symbol: string;
    displayName: string;
  };
  collateralAsset: {
    symbol: string;
    displayName: string;
  };
  nextDueAt: string | null;
  fundedAt: string | null;
  activatedAt: string | null;
  gracePeriodEndsAt: string | null;
  statementReferences: Array<{
    id: string;
    referenceId: string;
    statementDate: string;
  }>;
  collateralPositions: Array<{
    id: string;
    assetId: string;
    amount: string;
    status: string;
    walletAddress: string | null;
    currentValuationUsd: string | null;
    latestLtvBps: number | null;
  }>;
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
  liquidationCases: Array<{
    id: string;
    status: string;
    reasonCode: string;
    recoveredAmount: string | null;
    shortfallAmount: string | null;
    updatedAt: string;
  }>;
  timeline: Array<{
    id: string;
    label: string;
    tone: "neutral" | "positive" | "warning" | "critical" | "technical";
    timestamp: string;
    description: string;
  }>;
  notice: string;
};

export type CustomerLoansDashboard = {
  account: {
    customerId: string;
    customerAccountId: string;
    email: string;
    walletAddress: string;
    accountStatus: string;
    walletStatus: string;
    custodyType: string;
  };
  eligibility: {
    eligible: boolean;
    accountReady: boolean;
    custodyReady: boolean;
    anyCollateralReady: boolean;
    reasons: string[];
    borrowingCapacity: {
      ETH: string;
      USDC: string;
    };
  };
  policyPacks: LoanPolicyPack[];
  supportedBorrowAssets: string[];
  supportedCollateralAssets: string[];
  balances: Array<{
    asset: SupportedAsset;
    availableBalance: string;
    pendingBalance: string;
  }>;
  applications: LoanApplicationSummary[];
  agreements: LoanAgreementSummary[];
};

export type LoanQuotePreview = {
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
  policyPack: LoanPolicyPack;
};

export type LoanApplicationInput = {
  jurisdiction: "saudi_arabia" | "uae" | "usa";
  borrowAssetSymbol: "ETH" | "USDC";
  collateralAssetSymbol: "ETH" | "USDC";
  borrowAmount: string;
  collateralAmount: string;
  termMonths: string;
  autopayEnabled: boolean;
  disclosureAcknowledgement: string;
  acceptServiceFeeDisclosure: boolean;
  supportNote?: string;
};

export type LoginResponseData = {
  token?: string;
  user: {
    id: number;
    supabaseUserId: string;
    email: string;
    ethereumAddress: string;
    firstName: string;
    lastName: string;
    mfa: CustomerMfaStatus;
  };
};

export type SignUpResponseData = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    ethereumAddress: string;
  };
};

export type RotatePasswordResult = {
  passwordRotationAvailable: boolean;
  session: SessionRefresh;
};

export type RevokeCustomerSessionsResult = {
  session: SessionRefresh;
};

export type ListCustomerSessionsResult = {
  sessions: CustomerSessionProjection[];
  activeSessionCount: number;
};

export type RevokeCustomerSessionResult = {
  revokedSessionId: string;
  activeSessionCount: number;
};

export type ListCustomerSecurityActivityResult = {
  events: CustomerSecurityActivityProjection[];
  limit: number;
  totalCount: number;
};

export type UpdateNotificationPreferencesResult = {
  notificationPreferences: CustomerNotificationPreferences;
};

export type ProfileProjection = UserProfileProjection;
