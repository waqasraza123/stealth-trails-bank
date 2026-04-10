export type LoanJurisdictionCode = "saudi_arabia" | "uae" | "usa";

export type LoanLifecycleStatus =
  | "draft_application"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "awaiting_funding"
  | "active"
  | "grace_period"
  | "delinquent"
  | "defaulted"
  | "liquidating"
  | "closed";

export type LoanCollateralStatus =
  | "pending_lock"
  | "locked"
  | "margin_warning"
  | "liquidation_review"
  | "liquidating"
  | "released"
  | "seized";

export type LoanInstallmentStatus =
  | "scheduled"
  | "due"
  | "partial"
  | "paid"
  | "missed"
  | "waived";

export type LoanRepaymentStatus =
  | "scheduled"
  | "processing"
  | "settled"
  | "failed"
  | "cancelled";

export type LoanLiquidationStatus =
  | "review_requested"
  | "approved"
  | "executing"
  | "executed"
  | "cancelled"
  | "closed";

export type JurisdictionLoanPolicyPack = {
  jurisdiction: LoanJurisdictionCode;
  displayName: string;
  currency: "USD";
  supportedBorrowSymbols: string[];
  supportedCollateralSymbols: string[];
  disclosureTitle: string;
  disclosureBody: string;
  serviceFeeRateBps: number;
  minPrincipalUsd: string;
  maxPrincipalUsd: string;
  minimumTermMonths: number;
  maximumTermMonths: number;
  initialLtvBps: number;
  warningLtvBps: number;
  liquidationLtvBps: number;
  gracePeriodDays: number;
  requiredApproverRoles: string[];
  liquidationApproverRoles: string[];
};

export type LoanQuote = {
  jurisdiction: LoanJurisdictionCode;
  borrowAssetSymbol: string;
  collateralAssetSymbol: string;
  principalAmount: string;
  collateralAmount: string;
  serviceFeeAmount: string;
  totalRepayableAmount: string;
  termMonths: number;
  installmentCount: number;
  installmentAmount: string;
  initialLtvBps: number;
  warningLtvBps: number;
  liquidationLtvBps: number;
  gracePeriodDays: number;
  policyPack: JurisdictionLoanPolicyPack;
};

export type LoanApplication = {
  id: string;
  customerAccountId: string;
  status: LoanLifecycleStatus;
  jurisdiction: LoanJurisdictionCode;
  requestedBorrowAssetId: string;
  requestedCollateralAssetId: string;
  requestedBorrowAmount: string;
  requestedCollateralAmount: string;
  requestedTermMonths: number;
  serviceFeeAmount: string;
  autopayEnabled: boolean;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedByOperatorId: string | null;
  reviewedByOperatorRole: string | null;
  decisionNote: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LoanInstallment = {
  id: string;
  dueAt: string;
  status: LoanInstallmentStatus;
  scheduledPrincipalAmount: string;
  scheduledServiceFeeAmount: string;
  scheduledTotalAmount: string;
  paidPrincipalAmount: string;
  paidServiceFeeAmount: string;
  paidTotalAmount: string;
  lastAutopayAttemptAt: string | null;
};

export type LoanRepaymentEvent = {
  id: string;
  installmentId: string | null;
  status: LoanRepaymentStatus;
  amount: string;
  principalAppliedAmount: string;
  serviceFeeAppliedAmount: string;
  autopayAttempted: boolean;
  autopaySucceeded: boolean;
  failureReason: string | null;
  createdAt: string;
  settledAt: string | null;
};

export type CollateralPosition = {
  id: string;
  assetId: string;
  amount: string;
  status: LoanCollateralStatus;
  currentValuationUsd: string | null;
  latestLtvBps: number | null;
  lockedAt: string | null;
  releasedAt: string | null;
  seizedAt: string | null;
};

export type LoanAgreement = {
  id: string;
  applicationId: string;
  customerAccountId: string;
  status: LoanLifecycleStatus;
  jurisdiction: LoanJurisdictionCode;
  borrowAssetId: string;
  collateralAssetId: string;
  principalAmount: string;
  collateralAmount: string;
  serviceFeeAmount: string;
  totalRepayableAmount: string;
  outstandingPrincipalAmount: string;
  outstandingServiceFeeAmount: string;
  outstandingTotalAmount: string;
  installmentAmount: string;
  installmentCount: number;
  termMonths: number;
  autopayEnabled: boolean;
  contractLoanId: string | null;
  contractAddress: string | null;
  activationTransactionHash: string | null;
  approvedAt: string | null;
  fundedAt: string | null;
  activatedAt: string | null;
  gracePeriodEndsAt: string | null;
  delinquentAt: string | null;
  defaultedAt: string | null;
  liquidationStartedAt: string | null;
  closedAt: string | null;
  nextDueAt: string | null;
  installments: LoanInstallment[];
  repayments: LoanRepaymentEvent[];
  collateralPositions: CollateralPosition[];
};

export type LoanDelinquencyStatus = {
  status: LoanLifecycleStatus;
  gracePeriodEndsAt: string | null;
  delinquentAt: string | null;
  defaultedAt: string | null;
  nextRecommendedAction: string;
};

export type LiquidationCase = {
  id: string;
  loanAgreementId: string;
  status: LoanLiquidationStatus;
  reasonCode: string;
  requestedByOperatorId: string | null;
  approvedByOperatorId: string | null;
  executedByOperatorId: string | null;
  note: string | null;
  executionTransactionHash: string | null;
  recoveredAmount: string | null;
  shortfallAmount: string | null;
  createdAt: string;
  updatedAt: string;
};
