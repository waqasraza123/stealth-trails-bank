import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  loadOptionalBlockchainContractReadRuntimeConfig,
  loadGovernedExecutionRuntimeConfig,
  type ApiRuntimeEnvironment,
  type GovernedExecutionRuntimeConfig
} from "@stealth-trails-bank/config/api";
import {
  createJsonRpcProvider,
  LOAN_BOOK_ABI,
  LOAN_BOOK_V1_ABI,
  STAKING_CONTRACT_ABI
} from "@stealth-trails-bank/contracts-sdk";
import {
  AssetType,
  GovernedExecutionOverrideRequestStatus,
  GovernedTreasuryExecutionDeliveryStatus,
  GovernedTreasuryExecutionDispatchStatus,
  GovernedTreasuryExecutionRequestStatus,
  GovernedTreasuryExecutionRequestType,
  Prisma,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment,
  WorkerRuntimeExecutionMode
} from "@prisma/client";
import { ethers } from "ethers";
import { assertOperatorRoleAuthorized } from "../auth/internal-operator-role-policy";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import {
  buildSignedGovernedExecutionPackage,
  type GovernedExecutionReceiptPayload,
  type GovernedExecutionPackagePayload,
  verifySignedGovernedExecutionReceipt,
  verifySignedGovernedExecutionPackage
} from "./governed-execution-proof";

const RESERVE_WALLET_KINDS = [
  WalletKind.treasury,
  WalletKind.operational,
  WalletKind.contract
] as const;

const walletInclude = {
  customerAccount: {
    select: {
      id: true,
      status: true,
      customer: {
        select: {
          email: true,
          supabaseUserId: true
        }
      }
    }
  }
} satisfies Prisma.WalletInclude;

type ReserveWalletRecord = Prisma.WalletGetPayload<{
  include: typeof walletInclude;
}>;

type OverrideRecord = Prisma.GovernedExecutionOverrideRequestGetPayload<{}>;
type WorkerHeartbeatRecord = Prisma.WorkerRuntimeHeartbeatGetPayload<{}>;

const executionRequestInclude = {
  asset: {
    select: {
      id: true,
      symbol: true,
      displayName: true,
      decimals: true,
      chainId: true
    }
  },
  loanAgreement: {
    select: {
      id: true,
      status: true,
      contractLoanId: true,
      contractAddress: true
    }
  },
  stakingPoolGovernanceRequest: {
    select: {
      id: true,
      status: true,
      rewardRate: true,
      stakingPoolId: true
    }
  }
} satisfies Prisma.GovernedTreasuryExecutionRequestInclude;

type ExecutionRequestRecord = Prisma.GovernedTreasuryExecutionRequestGetPayload<{
  include: typeof executionRequestInclude;
}>;

type OperatorContext = {
  operatorId: string | null;
  operatorRole: string | null;
};

type OverrideProjection = {
  id: string;
  environment: WorkerRuntimeEnvironment;
  status: GovernedExecutionOverrideRequestStatus;
  allowUnsafeWithdrawalExecution: boolean;
  allowDirectLoanFunding: boolean;
  allowDirectStakingWrites: boolean;
  reasonCode: string;
  requestNote: string | null;
  requestedByOperatorId: string;
  requestedByOperatorRole: string;
  requestedAt: string;
  expiresAt: string;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  approvalNote: string | null;
  approvedAt: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  rejectionNote: string | null;
  rejectedAt: string | null;
  updatedAt: string;
};

type ExecutionRequestProjection = {
  id: string;
  environment: WorkerRuntimeEnvironment;
  chainId: number;
  executionType: GovernedTreasuryExecutionRequestType;
  status: GovernedTreasuryExecutionRequestStatus;
  targetType: string;
  targetId: string;
  loanAgreementId: string | null;
  stakingPoolGovernanceRequestId: string | null;
  contractAddress: string | null;
  contractMethod: string;
  walletAddress: string | null;
  requestNote: string | null;
  requestedByActorType: string;
  requestedByActorId: string;
  requestedByActorRole: string | null;
  requestedAt: string;
  executedByActorType: string | null;
  executedByActorId: string | null;
  executedByActorRole: string | null;
  executedAt: string | null;
  blockchainTransactionHash: string | null;
  externalExecutionReference: string | null;
  failureReason: string | null;
  failedAt: string | null;
  metadata: Prisma.JsonValue | null;
  executionPayload: Prisma.JsonValue;
  executionResult: Prisma.JsonValue | null;
  canonicalExecutionPayload: Prisma.JsonValue | null;
  canonicalExecutionPayloadText: string | null;
  executionPackageHash: string | null;
  executionPackageChecksumSha256: string | null;
  executionPackageSignature: string | null;
  executionPackageSignatureAlgorithm: string | null;
  executionPackageSignerAddress: string | null;
  executionPackagePublishedAt: string | null;
  claimedByWorkerId: string | null;
  claimedAt: string | null;
  claimExpiresAt: string | null;
  dispatchStatus: GovernedTreasuryExecutionDispatchStatus;
  dispatchPreparedAt: string | null;
  dispatchedByWorkerId: string | null;
  dispatchReference: string | null;
  dispatchVerificationChecksumSha256: string | null;
  dispatchFailureReason: string | null;
  deliveryStatus: GovernedTreasuryExecutionDeliveryStatus;
  deliveryAttemptedAt: string | null;
  deliveryAcceptedAt: string | null;
  deliveredByWorkerId: string | null;
  deliveryBackendType: string | null;
  deliveryBackendReference: string | null;
  deliveryHttpStatus: number | null;
  deliveryFailureReason: string | null;
  expectedExecutionCalldata: string | null;
  expectedExecutionCalldataHash: string | null;
  expectedExecutionMethodSelector: string | null;
  claimedByExecutorId: string | null;
  executorClaimedAt: string | null;
  executorClaimExpiresAt: string | null;
  executorReceiptSubmittedAt: string | null;
  updatedAt: string;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  } | null;
  loanAgreement: {
    id: string;
    status: string;
    contractLoanId: string | null;
    contractAddress: string | null;
  } | null;
  stakingPoolGovernanceRequest: {
    id: string;
    status: string;
    rewardRate: number;
    stakingPoolId: number | null;
  } | null;
};

export type GovernedExecutionWorkspaceResult = {
  generatedAt: string;
  environment: WorkerRuntimeEnvironment;
  policy: {
    governedExecutionRequiredInProduction: boolean;
    governedReserveCustodyTypes: string[];
    loanFundingExecutionMode: string;
    stakingWriteExecutionMode: string;
    overrideMaxHours: number;
    executionClaimLeaseSeconds: number;
    executorClaimLeaseSeconds: number;
    executorDeliveryBackendType: string;
  };
  posture: {
    status: "healthy" | "warning" | "critical";
    reasons: Array<{
      code: string;
      severity: "warning" | "critical";
      summary: string;
    }>;
    totalReserveWalletCount: number;
    governedReserveWalletCount: number;
    unsafeReserveWalletCount: number;
    contractControlledReserveWalletCount: number;
    multisigControlledReserveWalletCount: number;
    policyControlledReadyWorkerCount: number;
    managedWorkerCount: number;
    activeApprovedOverrideCount: number;
    pendingOverrideCount: number;
  };
  reserveWallets: Array<{
    id: string;
    chainId: number;
    address: string;
    kind: WalletKind;
    custodyType: WalletCustodyType;
    status: WalletStatus;
    governanceStatus: "governed" | "unsafe";
    governanceReason: string;
    customerAssignment: {
      customerAccountId: string;
      accountStatus: string;
      email: string | null;
      supabaseUserId: string | null;
    } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  latestPendingOverrideRequest: OverrideProjection | null;
  activeApprovedOverrides: OverrideProjection[];
  recentOverrideRequests: OverrideProjection[];
  latestPendingExecutionRequest: ExecutionRequestProjection | null;
  recentExecutionRequests: ExecutionRequestProjection[];
  governance: {
    currentOperator: {
      operatorId: string | null;
      operatorRole: string | null;
      canRequestOverride: boolean;
      canApproveOverride: boolean;
    };
    requestAllowedOperatorRoles: string[];
    approverAllowedOperatorRoles: string[];
  };
};

type AssertManagedWithdrawalInput = {
  sourceWalletAddress: string | null;
  sourceWalletKind: WalletKind | null;
  sourceWalletCustodyType: WalletCustodyType | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMetadataBoolean(
  metadata: Prisma.JsonValue | null | undefined,
  key: string
): boolean {
  if (!isRecord(metadata)) {
    return false;
  }

  return metadata[key] === true;
}

@Injectable()
export class GovernedExecutionService {
  private readonly logger = new Logger(GovernedExecutionService.name);
  private readonly config: GovernedExecutionRuntimeConfig;
  private readonly governedReserveCustodyTypes: Set<string>;
  private readonly requestAllowedRoles: readonly string[];
  private readonly approverAllowedRoles: readonly string[];
  private readonly executionPackageSignerPrivateKey: string;
  private readonly executorAllowedSignerAddresses: Set<string>;
  private readonly provider: ethers.providers.JsonRpcProvider | null;

  constructor(private readonly prismaService: PrismaService) {
    this.config = {
      environment: "production",
      governedExecutionRequiredInProduction: true,
      governedReserveCustodyTypes: [],
      loanFundingExecutionMode: "direct_private_key",
      stakingWriteExecutionMode: "direct_private_key",
      requestAllowedOperatorRoles: [],
      approverAllowedOperatorRoles: [],
      overrideMaxHours: 12,
      executionPackageSignerPrivateKey:
        "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8",
      executionClaimLeaseSeconds: 300,
      executorClaimLeaseSeconds: 300,
      executorAllowedSignerAddresses: [],
      requireOnchainExecutorReceiptVerification: false,
      executorDeliveryBackendType: "internal_pull",
      governedCustody: null
    };
    this.governedReserveCustodyTypes = new Set();
    this.requestAllowedRoles = [];
    this.approverAllowedRoles = [];
    this.executionPackageSignerPrivateKey =
      this.config.executionPackageSignerPrivateKey;
    this.executorAllowedSignerAddresses = new Set();
    this.provider = null;

    try {
      this.config = loadGovernedExecutionRuntimeConfig();
      const chainRuntimeConfig = loadOptionalBlockchainContractReadRuntimeConfig();
      this.governedReserveCustodyTypes = new Set(
        this.config.governedReserveCustodyTypes
      );
      this.requestAllowedRoles = [...this.config.requestAllowedOperatorRoles];
      this.approverAllowedRoles = [...this.config.approverAllowedOperatorRoles];
      this.executionPackageSignerPrivateKey =
        this.config.executionPackageSignerPrivateKey;
      this.executorAllowedSignerAddresses = new Set(
        this.config.executorAllowedSignerAddresses.map((address) =>
          address.toLowerCase()
        )
      );
      this.provider = chainRuntimeConfig.rpcUrl
        ? createJsonRpcProvider(chainRuntimeConfig.rpcUrl)
        : null;
    } catch (error) {
      this.logger.warn(
        `Governed execution bootstrap is running in safe disabled mode: ${error instanceof Error ? error.message : "unknown error"}.`
      );
    }
  }

  private normalizeEnvironment(
    environment: ApiRuntimeEnvironment
  ): WorkerRuntimeEnvironment {
    if (environment === "development") {
      return WorkerRuntimeEnvironment.development;
    }

    if (environment === "test") {
      return WorkerRuntimeEnvironment.test;
    }

    return WorkerRuntimeEnvironment.production;
  }

  private get environment(): WorkerRuntimeEnvironment {
    return this.normalizeEnvironment(this.config.environment);
  }

  private normalizeOptionalString(value?: string | null): string | null {
    const normalizedValue = value?.trim() ?? null;
    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  }

  private buildExecutionReceiptPayload(args: {
    request: ExecutionRequestRecord;
    executorId: string;
    outcome: "executed" | "failed";
    dispatchReference: string;
    transactionChainId?: number;
    transactionToAddress?: string;
    blockchainTransactionHash?: string | null;
    externalExecutionReference?: string | null;
    contractLoanId?: string | null;
    contractAddress?: string | null;
    failureReason?: string | null;
    notedAt: string;
  }): GovernedExecutionReceiptPayload {
    return {
      version: 1,
      requestId: args.request.id,
      environment: args.request.environment,
      chainId: args.request.chainId,
      executionType: args.request.executionType,
      targetType: args.request.targetType,
      targetId: args.request.targetId,
      dispatchReference: args.dispatchReference,
      executorId: args.executorId,
      outcome: args.outcome,
      transactionChainId: args.transactionChainId ?? null,
      transactionToAddress:
        this.normalizeOptionalString(args.transactionToAddress) ?? null,
      blockchainTransactionHash:
        this.normalizeOptionalString(args.blockchainTransactionHash) ?? null,
      externalExecutionReference:
        this.normalizeOptionalString(args.externalExecutionReference) ?? null,
      contractLoanId: this.normalizeOptionalString(args.contractLoanId) ?? null,
      contractAddress: this.normalizeOptionalString(args.contractAddress) ?? null,
      failureReason: this.normalizeOptionalString(args.failureReason) ?? null,
      notedAt: args.notedAt
    };
  }

  private buildExpectedExecutionCall(args: {
    contractAddress: string | null;
    contractMethod: string;
    executionType: GovernedTreasuryExecutionRequestType;
    executionPayload: Prisma.JsonValue;
    walletAddress: string | null;
    borrowAsset?:
      | { assetType: AssetType; contractAddress: string | null; decimals: number }
      | null;
    collateralAsset?:
      | { assetType: AssetType; contractAddress: string | null; decimals: number }
      | null;
  }): {
    calldata: string | null;
    calldataHash: string | null;
    methodSelector: string | null;
  } {
    if (!args.contractAddress || !isRecord(args.executionPayload)) {
      return {
        calldata: null,
        calldataHash: null,
        methodSelector: null
      };
    }

    if (
      args.executionType ===
      GovernedTreasuryExecutionRequestType.loan_contract_creation
    ) {
      if (!args.walletAddress) {
        return {
          calldata: null,
          calldataHash: null,
          methodSelector: null
        };
      }

      const borrowAssetAddress =
        args.borrowAsset?.assetType === AssetType.native
          ? ethers.constants.AddressZero
          : args.borrowAsset?.contractAddress ?? ethers.constants.AddressZero;
      const collateralAssetAddress =
        args.collateralAsset?.assetType === AssetType.native
          ? ethers.constants.AddressZero
          : args.collateralAsset?.contractAddress ?? ethers.constants.AddressZero;
      if (
        args.contractMethod === "createAgreement" &&
        (!args.executionPayload.contractLoanId ||
          !args.executionPayload.treasuryReceiverAddress)
      ) {
        return {
          calldata: null,
          calldataHash: null,
          methodSelector: null
        };
      }
      const calldata =
        args.contractMethod === "createAgreement"
          ? new ethers.utils.Interface(LOAN_BOOK_V1_ABI).encodeFunctionData(
              args.contractMethod,
              [
                String(args.executionPayload.contractLoanId ?? ""),
                args.walletAddress,
                borrowAssetAddress,
                collateralAssetAddress,
                String(args.executionPayload.treasuryReceiverAddress ?? ""),
                ethers.utils.parseUnits(
                  String(args.executionPayload.principalAmount ?? "0"),
                  args.borrowAsset?.decimals ?? 18
                ),
                ethers.utils.parseUnits(
                  String(args.executionPayload.collateralAmount ?? "0"),
                  args.collateralAsset?.decimals ?? 18
                ),
                ethers.utils.parseUnits(
                  String(args.executionPayload.serviceFeeAmount ?? "0"),
                  args.borrowAsset?.decimals ?? 18
                )
              ]
            )
          : new ethers.utils.Interface(LOAN_BOOK_ABI).encodeFunctionData(
              args.contractMethod,
              [
                args.walletAddress,
                borrowAssetAddress,
                collateralAssetAddress,
                ethers.utils.parseUnits(
                  String(args.executionPayload.principalAmount ?? "0"),
                  args.borrowAsset?.decimals ?? 18
                ),
                ethers.utils.parseUnits(
                  String(args.executionPayload.collateralAmount ?? "0"),
                  args.collateralAsset?.decimals ?? 18
                ),
                ethers.utils.parseUnits(
                  String(args.executionPayload.serviceFeeAmount ?? "0"),
                  args.borrowAsset?.decimals ?? 18
                ),
                ethers.utils.parseUnits(
                  String(args.executionPayload.installmentAmount ?? "0"),
                  args.borrowAsset?.decimals ?? 18
                ),
                Number(args.executionPayload.installmentCount ?? 0),
                Number(args.executionPayload.termMonths ?? 0),
                Boolean(args.executionPayload.autopayEnabled ?? false)
              ]
            );

      return {
        calldata,
        calldataHash: ethers.utils.keccak256(calldata),
        methodSelector: calldata.slice(0, 10)
      };
    }

    if (
      args.executionType ===
      GovernedTreasuryExecutionRequestType.staking_pool_creation
    ) {
      const stakingInterface = new ethers.utils.Interface(STAKING_CONTRACT_ABI);
      const calldata = stakingInterface.encodeFunctionData(args.contractMethod, [
        Number(args.executionPayload.rewardRate ?? 0),
        Number(args.executionPayload.stakingPoolId ?? 0)
      ]);

      return {
        calldata,
        calldataHash: ethers.utils.keccak256(calldata),
        methodSelector: calldata.slice(0, 10)
      };
    }

    return {
      calldata: null,
      calldataHash: null,
      methodSelector: null
    };
  }

  private assertVerifiedExecutionReceipt(args: {
    payload: GovernedExecutionReceiptPayload;
    canonicalReceiptText: string;
    receiptHash: string;
    receiptChecksumSha256: string;
    receiptSignature: string;
    receiptSignerAddress: string;
    receiptSignatureAlgorithm: string;
  }): {
    verificationChecksumSha256: string;
  } {
    const verification = verifySignedGovernedExecutionReceipt({
      payload: args.payload,
      canonicalReceiptText: args.canonicalReceiptText,
      receiptHash: args.receiptHash,
      receiptChecksumSha256: args.receiptChecksumSha256,
      receiptSignature: args.receiptSignature,
      receiptSignerAddress: args.receiptSignerAddress,
      receiptSignatureAlgorithm: args.receiptSignatureAlgorithm,
      expectedSignerAddresses: [...this.executorAllowedSignerAddresses]
    });

    if (!verification.verified) {
      throw new ConflictException(
        verification.failureReason ??
          "Governed execution receipt signature could not be verified."
      );
    }

    return {
      verificationChecksumSha256: verification.verificationChecksumSha256
    };
  }

  private async assertOnchainExecutionReceiptMatchesRequest(args: {
    request: ExecutionRequestRecord;
    transactionChainId: number;
    transactionToAddress: string;
    blockchainTransactionHash: string;
  }): Promise<{
    blockNumber: number;
    transactionIndex: number | null;
    calldataHash: string | null;
  }> {
    if (!this.config.requireOnchainExecutorReceiptVerification) {
      return {
        blockNumber: -1,
        transactionIndex: null,
        calldataHash: null
      };
    }

    if (!this.provider) {
      throw new ServiceUnavailableException(
        "Governed execution onchain receipt verification is unavailable because RPC_URL is not configured."
      );
    }

    const receipt = await this.provider.getTransactionReceipt(
      args.blockchainTransactionHash
    );
    const transaction = await this.provider.getTransaction(
      args.blockchainTransactionHash
    );

    if (!receipt) {
      throw new ConflictException(
        "Governed execution transaction receipt was not found onchain."
      );
    }

    if (Number(receipt.status ?? 0) !== 1) {
      throw new ConflictException(
        "Governed execution transaction receipt indicates a failed onchain transaction."
      );
    }

    const observedToAddress =
      this.normalizeOptionalString(receipt.to)?.toLowerCase() ??
      this.normalizeOptionalString(args.transactionToAddress)?.toLowerCase();
    const expectedToAddress =
      this.normalizeOptionalString(args.transactionToAddress)?.toLowerCase();

    if (expectedToAddress && observedToAddress !== expectedToAddress) {
      throw new ConflictException(
        "Governed execution onchain receipt target does not match the execution request."
      );
    }

    if (args.transactionChainId !== args.request.chainId) {
      throw new ConflictException(
        "Governed execution onchain receipt chain id does not match the execution request."
      );
    }

    const observedCalldata = this.normalizeOptionalString(transaction?.data);
    const observedCalldataHash = observedCalldata
      ? ethers.utils.keccak256(observedCalldata)
      : null;

    if (
      args.request.expectedExecutionCalldataHash &&
      observedCalldataHash !== args.request.expectedExecutionCalldataHash
    ) {
      throw new ConflictException(
        "Governed execution onchain transaction calldata does not match the expected execution binding."
      );
    }

    if (
      args.request.expectedExecutionMethodSelector &&
      observedCalldata?.slice(0, 10) !== args.request.expectedExecutionMethodSelector
    ) {
      throw new ConflictException(
        "Governed execution onchain transaction method selector does not match the expected execution binding."
      );
    }

    return {
      blockNumber: Number(receipt.blockNumber),
      transactionIndex:
        typeof receipt.transactionIndex === "number"
          ? receipt.transactionIndex
          : null,
      calldataHash: observedCalldataHash
    };
  }

  private assertCanRequest(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole ?? undefined,
      this.requestAllowedRoles,
      "Operator role is not authorized to request governed execution overrides."
    );
  }

  private assertCanApprove(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole ?? undefined,
      this.approverAllowedRoles,
      "Operator role is not authorized to approve or reject governed execution overrides."
    );
  }

  private mapOverrideProjection(record: OverrideRecord): OverrideProjection {
    return {
      id: record.id,
      environment: record.environment,
      status: record.status,
      allowUnsafeWithdrawalExecution: record.allowUnsafeWithdrawalExecution,
      allowDirectLoanFunding: record.allowDirectLoanFunding,
      allowDirectStakingWrites: record.allowDirectStakingWrites,
      reasonCode: record.reasonCode,
      requestNote: record.requestNote ?? null,
      requestedByOperatorId: record.requestedByOperatorId,
      requestedByOperatorRole: record.requestedByOperatorRole,
      requestedAt: record.requestedAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      approvedByOperatorId: record.approvedByOperatorId ?? null,
      approvedByOperatorRole: record.approvedByOperatorRole ?? null,
      approvalNote: record.approvalNote ?? null,
      approvedAt: record.approvedAt?.toISOString() ?? null,
      rejectedByOperatorId: record.rejectedByOperatorId ?? null,
      rejectedByOperatorRole: record.rejectedByOperatorRole ?? null,
      rejectionNote: record.rejectionNote ?? null,
      rejectedAt: record.rejectedAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private mapExecutionRequestProjection(
    record: ExecutionRequestRecord
  ): ExecutionRequestProjection {
    return {
      id: record.id,
      environment: record.environment,
      chainId: record.chainId,
      executionType: record.executionType,
      status: record.status,
      targetType: record.targetType,
      targetId: record.targetId,
      loanAgreementId: record.loanAgreementId ?? null,
      stakingPoolGovernanceRequestId:
        record.stakingPoolGovernanceRequestId ?? null,
      contractAddress: record.contractAddress ?? null,
      contractMethod: record.contractMethod,
      walletAddress: record.walletAddress ?? null,
      requestNote: record.requestNote ?? null,
      requestedByActorType: record.requestedByActorType,
      requestedByActorId: record.requestedByActorId,
      requestedByActorRole: record.requestedByActorRole ?? null,
      requestedAt: record.requestedAt.toISOString(),
      executedByActorType: record.executedByActorType ?? null,
      executedByActorId: record.executedByActorId ?? null,
      executedByActorRole: record.executedByActorRole ?? null,
      executedAt: record.executedAt?.toISOString() ?? null,
      blockchainTransactionHash: record.blockchainTransactionHash ?? null,
      externalExecutionReference: record.externalExecutionReference ?? null,
      failureReason: record.failureReason ?? null,
      failedAt: record.failedAt?.toISOString() ?? null,
      metadata: record.metadata ?? null,
      executionPayload: record.executionPayload,
      executionResult: record.executionResult ?? null,
      canonicalExecutionPayload: record.canonicalExecutionPayload ?? null,
      canonicalExecutionPayloadText: record.canonicalExecutionPayloadText ?? null,
      executionPackageHash: record.executionPackageHash ?? null,
      executionPackageChecksumSha256:
        record.executionPackageChecksumSha256 ?? null,
      executionPackageSignature: record.executionPackageSignature ?? null,
      executionPackageSignatureAlgorithm:
        record.executionPackageSignatureAlgorithm ?? null,
      executionPackageSignerAddress:
        record.executionPackageSignerAddress ?? null,
      executionPackagePublishedAt:
        record.executionPackagePublishedAt?.toISOString() ?? null,
      claimedByWorkerId: record.claimedByWorkerId ?? null,
      claimedAt: record.claimedAt?.toISOString() ?? null,
      claimExpiresAt: record.claimExpiresAt?.toISOString() ?? null,
      dispatchStatus: record.dispatchStatus,
      dispatchPreparedAt: record.dispatchPreparedAt?.toISOString() ?? null,
      dispatchedByWorkerId: record.dispatchedByWorkerId ?? null,
      dispatchReference: record.dispatchReference ?? null,
      dispatchVerificationChecksumSha256:
        record.dispatchVerificationChecksumSha256 ?? null,
      dispatchFailureReason: record.dispatchFailureReason ?? null,
      deliveryStatus: record.deliveryStatus,
      deliveryAttemptedAt: record.deliveryAttemptedAt?.toISOString() ?? null,
      deliveryAcceptedAt: record.deliveryAcceptedAt?.toISOString() ?? null,
      deliveredByWorkerId: record.deliveredByWorkerId ?? null,
      deliveryBackendType: record.deliveryBackendType ?? null,
      deliveryBackendReference: record.deliveryBackendReference ?? null,
      deliveryHttpStatus: record.deliveryHttpStatus ?? null,
      deliveryFailureReason: record.deliveryFailureReason ?? null,
      expectedExecutionCalldata: record.expectedExecutionCalldata ?? null,
      expectedExecutionCalldataHash:
        record.expectedExecutionCalldataHash ?? null,
      expectedExecutionMethodSelector:
        record.expectedExecutionMethodSelector ?? null,
      claimedByExecutorId: record.claimedByExecutorId ?? null,
      executorClaimedAt: record.executorClaimedAt?.toISOString() ?? null,
      executorClaimExpiresAt:
        record.executorClaimExpiresAt?.toISOString() ?? null,
      executorReceiptSubmittedAt:
        record.executorReceiptSubmittedAt?.toISOString() ?? null,
      updatedAt: record.updatedAt.toISOString(),
      asset: record.asset
        ? {
            id: record.asset.id,
            symbol: record.asset.symbol,
            displayName: record.asset.displayName,
            decimals: record.asset.decimals,
            chainId: record.asset.chainId
          }
        : null,
      loanAgreement: record.loanAgreement
        ? {
            id: record.loanAgreement.id,
            status: record.loanAgreement.status,
            contractLoanId: record.loanAgreement.contractLoanId ?? null,
            contractAddress: record.loanAgreement.contractAddress ?? null
          }
        : null,
      stakingPoolGovernanceRequest: record.stakingPoolGovernanceRequest
        ? {
            id: record.stakingPoolGovernanceRequest.id,
            status: record.stakingPoolGovernanceRequest.status,
            rewardRate: record.stakingPoolGovernanceRequest.rewardRate,
            stakingPoolId:
              record.stakingPoolGovernanceRequest.stakingPoolId ?? null
          }
        : null
    };
  }

  private async expireStaleOverrides(now: Date): Promise<void> {
    const expired = await this.prismaService.governedExecutionOverrideRequest.updateMany({
      where: {
        environment: this.environment,
        status: {
          in: [
            GovernedExecutionOverrideRequestStatus.pending_approval,
            GovernedExecutionOverrideRequestStatus.approved
          ]
        },
        expiresAt: {
          lt: now
        }
      },
      data: {
        status: GovernedExecutionOverrideRequestStatus.expired
      }
    });

    if (expired.count > 0) {
      await this.prismaService.auditEvent.create({
        data: {
          customerId: null,
          actorType: "system",
          actorId: null,
          action: "governed_execution.override.expired",
          targetType: "GovernedExecutionOverrideRequest",
          targetId: null,
          metadata: {
            environment: this.environment,
            expiredCount: expired.count
          } as PrismaJsonValue
        }
      });
    }
  }

  private async findOverrideRecords(now: Date): Promise<OverrideRecord[]> {
    await this.expireStaleOverrides(now);

    return this.prismaService.governedExecutionOverrideRequest.findMany({
      where: {
        environment: this.environment
      },
      orderBy: {
        requestedAt: "desc"
      },
      take: 12
    });
  }

  private async findExecutionRequestRecords(
    limit: number
  ): Promise<ExecutionRequestRecord[]> {
    return this.prismaService.governedTreasuryExecutionRequest.findMany({
      where: {
        environment: this.environment
      },
      include: executionRequestInclude,
      orderBy: {
        requestedAt: "desc"
      },
      take: limit
    });
  }

  private buildExecutionPackagePayload(
    record: ExecutionRequestRecord
  ): GovernedExecutionPackagePayload {
    return {
      version: 1,
      requestId: record.id,
      environment: record.environment,
      chainId: record.chainId,
      executionType: record.executionType,
      targetType: record.targetType,
      targetId: record.targetId,
      loanAgreementId: record.loanAgreementId ?? null,
      stakingPoolGovernanceRequestId:
        record.stakingPoolGovernanceRequestId ?? null,
      contractAddress: record.contractAddress ?? null,
      contractMethod: record.contractMethod,
      walletAddress: record.walletAddress ?? null,
      asset: record.asset
        ? {
            id: record.asset.id,
            symbol: record.asset.symbol,
            displayName: record.asset.displayName,
            decimals: record.asset.decimals,
            chainId: record.asset.chainId
          }
        : null,
      loanAgreement: record.loanAgreement
        ? {
            id: record.loanAgreement.id,
            status: record.loanAgreement.status,
            contractLoanId: record.loanAgreement.contractLoanId ?? null,
            contractAddress: record.loanAgreement.contractAddress ?? null
          }
        : null,
      stakingPoolGovernanceRequest: record.stakingPoolGovernanceRequest
        ? {
            id: record.stakingPoolGovernanceRequest.id,
            status: record.stakingPoolGovernanceRequest.status,
            rewardRate: record.stakingPoolGovernanceRequest.rewardRate,
            stakingPoolId:
              record.stakingPoolGovernanceRequest.stakingPoolId ?? null
          }
        : null,
      executionPayload: record.executionPayload,
      requestedByActorType: record.requestedByActorType,
      requestedByActorId: record.requestedByActorId,
      requestedByActorRole: record.requestedByActorRole ?? null,
      requestedAt: record.requestedAt.toISOString()
    };
  }

  private classifyReserveWallet(record: ReserveWalletRecord): {
    governanceStatus: "governed" | "unsafe";
    governanceReason: string;
  } {
    if (this.governedReserveCustodyTypes.has(record.custodyType)) {
      return {
        governanceStatus: "governed",
        governanceReason:
          record.custodyType === WalletCustodyType.contract_controlled
            ? "Reserve wallet executes through contract-controlled policy enforcement."
            : "Reserve wallet is held under multisig-controlled custody."
      };
    }

    return {
      governanceStatus: "unsafe",
      governanceReason:
        record.custodyType === WalletCustodyType.platform_managed
          ? "Reserve wallet depends on application-managed key custody."
          : "Reserve wallet custody type is not accepted as governed reserve custody."
    };
  }

  private buildGovernanceProjection(
    operator: OperatorContext
  ): GovernedExecutionWorkspaceResult["governance"] {
    const normalizedRole = operator.operatorRole?.trim().toLowerCase() ?? null;

    return {
      currentOperator: {
        operatorId: operator.operatorId,
        operatorRole: normalizedRole,
        canRequestOverride: normalizedRole
          ? this.requestAllowedRoles.includes(normalizedRole)
          : false,
        canApproveOverride: normalizedRole
          ? this.approverAllowedRoles.includes(normalizedRole)
          : false
      },
      requestAllowedOperatorRoles: [...this.requestAllowedRoles],
      approverAllowedOperatorRoles: [...this.approverAllowedRoles]
    };
  }

  private async getActiveApprovedOverrides(now: Date): Promise<OverrideRecord[]> {
    await this.expireStaleOverrides(now);

    return this.prismaService.governedExecutionOverrideRequest.findMany({
      where: {
        environment: this.environment,
        status: GovernedExecutionOverrideRequestStatus.approved,
        expiresAt: {
          gt: now
        }
      },
      orderBy: {
        approvedAt: "desc"
      }
    });
  }

  private hasOverride(
    overrides: OverrideRecord[],
    scope:
      | "allowUnsafeWithdrawalExecution"
      | "allowDirectLoanFunding"
      | "allowDirectStakingWrites"
  ): boolean {
    return overrides.some((record) => record[scope]);
  }

  isLoanFundingGovernedExternalEnabled(): boolean {
    return this.config.loanFundingExecutionMode === "governed_external";
  }

  isStakingWriteGovernedExternalEnabled(): boolean {
    return this.config.stakingWriteExecutionMode === "governed_external";
  }

  async getWorkspace(operator: OperatorContext): Promise<GovernedExecutionWorkspaceResult> {
    const now = new Date();
    const [reserveWallets, overrideRecords, managedWorkers, executionRequests] =
      await Promise.all([
      this.prismaService.wallet.findMany({
        where: {
          kind: {
            in: [...RESERVE_WALLET_KINDS]
          },
          status: WalletStatus.active
        },
        include: walletInclude,
        orderBy: [{ kind: "asc" }, { updatedAt: "desc" }]
      }),
      this.findOverrideRecords(now),
      this.prismaService.workerRuntimeHeartbeat.findMany({
        where: {
          environment: this.environment,
          executionMode: WorkerRuntimeExecutionMode.managed
        },
        orderBy: {
          lastHeartbeatAt: "desc"
        },
        take: 6
      }),
      this.findExecutionRequestRecords(20)
    ]);

    const activeApprovedOverrides = overrideRecords.filter(
      (record) =>
        record.status === GovernedExecutionOverrideRequestStatus.approved &&
        record.expiresAt.getTime() > now.getTime()
    );
    const latestPendingOverrideRequest =
      overrideRecords.find(
        (record) =>
          record.status ===
          GovernedExecutionOverrideRequestStatus.pending_approval
      ) ?? null;
    const latestPendingExecutionRequest =
      executionRequests.find(
        (record) =>
          record.status ===
          GovernedTreasuryExecutionRequestStatus.pending_execution
      ) ?? null;
    const reserveWalletProjections = reserveWallets.map((record) => {
      const classification = this.classifyReserveWallet(record);

      return {
        id: record.id,
        chainId: record.chainId,
        address: record.address,
        kind: record.kind,
        custodyType: record.custodyType,
        status: record.status,
        governanceStatus: classification.governanceStatus,
        governanceReason: classification.governanceReason,
        customerAssignment: record.customerAccount
          ? {
              customerAccountId: record.customerAccount.id,
              accountStatus: record.customerAccount.status,
              email: record.customerAccount.customer?.email ?? null,
              supabaseUserId:
                record.customerAccount.customer?.supabaseUserId ?? null
            }
          : null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      };
    });

    const unsafeReserveWalletCount = reserveWalletProjections.filter(
      (record) => record.governanceStatus === "unsafe"
    ).length;
    const contractControlledReserveWalletCount = reserveWalletProjections.filter(
      (record) => record.custodyType === WalletCustodyType.contract_controlled
    ).length;
    const multisigControlledReserveWalletCount = reserveWalletProjections.filter(
      (record) => record.custodyType === WalletCustodyType.multisig_controlled
    ).length;
    const policyControlledReadyWorkerCount = managedWorkers.filter((record) =>
      readMetadataBoolean(record.runtimeMetadata, "policyControlledWithdrawalReady")
    ).length;

    const reasons: GovernedExecutionWorkspaceResult["posture"]["reasons"] = [];

    if (
      this.config.governedExecutionRequiredInProduction &&
      this.environment === WorkerRuntimeEnvironment.production &&
      unsafeReserveWalletCount > 0 &&
      !this.hasOverride(activeApprovedOverrides, "allowUnsafeWithdrawalExecution")
    ) {
      reasons.push({
        code: "unsafe_reserve_wallet_custody",
        severity: "critical",
        summary:
          "Active reserve wallets still rely on non-governed custody types."
      });
    }

    if (
      this.environment === WorkerRuntimeEnvironment.production &&
      contractControlledReserveWalletCount > 0 &&
      policyControlledReadyWorkerCount === 0 &&
      !this.hasOverride(activeApprovedOverrides, "allowUnsafeWithdrawalExecution")
    ) {
      reasons.push({
        code: "policy_controlled_worker_not_ready",
        severity: "critical",
        summary:
          "Contract-controlled reserve wallets exist, but no managed worker is reporting policy-controlled withdrawal readiness."
      });
    }

    if (
      this.environment === WorkerRuntimeEnvironment.production &&
      this.config.loanFundingExecutionMode !== "governed_external" &&
      !this.hasOverride(activeApprovedOverrides, "allowDirectLoanFunding")
    ) {
      reasons.push({
        code: "loan_funding_not_governed",
        severity: "critical",
        summary:
          "Loan funding still depends on direct application key execution."
      });
    }

    if (
      this.environment === WorkerRuntimeEnvironment.production &&
      this.config.stakingWriteExecutionMode !== "governed_external" &&
      !this.hasOverride(activeApprovedOverrides, "allowDirectStakingWrites")
    ) {
      reasons.push({
        code: "staking_writes_not_governed",
        severity: "critical",
        summary:
          "Staking writes still depend on direct application key execution."
      });
    }

    if (
      latestPendingOverrideRequest &&
      reasons.every((reason) => reason.severity !== "critical")
    ) {
      reasons.push({
        code: "override_pending_approval",
        severity: "warning",
        summary: "A governed execution override is awaiting approval."
      });
    }

    const status = reasons.some((reason) => reason.severity === "critical")
      ? "critical"
      : reasons.length > 0
        ? "warning"
        : "healthy";

    return {
      generatedAt: now.toISOString(),
      environment: this.environment,
      policy: {
        governedExecutionRequiredInProduction:
          this.config.governedExecutionRequiredInProduction,
        governedReserveCustodyTypes: [...this.config.governedReserveCustodyTypes],
        loanFundingExecutionMode: this.config.loanFundingExecutionMode,
        stakingWriteExecutionMode: this.config.stakingWriteExecutionMode,
        overrideMaxHours: this.config.overrideMaxHours,
        executionClaimLeaseSeconds: this.config.executionClaimLeaseSeconds,
        executorClaimLeaseSeconds: this.config.executorClaimLeaseSeconds,
        executorDeliveryBackendType: this.config.executorDeliveryBackendType
      },
      posture: {
        status,
        reasons,
        totalReserveWalletCount: reserveWalletProjections.length,
        governedReserveWalletCount:
          reserveWalletProjections.length - unsafeReserveWalletCount,
        unsafeReserveWalletCount,
        contractControlledReserveWalletCount,
        multisigControlledReserveWalletCount,
        policyControlledReadyWorkerCount,
        managedWorkerCount: managedWorkers.length,
        activeApprovedOverrideCount: activeApprovedOverrides.length,
        pendingOverrideCount: overrideRecords.filter(
          (record) =>
            record.status ===
            GovernedExecutionOverrideRequestStatus.pending_approval
        ).length
      },
      reserveWallets: reserveWalletProjections,
      latestPendingOverrideRequest: latestPendingOverrideRequest
        ? this.mapOverrideProjection(latestPendingOverrideRequest)
        : null,
      activeApprovedOverrides: activeApprovedOverrides.map((record) =>
        this.mapOverrideProjection(record)
      ),
      recentOverrideRequests: overrideRecords.map((record) =>
        this.mapOverrideProjection(record)
      ),
      latestPendingExecutionRequest: latestPendingExecutionRequest
        ? this.mapExecutionRequestProjection(latestPendingExecutionRequest)
        : null,
      recentExecutionRequests: executionRequests.map((record) =>
        this.mapExecutionRequestProjection(record)
      ),
      governance: this.buildGovernanceProjection(operator)
    };
  }

  async publishExecutionPackage(
    requestId: string,
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: ExecutionRequestProjection;
    workspace: GovernedExecutionWorkspaceResult;
    stateReused: boolean;
  }> {
    const normalizedOperatorRole = this.assertCanApprove(operator.operatorRole);

    const result = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      if (request.status === GovernedTreasuryExecutionRequestStatus.cancelled) {
        throw new ConflictException(
          "Cancelled governed treasury execution requests cannot be published."
        );
      }

      if (request.executionPackageHash) {
        return {
          request,
          stateReused: true
        };
      }

      const payload = this.buildExecutionPackagePayload(request);
      const signedPackage = buildSignedGovernedExecutionPackage(
        payload,
        this.executionPackageSignerPrivateKey
      );
      const updated = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          canonicalExecutionPayload: payload as unknown as PrismaJsonValue,
          canonicalExecutionPayloadText: signedPackage.canonicalPayloadText,
          executionPackageHash: signedPackage.executionPackageHash,
          executionPackageChecksumSha256:
            signedPackage.executionPackageChecksumSha256,
          executionPackageSignature: signedPackage.executionPackageSignature,
          executionPackageSignatureAlgorithm:
            signedPackage.executionPackageSignatureAlgorithm,
          executionPackageSignerAddress:
            signedPackage.executionPackageSignerAddress,
          executionPackagePublishedAt: new Date()
        },
        include: executionRequestInclude
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.package_published",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            publishedByOperatorRole: normalizedOperatorRole,
            executionPackageHash: updated.executionPackageHash,
            executionPackageSignerAddress:
              updated.executionPackageSignerAddress
          } as PrismaJsonValue
        }
      });

      return {
        request: updated,
        stateReused: false
      };
    });

    return {
      request: this.mapExecutionRequestProjection(result.request),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      }),
      stateReused: result.stateReused
    };
  }

  async listClaimableExecutionRequests(limit: number): Promise<{
    requests: ExecutionRequestProjection[];
    limit: number;
    generatedAt: string;
  }> {
    const normalizedLimit = Math.max(1, Math.min(limit, 50));
    const now = new Date();
    const records = await this.prismaService.governedTreasuryExecutionRequest.findMany({
      where: {
        environment: this.environment,
        status: {
          in: [
            GovernedTreasuryExecutionRequestStatus.pending_execution,
            GovernedTreasuryExecutionRequestStatus.execution_failed
          ]
        },
        executionPackagePublishedAt: {
          not: null
        },
        dispatchStatus: {
          in: [
            GovernedTreasuryExecutionDispatchStatus.not_dispatched,
            GovernedTreasuryExecutionDispatchStatus.dispatch_failed
          ]
        },
        OR: [
          {
            claimExpiresAt: null
          },
          {
            claimExpiresAt: {
              lt: now
            }
          }
        ]
      },
      include: executionRequestInclude,
      orderBy: {
        requestedAt: "asc"
      },
      take: normalizedLimit
    });

    return {
      requests: records.map((record) => this.mapExecutionRequestProjection(record)),
      limit: normalizedLimit,
      generatedAt: now.toISOString()
    };
  }

  async claimExecutionRequest(
    requestId: string,
    workerId: string,
    reclaimStaleAfterMs?: number
  ): Promise<{
    request: ExecutionRequestProjection;
    claimReused: boolean;
  }> {
    const now = new Date();
    const claimLeaseMs = Math.max(
      reclaimStaleAfterMs ?? this.config.executionClaimLeaseSeconds * 1000,
      1_000
    );
    const claimExpiresAt = new Date(now.getTime() + claimLeaseMs);

    const result = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      if (!request.executionPackagePublishedAt || !request.executionPackageHash) {
        throw new ConflictException(
          "Governed treasury execution request is not yet packaged for external execution."
        );
      }

      if (
        request.dispatchStatus ===
        GovernedTreasuryExecutionDispatchStatus.dispatched
      ) {
        throw new ConflictException(
          "Governed treasury execution request has already been dispatched to the governed executor."
        );
      }

      if (
        request.status !== GovernedTreasuryExecutionRequestStatus.pending_execution &&
        request.status !== GovernedTreasuryExecutionRequestStatus.execution_failed
      ) {
        throw new ConflictException(
          "Governed treasury execution request is no longer claimable."
        );
      }

      if (
        request.claimedByWorkerId === workerId &&
        request.claimExpiresAt &&
        request.claimExpiresAt.getTime() > now.getTime()
      ) {
        return {
          request,
          claimReused: true
        };
      }

      if (
        request.claimedByWorkerId &&
        request.claimedByWorkerId !== workerId &&
        request.claimExpiresAt &&
        request.claimExpiresAt.getTime() > now.getTime()
      ) {
        throw new ConflictException(
          "Governed treasury execution request is already claimed by another worker."
        );
      }

      const updated = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          claimedByWorkerId: workerId,
          claimedAt: now,
          claimExpiresAt
        },
        include: executionRequestInclude
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "worker",
          actorId: workerId,
          action: "governed_execution.request.claimed",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            executionPackageHash: updated.executionPackageHash,
            claimExpiresAt: claimExpiresAt.toISOString()
          } as PrismaJsonValue
        }
      });

      return {
        request: updated,
        claimReused: false
      };
    });

    return {
      request: this.mapExecutionRequestProjection(result.request),
      claimReused: result.claimReused
    };
  }

  async dispatchExecutionRequest(
    requestId: string,
    input: {
      dispatchReference?: string;
      dispatchNote?: string;
    },
    workerId: string
  ): Promise<{
    request: ExecutionRequestProjection;
    dispatchRecorded: boolean;
    verificationSucceeded: boolean;
    verificationFailureReason: string | null;
  }> {
    const now = new Date();
    const dispatchReference =
      this.normalizeOptionalString(input.dispatchReference) ??
      `worker:${workerId}:${requestId}:${now.toISOString()}`;
    const dispatchNote = this.normalizeOptionalString(input.dispatchNote);

    const result = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      if (
        request.status !== GovernedTreasuryExecutionRequestStatus.pending_execution &&
        request.status !== GovernedTreasuryExecutionRequestStatus.execution_failed
      ) {
        throw new ConflictException(
          "Governed treasury execution request is no longer dispatchable."
        );
      }

      if (
        request.dispatchStatus ===
          GovernedTreasuryExecutionDispatchStatus.dispatched &&
        request.dispatchReference
      ) {
        return {
          request,
          dispatchRecorded: false,
          verificationSucceeded: true,
          verificationFailureReason: null
        };
      }

      if (request.claimedByWorkerId !== workerId) {
        throw new ConflictException(
          "Governed treasury execution request must be claimed by the current worker before dispatch."
        );
      }

      if (
        !request.claimExpiresAt ||
        request.claimExpiresAt.getTime() <= now.getTime()
      ) {
        throw new ConflictException(
          "Governed treasury execution request claim lease has expired."
        );
      }

      const payload = this.buildExecutionPackagePayload(request);

      if (
        !request.canonicalExecutionPayloadText ||
        !request.executionPackageHash ||
        !request.executionPackageChecksumSha256 ||
        !request.executionPackageSignature ||
        !request.executionPackageSignerAddress ||
        !request.executionPackageSignatureAlgorithm
      ) {
        throw new ConflictException(
          "Governed treasury execution request does not have a complete execution package."
        );
      }

      const verification = verifySignedGovernedExecutionPackage({
        payload,
        canonicalPayloadText: request.canonicalExecutionPayloadText,
        executionPackageHash: request.executionPackageHash,
        executionPackageChecksumSha256:
          request.executionPackageChecksumSha256,
        executionPackageSignature: request.executionPackageSignature,
        executionPackageSignerAddress:
          request.executionPackageSignerAddress,
        executionPackageSignatureAlgorithm:
          request.executionPackageSignatureAlgorithm
      });

      const nextDispatchStatus = verification.verified
        ? GovernedTreasuryExecutionDispatchStatus.dispatched
        : GovernedTreasuryExecutionDispatchStatus.dispatch_failed;
      const updated = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          dispatchStatus: nextDispatchStatus,
          dispatchPreparedAt: now,
          dispatchedByWorkerId: workerId,
          dispatchReference,
          dispatchVerificationChecksumSha256:
            verification.verificationChecksumSha256,
          dispatchFailureReason: verification.failureReason ?? undefined,
          deliveryStatus:
            nextDispatchStatus ===
            GovernedTreasuryExecutionDispatchStatus.dispatched
              ? GovernedTreasuryExecutionDeliveryStatus.not_delivered
              : GovernedTreasuryExecutionDeliveryStatus.delivery_failed,
          deliveryAttemptedAt: null,
          deliveryAcceptedAt: null,
          deliveredByWorkerId: null,
          deliveryBackendType: null,
          deliveryBackendReference: null,
          deliveryHttpStatus: null,
          deliveryFailureReason: verification.verified
            ? null
            : verification.failureReason ?? null,
          claimedByWorkerId: null,
          claimedAt: null,
          claimExpiresAt: null,
          metadata: {
            ...(isRecord(request.metadata) ? request.metadata : {}),
            latestDispatchNote: dispatchNote ?? null
          } as PrismaJsonValue
        },
        include: executionRequestInclude
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "worker",
          actorId: workerId,
          action: verification.verified
            ? "governed_execution.request.dispatched"
            : "governed_execution.request.dispatch_failed",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            dispatchReference,
            dispatchNote,
            executionPackageHash: updated.executionPackageHash,
            verificationChecksumSha256:
              verification.verificationChecksumSha256,
            verificationFailureReason: verification.failureReason
          } as PrismaJsonValue
        }
      });

      return {
        request: updated,
        dispatchRecorded: true,
        verificationSucceeded: verification.verified,
        verificationFailureReason: verification.failureReason
      };
    });

    return {
      request: this.mapExecutionRequestProjection(result.request),
      dispatchRecorded: result.dispatchRecorded,
      verificationSucceeded: result.verificationSucceeded,
      verificationFailureReason: result.verificationFailureReason
    };
  }

  private assertDeliveryRecordable(args: {
    request: ExecutionRequestRecord;
    workerId: string;
    dispatchReference: string;
  }): void {
    if (
      args.request.dispatchStatus !==
      GovernedTreasuryExecutionDispatchStatus.dispatched
    ) {
      throw new ConflictException(
        "Governed treasury execution request has not been dispatched."
      );
    }

    if (args.request.dispatchReference !== args.dispatchReference) {
      throw new ConflictException(
        "Governed treasury execution delivery result does not match the active dispatch reference."
      );
    }

    if (
      args.request.dispatchedByWorkerId &&
      args.request.dispatchedByWorkerId !== args.workerId
    ) {
      throw new ConflictException(
        "Governed treasury execution delivery result must be recorded by the worker that dispatched the request."
      );
    }
  }

  async recordExecutionDeliveryAccepted(
    requestId: string,
    input: {
      dispatchReference: string;
      deliveryBackendType: string;
      deliveryBackendReference?: string;
      deliveryHttpStatus?: number;
      deliveryNote?: string;
    },
    workerId: string
  ): Promise<{
    request: ExecutionRequestProjection;
    deliveryRecorded: boolean;
    stateReused: boolean;
  }> {
    const deliveryBackendType = this.normalizeOptionalString(
      input.deliveryBackendType
    );
    const deliveryBackendReference = this.normalizeOptionalString(
      input.deliveryBackendReference
    );
    const deliveryNote = this.normalizeOptionalString(input.deliveryNote);

    if (!deliveryBackendType) {
      throw new BadRequestException("deliveryBackendType is required.");
    }

    const now = new Date();
    const result = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      this.assertDeliveryRecordable({
        request,
        workerId,
        dispatchReference: input.dispatchReference
      });

      if (
        request.deliveryStatus ===
          GovernedTreasuryExecutionDeliveryStatus.accepted_by_executor &&
        request.deliveryBackendType === deliveryBackendType &&
        request.deliveryBackendReference === deliveryBackendReference
      ) {
        return {
          request,
          deliveryRecorded: false,
          stateReused: true
        };
      }

      const updated = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          deliveryStatus:
            GovernedTreasuryExecutionDeliveryStatus.accepted_by_executor,
          deliveryAttemptedAt: now,
          deliveryAcceptedAt: now,
          deliveredByWorkerId: workerId,
          deliveryBackendType,
          deliveryBackendReference: deliveryBackendReference ?? undefined,
          deliveryHttpStatus: input.deliveryHttpStatus ?? undefined,
          deliveryFailureReason: null,
          metadata: {
            ...(isRecord(request.metadata) ? request.metadata : {}),
            latestDeliveryNote: deliveryNote ?? null
          } as PrismaJsonValue
        },
        include: executionRequestInclude
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "worker",
          actorId: workerId,
          action: "governed_execution.request.delivery_accepted",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            dispatchReference: updated.dispatchReference,
            deliveryBackendType,
            deliveryBackendReference,
            deliveryHttpStatus: input.deliveryHttpStatus ?? null,
            deliveryNote
          } as PrismaJsonValue
        }
      });

      return {
        request: updated,
        deliveryRecorded: true,
        stateReused: false
      };
    });

    return {
      request: this.mapExecutionRequestProjection(result.request),
      deliveryRecorded: result.deliveryRecorded,
      stateReused: result.stateReused
    };
  }

  async recordExecutionDeliveryFailed(
    requestId: string,
    input: {
      dispatchReference: string;
      deliveryBackendType: string;
      deliveryFailureReason: string;
      deliveryHttpStatus?: number;
      deliveryBackendReference?: string;
      deliveryNote?: string;
    },
    workerId: string
  ): Promise<{
    request: ExecutionRequestProjection;
    deliveryRecorded: boolean;
  }> {
    const deliveryBackendType = this.normalizeOptionalString(
      input.deliveryBackendType
    );
    const deliveryFailureReason = this.normalizeOptionalString(
      input.deliveryFailureReason
    );
    const deliveryBackendReference = this.normalizeOptionalString(
      input.deliveryBackendReference
    );
    const deliveryNote = this.normalizeOptionalString(input.deliveryNote);

    if (!deliveryBackendType) {
      throw new BadRequestException("deliveryBackendType is required.");
    }

    if (!deliveryFailureReason) {
      throw new BadRequestException("deliveryFailureReason is required.");
    }

    const now = new Date();
    const result = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      this.assertDeliveryRecordable({
        request,
        workerId,
        dispatchReference: input.dispatchReference
      });

      const updated = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          deliveryStatus:
            GovernedTreasuryExecutionDeliveryStatus.delivery_failed,
          deliveryAttemptedAt: now,
          deliveryAcceptedAt: null,
          deliveredByWorkerId: workerId,
          deliveryBackendType,
          deliveryBackendReference: deliveryBackendReference ?? undefined,
          deliveryHttpStatus: input.deliveryHttpStatus ?? undefined,
          deliveryFailureReason,
          metadata: {
            ...(isRecord(request.metadata) ? request.metadata : {}),
            latestDeliveryNote: deliveryNote ?? null
          } as PrismaJsonValue
        },
        include: executionRequestInclude
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "worker",
          actorId: workerId,
          action: "governed_execution.request.delivery_failed",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            dispatchReference: updated.dispatchReference,
            deliveryBackendType,
            deliveryBackendReference,
            deliveryHttpStatus: input.deliveryHttpStatus ?? null,
            deliveryFailureReason,
            deliveryNote
          } as PrismaJsonValue
        }
      });

      return {
        request: updated,
        deliveryRecorded: true
      };
    });

    return {
      request: this.mapExecutionRequestProjection(result.request),
      deliveryRecorded: result.deliveryRecorded
    };
  }

  async listExecutorReadyExecutionRequests(limit: number): Promise<{
    requests: ExecutionRequestProjection[];
    limit: number;
    generatedAt: string;
  }> {
    const normalizedLimit = Math.max(1, Math.min(limit, 50));
    const now = new Date();
    const records = await this.prismaService.governedTreasuryExecutionRequest.findMany({
      where: {
        environment: this.environment,
        status: {
          in: [
            GovernedTreasuryExecutionRequestStatus.pending_execution,
            GovernedTreasuryExecutionRequestStatus.execution_failed
          ]
        },
        dispatchStatus: GovernedTreasuryExecutionDispatchStatus.dispatched,
        deliveryStatus: {
          in: [
            GovernedTreasuryExecutionDeliveryStatus.not_delivered,
            GovernedTreasuryExecutionDeliveryStatus.delivery_failed
          ]
        },
        OR: [
          {
            executorClaimExpiresAt: null
          },
          {
            executorClaimExpiresAt: {
              lt: now
            }
          }
        ]
      },
      include: executionRequestInclude,
      orderBy: {
        requestedAt: "asc"
      },
      take: normalizedLimit
    });

    return {
      requests: records.map((record) => this.mapExecutionRequestProjection(record)),
      limit: normalizedLimit,
      generatedAt: now.toISOString()
    };
  }

  async claimExecutionForExecutor(
    requestId: string,
    executorId: string,
    reclaimStaleAfterMs?: number
  ): Promise<{
    request: ExecutionRequestProjection;
    claimReused: boolean;
  }> {
    const now = new Date();
    const claimLeaseMs = Math.max(
      reclaimStaleAfterMs ?? this.config.executorClaimLeaseSeconds * 1000,
      1_000
    );
    const executorClaimExpiresAt = new Date(now.getTime() + claimLeaseMs);

    const result = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      if (
        request.dispatchStatus !==
        GovernedTreasuryExecutionDispatchStatus.dispatched
      ) {
        throw new ConflictException(
          "Governed treasury execution request is not ready for governed executor pickup."
        );
      }

      if (
        request.deliveryStatus ===
        GovernedTreasuryExecutionDeliveryStatus.accepted_by_executor
      ) {
        throw new ConflictException(
          "Governed treasury execution request has already been delivered to the governed executor backend."
        );
      }

      if (
        request.status !== GovernedTreasuryExecutionRequestStatus.pending_execution &&
        request.status !== GovernedTreasuryExecutionRequestStatus.execution_failed
      ) {
        throw new ConflictException(
          "Governed treasury execution request is no longer executable."
        );
      }

      if (
        request.claimedByExecutorId === executorId &&
        request.executorClaimExpiresAt &&
        request.executorClaimExpiresAt.getTime() > now.getTime()
      ) {
        return {
          request,
          claimReused: true
        };
      }

      if (
        request.claimedByExecutorId &&
        request.claimedByExecutorId !== executorId &&
        request.executorClaimExpiresAt &&
        request.executorClaimExpiresAt.getTime() > now.getTime()
      ) {
        throw new ConflictException(
          "Governed treasury execution request is already claimed by another governed executor."
        );
      }

      const updated = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          claimedByExecutorId: executorId,
          executorClaimedAt: now,
          executorClaimExpiresAt
        },
        include: executionRequestInclude
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "system",
          actorId: executorId,
          action: "governed_execution.executor.claimed",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            dispatchReference: updated.dispatchReference,
            executorClaimExpiresAt: executorClaimExpiresAt.toISOString()
          } as PrismaJsonValue
        }
      });

      return {
        request: updated,
        claimReused: false
      };
    });

    return {
      request: this.mapExecutionRequestProjection(result.request),
      claimReused: result.claimReused
    };
  }

  private assertExecutorReceiptMatchesRequest(
    request: ExecutionRequestRecord,
    input: {
      dispatchReference: string;
      transactionChainId: number;
      transactionToAddress: string;
    }
  ): void {
    const dispatchReference = this.normalizeOptionalString(input.dispatchReference);
    const transactionToAddress = this.normalizeOptionalString(
      input.transactionToAddress
    )?.toLowerCase();

    if (!dispatchReference || dispatchReference !== request.dispatchReference) {
      throw new ConflictException(
        "Governed executor receipt does not match the active dispatch reference."
      );
    }

    if (input.transactionChainId !== request.chainId) {
      throw new ConflictException(
        "Governed executor receipt chain id does not match the execution request."
      );
    }

    const expectedToAddress =
      this.normalizeOptionalString(request.contractAddress)?.toLowerCase() ??
      this.normalizeOptionalString(request.walletAddress)?.toLowerCase();

    if (expectedToAddress && transactionToAddress !== expectedToAddress) {
      throw new ConflictException(
        "Governed executor receipt target address does not match the execution request."
      );
    }
  }

  private assertExecutorCallbackAuthorized(args: {
    request: ExecutionRequestRecord;
    executorId: string;
    externalExecutionReference?: string | null;
  }): void {
    if (
      args.request.claimedByExecutorId === args.executorId &&
      args.request.executorClaimExpiresAt &&
      args.request.executorClaimExpiresAt.getTime() > Date.now()
    ) {
      return;
    }

    if (
      args.request.deliveryStatus !==
      GovernedTreasuryExecutionDeliveryStatus.accepted_by_executor
    ) {
      throw new ConflictException(
        "Governed treasury execution request is not claimed by this governed executor."
      );
    }

    if (
      args.request.deliveryBackendReference &&
      this.normalizeOptionalString(args.externalExecutionReference) !==
        args.request.deliveryBackendReference
    ) {
      throw new ConflictException(
        "Governed executor callback does not match the accepted delivery backend reference."
      );
    }
  }

  async recordExecutionSuccessFromExecutor(
    requestId: string,
    input: {
      dispatchReference: string;
      transactionChainId: number;
      transactionToAddress: string;
      blockchainTransactionHash: string;
      externalExecutionReference?: string;
      contractLoanId?: string;
      contractAddress?: string;
      executionNote?: string;
      notedAt: string;
      canonicalReceiptText: string;
      receiptHash: string;
      receiptChecksumSha256: string;
      receiptSignature: string;
      receiptSignerAddress: string;
      receiptSignatureAlgorithm: string;
    },
    executorId: string
  ): Promise<{
    request: ExecutionRequestProjection;
  }> {
    const executionNote = this.normalizeOptionalString(input.executionNote);
    const blockchainTransactionHash = this.normalizeOptionalString(
      input.blockchainTransactionHash
    );
    const externalExecutionReference = this.normalizeOptionalString(
      input.externalExecutionReference
    );
    const contractLoanId = this.normalizeOptionalString(input.contractLoanId);
    const contractAddress = this.normalizeOptionalString(input.contractAddress);

    if (!blockchainTransactionHash) {
      throw new BadRequestException(
        "Governed executor success requires a blockchain transaction hash."
      );
    }

    const updated = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      this.assertExecutorCallbackAuthorized({
        request,
        executorId,
        externalExecutionReference
      });

      this.assertExecutorReceiptMatchesRequest(request, input);

      const receiptPayload = this.buildExecutionReceiptPayload({
        request,
        executorId,
        outcome: "executed",
        dispatchReference: input.dispatchReference,
        transactionChainId: input.transactionChainId,
        transactionToAddress: input.transactionToAddress,
        blockchainTransactionHash,
        externalExecutionReference,
        contractLoanId,
        contractAddress,
        notedAt: input.notedAt
      });
      const verification = this.assertVerifiedExecutionReceipt({
        payload: receiptPayload,
        canonicalReceiptText: input.canonicalReceiptText,
        receiptHash: input.receiptHash,
        receiptChecksumSha256: input.receiptChecksumSha256,
        receiptSignature: input.receiptSignature,
        receiptSignerAddress: input.receiptSignerAddress,
        receiptSignatureAlgorithm: input.receiptSignatureAlgorithm
      });
      const onchainReceipt = await this.assertOnchainExecutionReceiptMatchesRequest({
        request,
        transactionChainId: input.transactionChainId,
        transactionToAddress: input.transactionToAddress,
        blockchainTransactionHash
      });

      if (
        request.executionType ===
          GovernedTreasuryExecutionRequestType.loan_contract_creation &&
        !contractLoanId
      ) {
        throw new BadRequestException(
          "Governed executor loan contract creation requires contractLoanId."
        );
      }

      const next = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: GovernedTreasuryExecutionRequestStatus.executed,
          dispatchStatus: GovernedTreasuryExecutionDispatchStatus.dispatched,
          claimedByWorkerId: null,
          claimedAt: null,
          claimExpiresAt: null,
          claimedByExecutorId: null,
          executorClaimedAt: null,
          executorClaimExpiresAt: null,
          executorReceiptSubmittedAt: new Date(),
          executorReceiptPayload: receiptPayload as PrismaJsonValue,
          executorReceiptPayloadText: input.canonicalReceiptText,
          executorReceiptHash: input.receiptHash,
          executorReceiptChecksumSha256: input.receiptChecksumSha256,
          executorReceiptSignature: input.receiptSignature,
          executorReceiptSignatureAlgorithm: input.receiptSignatureAlgorithm,
          executorReceiptSignerAddress: input.receiptSignerAddress,
          executorReceiptVerificationChecksumSha256:
            verification.verificationChecksumSha256,
          executorReceiptVerifiedAt: new Date(),
          executedByActorType: "governed_executor",
          executedByActorId: executorId,
          executedByActorRole: null,
          executedAt: new Date(),
          blockchainTransactionHash: blockchainTransactionHash ?? undefined,
          externalExecutionReference: externalExecutionReference ?? undefined,
          failureReason: null,
          failedAt: null,
          dispatchFailureReason: null,
          contractAddress:
            contractAddress ?? request.contractAddress ?? undefined,
          executionResult: {
            executionNote: executionNote ?? null,
            blockchainTransactionHash: blockchainTransactionHash ?? null,
            externalExecutionReference: externalExecutionReference ?? null,
            contractLoanId: contractLoanId ?? null,
            dispatchReference: request.dispatchReference,
            executorReceiptHash: input.receiptHash,
            executorReceiptSignerAddress: input.receiptSignerAddress,
            onchainReceiptBlockNumber: onchainReceipt.blockNumber,
            onchainReceiptTransactionIndex: onchainReceipt.transactionIndex,
            onchainTransactionCalldataHash: onchainReceipt.calldataHash
          } as PrismaJsonValue
        },
        include: executionRequestInclude
      });

      if (next.loanAgreementId) {
        await transaction.loanAgreement.update({
          where: {
            id: next.loanAgreementId
          },
          data: {
            contractLoanId: contractLoanId ?? undefined,
            contractAddress:
              contractAddress ?? next.contractAddress ?? undefined,
            activationTransactionHash:
              blockchainTransactionHash ?? undefined
          }
        });

        await transaction.loanEvent.create({
          data: {
            loanAgreementId: next.loanAgreementId,
            actorType: "system",
            actorId: executorId,
            actorRole: null,
            eventType: "governed_executor_execution_recorded",
            note:
              executionNote ??
              "Governed executor submitted a successful loan execution receipt.",
            metadata: {
              governedTreasuryExecutionRequestId: next.id,
              blockchainTransactionHash,
              externalExecutionReference,
              contractLoanId,
              dispatchReference: request.dispatchReference
            } as PrismaJsonValue
          }
        });
      }

      if (next.stakingPoolGovernanceRequestId) {
        await transaction.stakingPoolGovernanceRequest.update({
          where: {
            id: next.stakingPoolGovernanceRequestId
          },
          data: {
            status: "executed",
            executedByOperatorId: null,
            executedByOperatorRole: null,
            executionNote: executionNote ?? undefined,
            executionFailureReason: null,
            blockchainTransactionHash: blockchainTransactionHash ?? undefined,
            executedAt: new Date()
          }
        });
      }

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "system",
          actorId: executorId,
          action: "governed_execution.executor.executed",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: next.id,
          metadata: {
            environment: this.environment,
            blockchainTransactionHash,
            externalExecutionReference,
            contractLoanId,
            dispatchReference: request.dispatchReference,
            transactionChainId: input.transactionChainId,
            transactionToAddress: input.transactionToAddress,
            executorReceiptHash: input.receiptHash,
            executorReceiptSignerAddress: input.receiptSignerAddress,
            onchainReceiptBlockNumber: onchainReceipt.blockNumber,
            onchainTransactionCalldataHash: onchainReceipt.calldataHash
          } as PrismaJsonValue
        }
      });

      return next;
    });

    return {
      request: this.mapExecutionRequestProjection(updated)
    };
  }

  async recordExecutionFailureFromExecutor(
    requestId: string,
    input: {
      dispatchReference: string;
      failureReason: string;
      executionNote?: string;
      transactionChainId?: number;
      transactionToAddress?: string;
      blockchainTransactionHash?: string;
      externalExecutionReference?: string;
      notedAt: string;
      canonicalReceiptText: string;
      receiptHash: string;
      receiptChecksumSha256: string;
      receiptSignature: string;
      receiptSignerAddress: string;
      receiptSignatureAlgorithm: string;
    },
    executorId: string
  ): Promise<{
    request: ExecutionRequestProjection;
  }> {
    const failureReason = this.normalizeOptionalString(input.failureReason);
    const executionNote = this.normalizeOptionalString(input.executionNote);
    const blockchainTransactionHash = this.normalizeOptionalString(
      input.blockchainTransactionHash
    );
    const externalExecutionReference = this.normalizeOptionalString(
      input.externalExecutionReference
    );

    if (!failureReason) {
      throw new BadRequestException("failureReason is required.");
    }

    const updated = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      this.assertExecutorCallbackAuthorized({
        request,
        executorId,
        externalExecutionReference
      });

      if (
        input.transactionChainId !== undefined &&
        input.transactionToAddress !== undefined
      ) {
        this.assertExecutorReceiptMatchesRequest(request, {
          dispatchReference: input.dispatchReference,
          transactionChainId: input.transactionChainId,
          transactionToAddress: input.transactionToAddress
        });
      } else if (input.dispatchReference !== request.dispatchReference) {
        throw new ConflictException(
          "Governed executor failure receipt does not match the active dispatch reference."
        );
      }

      const receiptPayload = this.buildExecutionReceiptPayload({
        request,
        executorId,
        outcome: "failed",
        dispatchReference: input.dispatchReference,
        transactionChainId: input.transactionChainId,
        transactionToAddress: input.transactionToAddress,
        blockchainTransactionHash,
        externalExecutionReference,
        failureReason,
        notedAt: input.notedAt
      });
      const verification = this.assertVerifiedExecutionReceipt({
        payload: receiptPayload,
        canonicalReceiptText: input.canonicalReceiptText,
        receiptHash: input.receiptHash,
        receiptChecksumSha256: input.receiptChecksumSha256,
        receiptSignature: input.receiptSignature,
        receiptSignerAddress: input.receiptSignerAddress,
        receiptSignatureAlgorithm: input.receiptSignatureAlgorithm
      });

      const next = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: GovernedTreasuryExecutionRequestStatus.execution_failed,
          dispatchStatus: GovernedTreasuryExecutionDispatchStatus.dispatch_failed,
          claimedByWorkerId: null,
          claimedAt: null,
          claimExpiresAt: null,
          claimedByExecutorId: null,
          executorClaimedAt: null,
          executorClaimExpiresAt: null,
          executorReceiptSubmittedAt: new Date(),
          executorReceiptPayload: receiptPayload as PrismaJsonValue,
          executorReceiptPayloadText: input.canonicalReceiptText,
          executorReceiptHash: input.receiptHash,
          executorReceiptChecksumSha256: input.receiptChecksumSha256,
          executorReceiptSignature: input.receiptSignature,
          executorReceiptSignatureAlgorithm: input.receiptSignatureAlgorithm,
          executorReceiptSignerAddress: input.receiptSignerAddress,
          executorReceiptVerificationChecksumSha256:
            verification.verificationChecksumSha256,
          executorReceiptVerifiedAt: new Date(),
          blockchainTransactionHash: blockchainTransactionHash ?? undefined,
          externalExecutionReference: externalExecutionReference ?? undefined,
          failureReason,
          failedAt: new Date(),
          dispatchFailureReason: failureReason,
          executionResult: {
            executionNote: executionNote ?? null,
            blockchainTransactionHash: blockchainTransactionHash ?? null,
            externalExecutionReference: externalExecutionReference ?? null,
            failureReason,
            dispatchReference: request.dispatchReference,
            executorReceiptHash: input.receiptHash,
            executorReceiptSignerAddress: input.receiptSignerAddress
          } as PrismaJsonValue
        },
        include: executionRequestInclude
      });

      if (next.loanAgreementId) {
        await transaction.loanEvent.create({
          data: {
            loanAgreementId: next.loanAgreementId,
            actorType: "system",
            actorId: executorId,
            actorRole: null,
            eventType: "governed_executor_execution_failed",
            note:
              executionNote ??
              "Governed executor submitted a failed loan execution receipt.",
            metadata: {
              governedTreasuryExecutionRequestId: next.id,
              blockchainTransactionHash,
              externalExecutionReference,
              failureReason,
              dispatchReference: request.dispatchReference
            } as PrismaJsonValue
          }
        });
      }

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "system",
          actorId: executorId,
          action: "governed_execution.executor.execution_failed",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: next.id,
          metadata: {
            environment: this.environment,
            blockchainTransactionHash,
            externalExecutionReference,
            failureReason,
            dispatchReference: request.dispatchReference,
            executorReceiptHash: input.receiptHash,
            executorReceiptSignerAddress: input.receiptSignerAddress
          } as PrismaJsonValue
        }
      });

      return next;
    });

    return {
      request: this.mapExecutionRequestProjection(updated)
    };
  }

  async requestLoanContractCreation(input: {
    loanAgreementId: string;
    chainId: number;
    borrowAssetId: string;
    collateralAssetId: string;
    walletAddress: string | null;
    contractAddress: string | null;
    contractMethod: string;
    borrowerWalletAddress: string | null;
    contractLoanId?: string | null;
    treasuryReceiverAddress?: string | null;
    principalAmount: string;
    collateralAmount: string;
    serviceFeeAmount: string;
    installmentAmount: string;
    installmentCount: number;
    termMonths: number;
    autopayEnabled: boolean;
    requestNote?: string | null;
    requestedByActorType: string;
    requestedByActorId: string;
    requestedByActorRole?: string | null;
  }): Promise<{
    request: ExecutionRequestProjection;
    stateReused: boolean;
  }> {
    const requestNote = this.normalizeOptionalString(input.requestNote);
    const [borrowAsset, collateralAsset] = await Promise.all([
      this.prismaService.asset.findUnique({
        where: {
          id: input.borrowAssetId
        },
        select: {
          assetType: true,
          contractAddress: true,
          decimals: true
        }
      }),
      this.prismaService.asset.findUnique({
        where: {
          id: input.collateralAssetId
        },
        select: {
          assetType: true,
          contractAddress: true,
          decimals: true
        }
      })
    ]);

    const record = await this.prismaService.$transaction(async (transaction) => {
      const existing = await transaction.governedTreasuryExecutionRequest.findFirst({
        where: {
          environment: this.environment,
          loanAgreementId: input.loanAgreementId,
          executionType:
            GovernedTreasuryExecutionRequestType.loan_contract_creation,
          status: {
            in: [
              GovernedTreasuryExecutionRequestStatus.pending_execution,
              GovernedTreasuryExecutionRequestStatus.executed
            ]
          }
        },
        include: executionRequestInclude,
        orderBy: {
          requestedAt: "desc"
        }
      });

      if (existing) {
        return {
          record: existing,
          stateReused: true
        };
      }

      const expectedExecutionCall = this.buildExpectedExecutionCall({
        contractAddress: input.contractAddress ?? null,
        contractMethod: input.contractMethod,
        executionType:
          GovernedTreasuryExecutionRequestType.loan_contract_creation,
        executionPayload: {
          borrowerWalletAddress: input.borrowerWalletAddress,
          contractLoanId: input.contractLoanId ?? null,
          treasuryReceiverAddress: input.treasuryReceiverAddress ?? null,
          principalAmount: input.principalAmount,
          collateralAmount: input.collateralAmount,
          serviceFeeAmount: input.serviceFeeAmount,
          installmentAmount: input.installmentAmount,
          installmentCount: input.installmentCount,
          termMonths: input.termMonths,
          autopayEnabled: input.autopayEnabled
        } as PrismaJsonValue,
        walletAddress: input.walletAddress,
        borrowAsset,
        collateralAsset
      });

      const created = await transaction.governedTreasuryExecutionRequest.create({
        data: {
          environment: this.environment,
          chainId: input.chainId,
          executionType:
            GovernedTreasuryExecutionRequestType.loan_contract_creation,
          targetType: "LoanAgreement",
          targetId: input.loanAgreementId,
          loanAgreementId: input.loanAgreementId,
          contractAddress: input.contractAddress ?? undefined,
          contractMethod: input.contractMethod,
          walletAddress: input.walletAddress ?? undefined,
          assetId: input.borrowAssetId,
          executionPayload: {
            borrowerWalletAddress: input.borrowerWalletAddress,
            contractLoanId: input.contractLoanId ?? null,
            treasuryReceiverAddress: input.treasuryReceiverAddress ?? null,
            principalAmount: input.principalAmount,
            collateralAmount: input.collateralAmount,
            serviceFeeAmount: input.serviceFeeAmount,
            installmentAmount: input.installmentAmount,
            installmentCount: input.installmentCount,
            termMonths: input.termMonths,
            autopayEnabled: input.autopayEnabled
          } as PrismaJsonValue,
          expectedExecutionCalldata:
            expectedExecutionCall.calldata ?? undefined,
          expectedExecutionCalldataHash:
            expectedExecutionCall.calldataHash ?? undefined,
          expectedExecutionMethodSelector:
            expectedExecutionCall.methodSelector ?? undefined,
          requestedByActorType: input.requestedByActorType,
          requestedByActorId: input.requestedByActorId,
          requestedByActorRole: input.requestedByActorRole ?? undefined,
          requestNote: requestNote ?? undefined
        },
        include: executionRequestInclude
      });

      await transaction.loanEvent.create({
        data: {
          loanAgreementId: input.loanAgreementId,
          actorType: input.requestedByActorType,
          actorId: input.requestedByActorId,
          actorRole: input.requestedByActorRole ?? undefined,
          eventType: "governed_execution_requested",
          note:
            requestNote ??
            "Loan contract creation has been queued for governed external execution.",
          metadata: {
            governedTreasuryExecutionRequestId: created.id,
            executionType: created.executionType,
            contractMethod: created.contractMethod,
            walletAddress: created.walletAddress,
            contractAddress: created.contractAddress
          } as PrismaJsonValue
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: input.requestedByActorType,
          actorId: input.requestedByActorId,
          action: "governed_execution.loan_contract_creation.requested",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: created.id,
          metadata: {
            environment: this.environment,
            loanAgreementId: input.loanAgreementId,
            assetId: input.borrowAssetId,
            contractAddress: created.contractAddress,
            contractMethod: created.contractMethod,
            expectedExecutionCalldataHash:
              created.expectedExecutionCalldataHash,
            expectedExecutionMethodSelector:
              created.expectedExecutionMethodSelector
          } as PrismaJsonValue
        }
      });

      return {
        record: created,
        stateReused: false
      };
    });

    return {
      request: this.mapExecutionRequestProjection(record.record),
      stateReused: record.stateReused
    };
  }

  async requestStakingPoolCreation(input: {
    stakingPoolGovernanceRequestId: string;
    stakingPoolId: number;
    rewardRate: number;
    chainId: number;
    contractAddress: string | null;
    contractMethod: string;
    requestNote?: string | null;
    requestedByActorType: string;
    requestedByActorId: string;
    requestedByActorRole?: string | null;
  }): Promise<{
    request: ExecutionRequestProjection;
    stateReused: boolean;
  }> {
    const requestNote = this.normalizeOptionalString(input.requestNote);
    const expectedExecutionCall = this.buildExpectedExecutionCall({
      contractAddress: input.contractAddress ?? null,
      contractMethod: input.contractMethod,
      executionType: GovernedTreasuryExecutionRequestType.staking_pool_creation,
      executionPayload: {
        stakingPoolId: input.stakingPoolId,
        rewardRate: input.rewardRate
      } as PrismaJsonValue,
      walletAddress: null
    });

    const record = await this.prismaService.$transaction(async (transaction) => {
      const existing = await transaction.governedTreasuryExecutionRequest.findFirst({
        where: {
          environment: this.environment,
          stakingPoolGovernanceRequestId: input.stakingPoolGovernanceRequestId,
          executionType:
            GovernedTreasuryExecutionRequestType.staking_pool_creation,
          status: {
            in: [
              GovernedTreasuryExecutionRequestStatus.pending_execution,
              GovernedTreasuryExecutionRequestStatus.executed
            ]
          }
        },
        include: executionRequestInclude,
        orderBy: {
          requestedAt: "desc"
        }
      });

      if (existing) {
        return {
          record: existing,
          stateReused: true
        };
      }

      const created = await transaction.governedTreasuryExecutionRequest.create({
        data: {
          environment: this.environment,
          chainId: input.chainId,
          executionType:
            GovernedTreasuryExecutionRequestType.staking_pool_creation,
          targetType: "StakingPoolGovernanceRequest",
          targetId: input.stakingPoolGovernanceRequestId,
          stakingPoolGovernanceRequestId: input.stakingPoolGovernanceRequestId,
          contractAddress: input.contractAddress ?? undefined,
          contractMethod: input.contractMethod,
          executionPayload: {
            stakingPoolId: input.stakingPoolId,
            rewardRate: input.rewardRate
          } as PrismaJsonValue,
          expectedExecutionCalldata:
            expectedExecutionCall.calldata ?? undefined,
          expectedExecutionCalldataHash:
            expectedExecutionCall.calldataHash ?? undefined,
          expectedExecutionMethodSelector:
            expectedExecutionCall.methodSelector ?? undefined,
          requestedByActorType: input.requestedByActorType,
          requestedByActorId: input.requestedByActorId,
          requestedByActorRole: input.requestedByActorRole ?? undefined,
          requestNote: requestNote ?? undefined
        },
        include: executionRequestInclude
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: input.requestedByActorType,
          actorId: input.requestedByActorId,
          action: "governed_execution.staking_pool_creation.requested",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: created.id,
          metadata: {
            environment: this.environment,
            stakingPoolGovernanceRequestId: input.stakingPoolGovernanceRequestId,
            stakingPoolId: input.stakingPoolId,
            rewardRate: input.rewardRate,
            contractAddress: created.contractAddress,
            contractMethod: created.contractMethod,
            expectedExecutionCalldataHash:
              created.expectedExecutionCalldataHash,
            expectedExecutionMethodSelector:
              created.expectedExecutionMethodSelector
          } as PrismaJsonValue
        }
      });

      return {
        record: created,
        stateReused: false
      };
    });

    return {
      request: this.mapExecutionRequestProjection(record.record),
      stateReused: record.stateReused
    };
  }

  async recordExecutionSuccess(
    requestId: string,
    input: {
      executionNote?: string;
      blockchainTransactionHash?: string;
      externalExecutionReference?: string;
      contractLoanId?: string;
      contractAddress?: string;
    },
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: ExecutionRequestProjection;
    workspace: GovernedExecutionWorkspaceResult;
  }> {
    const normalizedOperatorRole = this.assertCanApprove(operator.operatorRole);
    const executionNote = this.normalizeOptionalString(input.executionNote);
    const blockchainTransactionHash = this.normalizeOptionalString(
      input.blockchainTransactionHash
    );
    const externalExecutionReference = this.normalizeOptionalString(
      input.externalExecutionReference
    );
    const contractLoanId = this.normalizeOptionalString(input.contractLoanId);
    const contractAddress = this.normalizeOptionalString(input.contractAddress);

    if (!blockchainTransactionHash && !externalExecutionReference) {
      throw new BadRequestException(
        "Execution success requires a blockchain transaction hash or an external execution reference."
      );
    }

    const updated = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      if (
        request.status !== GovernedTreasuryExecutionRequestStatus.pending_execution &&
        request.status !== GovernedTreasuryExecutionRequestStatus.execution_failed
      ) {
        return request;
      }

      if (
        request.executionType ===
          GovernedTreasuryExecutionRequestType.loan_contract_creation &&
        !contractLoanId
      ) {
        throw new BadRequestException(
          "Loan contract creation execution requires contractLoanId."
        );
      }

      const next = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: GovernedTreasuryExecutionRequestStatus.executed,
          dispatchStatus: GovernedTreasuryExecutionDispatchStatus.dispatched,
          dispatchFailureReason: null,
          claimedByWorkerId: null,
          claimedAt: null,
          claimExpiresAt: null,
          claimedByExecutorId: null,
          executorClaimedAt: null,
          executorClaimExpiresAt: null,
          executorReceiptSubmittedAt: new Date(),
          executedByActorType: "operator",
          executedByActorId: operator.operatorId,
          executedByActorRole: normalizedOperatorRole,
          executedAt: new Date(),
          blockchainTransactionHash: blockchainTransactionHash ?? undefined,
          externalExecutionReference: externalExecutionReference ?? undefined,
          failureReason: null,
          failedAt: null,
          contractAddress:
            contractAddress ?? request.contractAddress ?? undefined,
          executionResult: {
            executionNote: executionNote ?? null,
            blockchainTransactionHash: blockchainTransactionHash ?? null,
            externalExecutionReference: externalExecutionReference ?? null,
            contractLoanId: contractLoanId ?? null
          } as PrismaJsonValue
        },
        include: executionRequestInclude
      });

      if (next.loanAgreementId) {
        await transaction.loanAgreement.update({
          where: {
            id: next.loanAgreementId
          },
          data: {
            contractLoanId: contractLoanId ?? undefined,
            contractAddress:
              contractAddress ?? next.contractAddress ?? undefined,
            activationTransactionHash:
              blockchainTransactionHash ?? undefined
          }
        });

        await transaction.loanEvent.create({
          data: {
            loanAgreementId: next.loanAgreementId,
            actorType: "operator",
            actorId: operator.operatorId,
            actorRole: normalizedOperatorRole,
            eventType: "governed_execution_recorded",
            note:
              executionNote ??
              "Governed treasury execution for loan contract creation was recorded.",
            metadata: {
              governedTreasuryExecutionRequestId: next.id,
              blockchainTransactionHash,
              externalExecutionReference,
              contractLoanId
            } as PrismaJsonValue
          }
        });
      }

      if (next.stakingPoolGovernanceRequestId) {
        await transaction.stakingPoolGovernanceRequest.update({
          where: {
            id: next.stakingPoolGovernanceRequestId
          },
          data: {
            status: "executed",
            executedByOperatorId: operator.operatorId,
            executedByOperatorRole: normalizedOperatorRole,
            executionNote: executionNote ?? undefined,
            executionFailureReason: null,
            blockchainTransactionHash: blockchainTransactionHash ?? undefined,
            executedAt: new Date()
          }
        });
      }

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.request.executed",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: next.id,
          metadata: {
            environment: this.environment,
            executionType: next.executionType,
            blockchainTransactionHash,
            externalExecutionReference,
            contractLoanId,
            contractAddress:
              contractAddress ?? next.contractAddress ?? null
          } as PrismaJsonValue
        }
      });

      return next;
    });

    return {
      request: this.mapExecutionRequestProjection(updated),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      })
    };
  }

  async recordExecutionFailure(
    requestId: string,
    input: {
      failureReason: string;
      executionNote?: string;
      blockchainTransactionHash?: string;
      externalExecutionReference?: string;
    },
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: ExecutionRequestProjection;
    workspace: GovernedExecutionWorkspaceResult;
  }> {
    const normalizedOperatorRole = this.assertCanApprove(operator.operatorRole);
    const failureReason = this.normalizeOptionalString(input.failureReason);
    const executionNote = this.normalizeOptionalString(input.executionNote);
    const blockchainTransactionHash = this.normalizeOptionalString(
      input.blockchainTransactionHash
    );
    const externalExecutionReference = this.normalizeOptionalString(
      input.externalExecutionReference
    );

    if (!failureReason) {
      throw new BadRequestException("failureReason is required.");
    }

    const updated = await this.prismaService.$transaction(async (transaction) => {
      const request = await transaction.governedTreasuryExecutionRequest.findUnique({
        where: {
          id: requestId
        },
        include: executionRequestInclude
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed treasury execution request was not found in this environment."
        );
      }

      if (
        request.status !== GovernedTreasuryExecutionRequestStatus.pending_execution &&
        request.status !== GovernedTreasuryExecutionRequestStatus.execution_failed
      ) {
        return request;
      }

      const next = await transaction.governedTreasuryExecutionRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: GovernedTreasuryExecutionRequestStatus.execution_failed,
          dispatchStatus:
            GovernedTreasuryExecutionDispatchStatus.dispatch_failed,
          claimedByWorkerId: null,
          claimedAt: null,
          claimExpiresAt: null,
          claimedByExecutorId: null,
          executorClaimedAt: null,
          executorClaimExpiresAt: null,
          executorReceiptSubmittedAt: new Date(),
          blockchainTransactionHash: blockchainTransactionHash ?? undefined,
          externalExecutionReference: externalExecutionReference ?? undefined,
          failureReason,
          failedAt: new Date(),
          dispatchFailureReason: failureReason,
          executionResult: {
            executionNote: executionNote ?? null,
            blockchainTransactionHash: blockchainTransactionHash ?? null,
            externalExecutionReference: externalExecutionReference ?? null,
            failureReason
          } as PrismaJsonValue
        },
        include: executionRequestInclude
      });

      if (next.loanAgreementId) {
        await transaction.loanEvent.create({
          data: {
            loanAgreementId: next.loanAgreementId,
            actorType: "operator",
            actorId: operator.operatorId,
            actorRole: normalizedOperatorRole,
            eventType: "governed_execution_failed",
            note:
              executionNote ??
              "Governed treasury execution for loan contract creation failed.",
            metadata: {
              governedTreasuryExecutionRequestId: next.id,
              blockchainTransactionHash,
              externalExecutionReference,
              failureReason
            } as PrismaJsonValue
          }
        });
      }

      if (next.stakingPoolGovernanceRequestId) {
        await transaction.stakingPoolGovernanceRequest.update({
          where: {
            id: next.stakingPoolGovernanceRequestId
          },
          data: {
            status: "execution_failed",
            executionNote: executionNote ?? undefined,
            executionFailureReason: failureReason,
            blockchainTransactionHash: blockchainTransactionHash ?? undefined
          }
        });
      }

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.request.execution_failed",
          targetType: "GovernedTreasuryExecutionRequest",
          targetId: next.id,
          metadata: {
            environment: this.environment,
            executionType: next.executionType,
            blockchainTransactionHash,
            externalExecutionReference,
            failureReason
          } as PrismaJsonValue
        }
      });

      return next;
    });

    return {
      request: this.mapExecutionRequestProjection(updated),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      })
    };
  }

  async requestOverride(
    input: {
      allowUnsafeWithdrawalExecution?: boolean;
      allowDirectLoanFunding?: boolean;
      allowDirectStakingWrites?: boolean;
      reasonCode: string;
      requestNote?: string;
      expiresInHours: number;
    },
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: OverrideProjection;
    workspace: GovernedExecutionWorkspaceResult;
  }> {
    const normalizedOperatorRole = this.assertCanRequest(operator.operatorRole);

    if (
      !input.allowUnsafeWithdrawalExecution &&
      !input.allowDirectLoanFunding &&
      !input.allowDirectStakingWrites
    ) {
      throw new BadRequestException(
        "At least one governed execution override scope must be requested."
      );
    }

    if (input.expiresInHours > this.config.overrideMaxHours) {
      throw new BadRequestException(
        `Governed execution override requests must not exceed ${this.config.overrideMaxHours} hours.`
      );
    }

    const requestNote = this.normalizeOptionalString(input.requestNote);
    const reasonCode = this.normalizeOptionalString(input.reasonCode);

    if (!reasonCode) {
      throw new BadRequestException("reasonCode is required.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.expiresInHours * 3_600_000);

    const created = await this.prismaService.$transaction(async (transaction) => {
      const existingPending =
        await transaction.governedExecutionOverrideRequest.findFirst({
          where: {
            environment: this.environment,
            status: GovernedExecutionOverrideRequestStatus.pending_approval,
            expiresAt: {
              gt: now
            }
          }
        });

      if (existingPending) {
        throw new ConflictException(
          "A governed execution override request is already pending approval."
        );
      }

      const createdRequest =
        await transaction.governedExecutionOverrideRequest.create({
          data: {
            environment: this.environment,
            status: GovernedExecutionOverrideRequestStatus.pending_approval,
            allowUnsafeWithdrawalExecution:
              input.allowUnsafeWithdrawalExecution ?? false,
            allowDirectLoanFunding: input.allowDirectLoanFunding ?? false,
            allowDirectStakingWrites: input.allowDirectStakingWrites ?? false,
            reasonCode,
            requestNote: requestNote ?? undefined,
            requestedByOperatorId: operator.operatorId,
            requestedByOperatorRole: normalizedOperatorRole,
            expiresAt
          }
        });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.override.requested",
          targetType: "GovernedExecutionOverrideRequest",
          targetId: createdRequest.id,
          metadata: {
            environment: this.environment,
            requestedByOperatorRole: normalizedOperatorRole,
            allowUnsafeWithdrawalExecution:
              createdRequest.allowUnsafeWithdrawalExecution,
            allowDirectLoanFunding: createdRequest.allowDirectLoanFunding,
            allowDirectStakingWrites: createdRequest.allowDirectStakingWrites,
            reasonCode,
            requestNote,
            expiresAt: createdRequest.expiresAt.toISOString()
          } as PrismaJsonValue
        }
      });

      return createdRequest;
    });

    return {
      request: this.mapOverrideProjection(created),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      })
    };
  }

  async approveOverride(
    requestId: string,
    input: {
      approvalNote?: string;
    },
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: OverrideProjection;
    workspace: GovernedExecutionWorkspaceResult;
  }> {
    const normalizedOperatorRole = this.assertCanApprove(operator.operatorRole);
    const approvalNote = this.normalizeOptionalString(input.approvalNote);
    const now = new Date();

    const approved = await this.prismaService.$transaction(async (transaction) => {
      await this.expireStaleOverrides(now);
      const request = await transaction.governedExecutionOverrideRequest.findUnique({
        where: {
          id: requestId
        }
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed execution override request was not found in this environment."
        );
      }

      if (
        request.status !==
        GovernedExecutionOverrideRequestStatus.pending_approval
      ) {
        return request;
      }

      if (request.requestedByOperatorId === operator.operatorId) {
        throw new ForbiddenException(
          "The requesting operator cannot approve their own governed execution override."
        );
      }

      if (request.expiresAt.getTime() <= now.getTime()) {
        throw new ConflictException(
          "Governed execution override request has expired."
        );
      }

      const updated = await transaction.governedExecutionOverrideRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: GovernedExecutionOverrideRequestStatus.approved,
          approvedByOperatorId: operator.operatorId,
          approvedByOperatorRole: normalizedOperatorRole,
          approvalNote: approvalNote ?? undefined,
          approvedAt: now
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.override.approved",
          targetType: "GovernedExecutionOverrideRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            approvedByOperatorRole: normalizedOperatorRole,
            approvalNote
          } as PrismaJsonValue
        }
      });

      return updated;
    });

    return {
      request: this.mapOverrideProjection(approved),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      })
    };
  }

  async rejectOverride(
    requestId: string,
    input: {
      rejectionNote?: string;
    },
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: OverrideProjection;
    workspace: GovernedExecutionWorkspaceResult;
  }> {
    const normalizedOperatorRole = this.assertCanApprove(operator.operatorRole);
    const rejectionNote = this.normalizeOptionalString(input.rejectionNote);
    const now = new Date();

    const rejected = await this.prismaService.$transaction(async (transaction) => {
      await this.expireStaleOverrides(now);
      const request = await transaction.governedExecutionOverrideRequest.findUnique({
        where: {
          id: requestId
        }
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed execution override request was not found in this environment."
        );
      }

      if (
        request.status !==
        GovernedExecutionOverrideRequestStatus.pending_approval
      ) {
        return request;
      }

      const updated = await transaction.governedExecutionOverrideRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: GovernedExecutionOverrideRequestStatus.rejected,
          rejectedByOperatorId: operator.operatorId,
          rejectedByOperatorRole: normalizedOperatorRole,
          rejectionNote: rejectionNote ?? undefined,
          rejectedAt: now
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.override.rejected",
          targetType: "GovernedExecutionOverrideRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            rejectedByOperatorRole: normalizedOperatorRole,
            rejectionNote
          } as PrismaJsonValue
        }
      });

      return updated;
    });

    return {
      request: this.mapOverrideProjection(rejected),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      })
    };
  }

  async assertManagedWithdrawalExecutionAllowed(
    input: AssertManagedWithdrawalInput
  ): Promise<void> {
    if (
      !this.config.governedExecutionRequiredInProduction ||
      this.environment !== WorkerRuntimeEnvironment.production
    ) {
      return;
    }

    if (
      !input.sourceWalletKind ||
      !RESERVE_WALLET_KINDS.some((kind) => kind === input.sourceWalletKind)
    ) {
      return;
    }

    if (
      input.sourceWalletCustodyType &&
      this.governedReserveCustodyTypes.has(input.sourceWalletCustodyType)
    ) {
      return;
    }

    const activeOverrides = await this.getActiveApprovedOverrides(new Date());

    if (this.hasOverride(activeOverrides, "allowUnsafeWithdrawalExecution")) {
      return;
    }

    throw new ServiceUnavailableException(
      `Managed withdrawal execution is blocked because wallet ${input.sourceWalletAddress ?? "unknown"} is not governed reserve custody.`
    );
  }

  async assertLoanFundingExecutionAllowed(): Promise<void> {
    if (
      !this.config.governedExecutionRequiredInProduction ||
      this.environment !== WorkerRuntimeEnvironment.production
    ) {
      return;
    }

    if (this.config.loanFundingExecutionMode === "governed_external") {
      return;
    }

    const activeOverrides = await this.getActiveApprovedOverrides(new Date());

    if (this.hasOverride(activeOverrides, "allowDirectLoanFunding")) {
      return;
    }

    throw new ServiceUnavailableException(
      "Loan funding is blocked because governed treasury execution is required in production."
    );
  }

  async assertStakingWriteExecutionAllowed(): Promise<void> {
    if (
      !this.config.governedExecutionRequiredInProduction ||
      this.environment !== WorkerRuntimeEnvironment.production
    ) {
      return;
    }

    if (this.config.stakingWriteExecutionMode === "governed_external") {
      return;
    }

    const activeOverrides = await this.getActiveApprovedOverrides(new Date());

    if (this.hasOverride(activeOverrides, "allowDirectStakingWrites")) {
      return;
    }

    throw new ServiceUnavailableException(
      "Staking writes are blocked because governed treasury execution is required in production."
    );
  }
}
