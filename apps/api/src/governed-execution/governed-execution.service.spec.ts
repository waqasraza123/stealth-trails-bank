import {
  GovernedExecutionOverrideRequestStatus,
  GovernedTreasuryExecutionRequestStatus,
  GovernedTreasuryExecutionRequestType,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment,
  WorkerRuntimeExecutionMode
} from "@prisma/client";
import { ethers } from "ethers";
import { buildSignedGovernedExecutionReceipt } from "./governed-execution-proof";
import type { PrismaService } from "../prisma/prisma.service";
import { GovernedExecutionService } from "./governed-execution.service";

const mockConfig: {
  environment: "production";
  governedExecutionRequiredInProduction: boolean;
  governedReserveCustodyTypes: WalletCustodyType[];
  loanFundingExecutionMode: "direct_private_key" | "governed_external";
  stakingWriteExecutionMode: "direct_private_key" | "governed_external";
  requestAllowedOperatorRoles: string[];
  approverAllowedOperatorRoles: string[];
  overrideMaxHours: number;
  executionPackageSignerPrivateKey: string;
  executionClaimLeaseSeconds: number;
  executorClaimLeaseSeconds: number;
  executorAllowedSignerAddresses: string[];
  requireOnchainExecutorReceiptVerification: boolean;
} = {
  environment: "production" as const,
  governedExecutionRequiredInProduction: true,
  governedReserveCustodyTypes: [
    WalletCustodyType.multisig_controlled,
    WalletCustodyType.contract_controlled
  ],
  loanFundingExecutionMode: "direct_private_key" as const,
  stakingWriteExecutionMode: "direct_private_key" as const,
  requestAllowedOperatorRoles: ["operations_admin", "risk_manager"],
  approverAllowedOperatorRoles: ["compliance_lead", "risk_manager"],
  overrideMaxHours: 12,
  executionPackageSignerPrivateKey:
    "0x59c6995e998f97a5a0044976f094538e2d7db6d63dd7f6c5f495fac1cac7e31d",
  executionClaimLeaseSeconds: 300,
  executorClaimLeaseSeconds: 300,
  executorAllowedSignerAddresses: [
    new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
    ).address
  ],
  requireOnchainExecutorReceiptVerification: true
};

const mockProvider = {
  getTransactionReceipt: jest.fn(async () => ({
    status: 1,
    blockNumber: 123n,
    transactionIndex: 4,
    to: "0x0000000000000000000000000000000000000def"
  })),
  getTransaction: jest.fn(async () => ({
    data: "0x1234"
  }))
};

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadGovernedExecutionRuntimeConfig: jest.fn(() => mockConfig),
  loadOptionalBlockchainContractReadRuntimeConfig: jest.fn(() => ({
    rpcUrl: "http://localhost:8545"
  }))
}));

jest.mock("@stealth-trails-bank/contracts-sdk", () => ({
  createJsonRpcProvider: jest.fn(() => mockProvider),
  LOAN_BOOK_ABI: [
    "function createLoan(address borrower, address borrowAsset, address collateralAsset, uint256 principalAmount, uint256 collateralAmount, uint256 serviceFeeAmount, uint256 installmentAmount, uint256 installmentCount, uint256 termMonths, bool autopayEnabled) external returns (uint256)"
  ],
  STAKING_CONTRACT_ABI: [
    "function createPool(uint256 _rewardRate, uint256 externalPoolId) external"
  ]
}));

function buildExecutorReceipt(args: {
  requestId: string;
  executionType: string;
  targetType: string;
  targetId: string;
  dispatchReference: string;
  executorId: string;
  outcome: "executed" | "failed";
  transactionChainId?: number;
  transactionToAddress?: string;
  blockchainTransactionHash?: string | null;
  externalExecutionReference?: string | null;
  contractLoanId?: string | null;
  contractAddress?: string | null;
  failureReason?: string | null;
}) {
  return buildSignedGovernedExecutionReceipt(
    {
      version: 1,
      requestId: args.requestId,
      environment: "production",
      chainId: 8453,
      executionType: args.executionType,
      targetType: args.targetType,
      targetId: args.targetId,
      dispatchReference: args.dispatchReference,
      executorId: args.executorId,
      outcome: args.outcome,
      transactionChainId: args.transactionChainId ?? null,
      transactionToAddress: args.transactionToAddress ?? null,
      blockchainTransactionHash: args.blockchainTransactionHash ?? null,
      externalExecutionReference: args.externalExecutionReference ?? null,
      contractLoanId: args.contractLoanId ?? null,
      contractAddress: args.contractAddress ?? null,
      failureReason: args.failureReason ?? null,
      notedAt: "2030-04-18T10:03:00.000Z"
    },
    "0x59c6995e998f97a5a0044966f094538c5f6d4e07f16b8ad8cc7658f0f1b0f9d8"
  );
}

function createWallet(
  overrides?: Partial<{
    id: string;
    address: string;
    kind: WalletKind;
    custodyType: WalletCustodyType;
    status: WalletStatus;
  }>
) {
  return {
    id: overrides?.id ?? "wallet_1",
    chainId: 8453,
    address:
      overrides?.address ?? "0x0000000000000000000000000000000000000abc",
    kind: overrides?.kind ?? WalletKind.treasury,
    custodyType:
      overrides?.custodyType ?? WalletCustodyType.multisig_controlled,
    status: overrides?.status ?? WalletStatus.active,
    customerAccount: null,
    createdAt: new Date("2026-04-18T10:00:00.000Z"),
    updatedAt: new Date("2026-04-18T10:00:00.000Z")
  };
}

function createWorkerHeartbeat(policyControlledWithdrawalReady: boolean) {
  return {
    id: "heartbeat_1",
    workerId: "worker_1",
    environment: WorkerRuntimeEnvironment.production,
    executionMode: WorkerRuntimeExecutionMode.managed,
    lastIterationStatus: "succeeded",
    lastHeartbeatAt: new Date("2026-04-18T10:00:00.000Z"),
    lastIterationStartedAt: new Date("2026-04-18T09:59:30.000Z"),
    lastIterationCompletedAt: new Date("2026-04-18T10:00:00.000Z"),
    consecutiveFailureCount: 0,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastReconciliationScanRunId: null,
    lastReconciliationScanStartedAt: null,
    lastReconciliationScanCompletedAt: null,
    lastReconciliationScanStatus: null,
    runtimeMetadata: {
      policyControlledWithdrawalReady
    },
    latestIterationMetrics: null,
    createdAt: new Date("2026-04-18T09:00:00.000Z"),
    updatedAt: new Date("2026-04-18T10:00:00.000Z")
  };
}

function createOverrideRecord(
  overrides?: Partial<{
    id: string;
    status: GovernedExecutionOverrideRequestStatus;
    allowUnsafeWithdrawalExecution: boolean;
    allowDirectLoanFunding: boolean;
    allowDirectStakingWrites: boolean;
    requestedByOperatorId: string;
    requestedByOperatorRole: string;
    expiresAt: Date;
    approvedAt: Date | null;
    approvedByOperatorId: string | null;
    approvedByOperatorRole: string | null;
  }>
) {
  return {
    id: overrides?.id ?? "override_1",
    environment: WorkerRuntimeEnvironment.production,
    status:
      overrides?.status ??
      GovernedExecutionOverrideRequestStatus.pending_approval,
    allowUnsafeWithdrawalExecution:
      overrides?.allowUnsafeWithdrawalExecution ?? false,
    allowDirectLoanFunding: overrides?.allowDirectLoanFunding ?? true,
    allowDirectStakingWrites: overrides?.allowDirectStakingWrites ?? true,
    reasonCode: "temporary_governance_override",
    requestNote: "Need short-lived override",
    requestedByOperatorId: overrides?.requestedByOperatorId ?? "operator_req",
    requestedByOperatorRole:
      overrides?.requestedByOperatorRole ?? "operations_admin",
    requestedAt: new Date("2026-04-18T10:00:00.000Z"),
    expiresAt:
      overrides?.expiresAt ?? new Date("2026-04-18T14:00:00.000Z"),
    approvedByOperatorId: overrides?.approvedByOperatorId ?? null,
    approvedByOperatorRole: overrides?.approvedByOperatorRole ?? null,
    approvalNote: null,
    approvedAt: overrides?.approvedAt ?? null,
    rejectedByOperatorId: null,
    rejectedByOperatorRole: null,
    rejectionNote: null,
    rejectedAt: null,
    createdAt: new Date("2026-04-18T10:00:00.000Z"),
    updatedAt: new Date("2026-04-18T10:00:00.000Z")
  };
}

function createExecutionRequestRecord(
  overrides?: Partial<{
    id: string;
    executionType: GovernedTreasuryExecutionRequestType;
    status: GovernedTreasuryExecutionRequestStatus;
    loanAgreementId: string | null;
    stakingPoolGovernanceRequestId: string | null;
    contractAddress: string | null;
    contractMethod: string;
    walletAddress: string | null;
    assetId: string | null;
    failureReason: string | null;
    blockchainTransactionHash: string | null;
    canonicalExecutionPayload: Record<string, unknown> | null;
    canonicalExecutionPayloadText: string | null;
    executionPackageHash: string | null;
    executionPackageChecksumSha256: string | null;
    executionPackageSignature: string | null;
    executionPackageSignatureAlgorithm: string | null;
    executionPackageSignerAddress: string | null;
    executionPackagePublishedAt: Date | null;
    claimedByWorkerId: string | null;
    claimedAt: Date | null;
    claimExpiresAt: Date | null;
    dispatchStatus: "not_dispatched" | "dispatched" | "dispatch_failed";
    dispatchPreparedAt: Date | null;
    dispatchedByWorkerId: string | null;
    dispatchReference: string | null;
    dispatchVerificationChecksumSha256: string | null;
    dispatchFailureReason: string | null;
    expectedExecutionCalldata: string | null;
    expectedExecutionCalldataHash: string | null;
    expectedExecutionMethodSelector: string | null;
    claimedByExecutorId: string | null;
    executorClaimedAt: Date | null;
    executorClaimExpiresAt: Date | null;
    executorReceiptSubmittedAt: Date | null;
  }>
) {
  return {
    id: overrides?.id ?? "execution_1",
    environment: WorkerRuntimeEnvironment.production,
    chainId: 8453,
    executionType:
      overrides?.executionType ??
      GovernedTreasuryExecutionRequestType.loan_contract_creation,
    status:
      overrides?.status ??
      GovernedTreasuryExecutionRequestStatus.pending_execution,
    targetType:
      overrides?.executionType ===
      GovernedTreasuryExecutionRequestType.staking_pool_creation
        ? "StakingPoolGovernanceRequest"
        : "LoanAgreement",
    targetId:
      overrides?.stakingPoolGovernanceRequestId ??
      overrides?.loanAgreementId ??
      "target_1",
    loanAgreementId: overrides?.loanAgreementId ?? "loan_agreement_1",
    loanAgreement: overrides?.loanAgreementId
      ? {
          id: overrides.loanAgreementId,
          status: "awaiting_funding",
          contractLoanId: null,
          contractAddress: null
        }
      : null,
    stakingPoolGovernanceRequestId:
      overrides?.stakingPoolGovernanceRequestId ?? null,
    stakingPoolGovernanceRequest: overrides?.stakingPoolGovernanceRequestId
      ? {
          id: overrides.stakingPoolGovernanceRequestId,
          status: "approved",
          rewardRate: 12,
          stakingPoolId: 17
        }
      : null,
    contractAddress:
      overrides?.contractAddress ?? "0x0000000000000000000000000000000000000def",
    contractMethod: overrides?.contractMethod ?? "createLoan",
    walletAddress:
      overrides?.walletAddress ?? "0x0000000000000000000000000000000000000abc",
    assetId: overrides?.assetId ?? "asset_usdc",
    asset: overrides?.assetId
      ? {
          id: overrides.assetId,
          symbol: "USDC",
          displayName: "USD Coin",
          decimals: 6,
          chainId: 8453
        }
      : null,
    executionPayload: {
      principalAmount: "1000"
    },
    canonicalExecutionPayload: overrides?.canonicalExecutionPayload ?? null,
    canonicalExecutionPayloadText:
      overrides?.canonicalExecutionPayloadText ?? null,
    executionPackageHash: overrides?.executionPackageHash ?? null,
    executionPackageChecksumSha256:
      overrides?.executionPackageChecksumSha256 ?? null,
    executionPackageSignature: overrides?.executionPackageSignature ?? null,
    executionPackageSignatureAlgorithm:
      overrides?.executionPackageSignatureAlgorithm ?? null,
    executionPackageSignerAddress:
      overrides?.executionPackageSignerAddress ?? null,
    executionPackagePublishedAt:
      overrides?.executionPackagePublishedAt ?? null,
    claimedByWorkerId: overrides?.claimedByWorkerId ?? null,
    claimedAt: overrides?.claimedAt ?? null,
    claimExpiresAt: overrides?.claimExpiresAt ?? null,
    dispatchStatus: overrides?.dispatchStatus ?? "not_dispatched",
    dispatchPreparedAt: overrides?.dispatchPreparedAt ?? null,
    dispatchedByWorkerId: overrides?.dispatchedByWorkerId ?? null,
    dispatchReference: overrides?.dispatchReference ?? null,
    dispatchVerificationChecksumSha256:
      overrides?.dispatchVerificationChecksumSha256 ?? null,
    dispatchFailureReason: overrides?.dispatchFailureReason ?? null,
    expectedExecutionCalldata: overrides?.expectedExecutionCalldata ?? null,
    expectedExecutionCalldataHash:
      overrides?.expectedExecutionCalldataHash ?? null,
    expectedExecutionMethodSelector:
      overrides?.expectedExecutionMethodSelector ?? null,
    claimedByExecutorId: overrides?.claimedByExecutorId ?? null,
    executorClaimedAt: overrides?.executorClaimedAt ?? null,
    executorClaimExpiresAt: overrides?.executorClaimExpiresAt ?? null,
    executorReceiptSubmittedAt: overrides?.executorReceiptSubmittedAt ?? null,
    requestedByActorType: "operator",
    requestedByActorId: "operator_req",
    requestedByActorRole: "risk_manager",
    requestNote: "Queue external execution",
    requestedAt: new Date("2026-04-18T10:00:00.000Z"),
    executedByActorType: null,
    executedByActorId: null,
    executedByActorRole: null,
    executedAt: null,
    blockchainTransactionHash: overrides?.blockchainTransactionHash ?? null,
    externalExecutionReference: null,
    executionResult: null,
    failedAt: null,
    failureReason: overrides?.failureReason ?? null,
    metadata: null,
    createdAt: new Date("2026-04-18T10:00:00.000Z"),
    updatedAt: new Date("2026-04-18T10:00:00.000Z")
  };
}

function createService(args?: {
  wallets?: ReturnType<typeof createWallet>[];
  workers?: ReturnType<typeof createWorkerHeartbeat>[];
  overrides?: ReturnType<typeof createOverrideRecord>[];
  executionRequests?: ReturnType<typeof createExecutionRequestRecord>[];
}) {
  const overrideStore = [...(args?.overrides ?? [])];
  const executionRequestStore = [...(args?.executionRequests ?? [])];
  const wallets = args?.wallets ?? [createWallet()];
  const workers = args?.workers ?? [createWorkerHeartbeat(true)];

  const prismaService = {
    wallet: {
      findMany: jest.fn().mockResolvedValue(wallets)
    },
    asset: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        if (where.id === "asset_usdc") {
          return {
            assetType: "erc20",
            contractAddress: "0x00000000000000000000000000000000000000c1",
            decimals: 6
          };
        }

        return {
          assetType: "native",
          contractAddress: null,
          decimals: 18
        };
      })
    },
    workerRuntimeHeartbeat: {
      findMany: jest.fn().mockResolvedValue(workers)
    },
    auditEvent: {
      create: jest.fn().mockResolvedValue(undefined)
    },
    loanEvent: {
      create: jest.fn().mockResolvedValue(undefined)
    },
    loanAgreement: {
      update: jest.fn().mockResolvedValue(undefined)
    },
    stakingPoolGovernanceRequest: {
      update: jest.fn().mockResolvedValue(undefined)
    },
    governedExecutionOverrideRequest: {
      findMany: jest.fn(async () => [...overrideStore]),
      findFirst: jest.fn(async ({ where }: { where: { status?: string } }) => {
        if (where.status) {
          return (
            overrideStore.find((record) => record.status === where.status) ?? null
          );
        }

        return overrideStore[0] ?? null;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return overrideStore.find((record) => record.id === where.id) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const next = createOverrideRecord({
          id: `override_${overrideStore.length + 1}`,
          status: data.status as GovernedExecutionOverrideRequestStatus,
          allowUnsafeWithdrawalExecution:
            (data.allowUnsafeWithdrawalExecution as boolean) ?? false,
          allowDirectLoanFunding: (data.allowDirectLoanFunding as boolean) ?? false,
          allowDirectStakingWrites:
            (data.allowDirectStakingWrites as boolean) ?? false,
          requestedByOperatorId: data.requestedByOperatorId as string,
          requestedByOperatorRole: data.requestedByOperatorRole as string,
          expiresAt: data.expiresAt as Date
        });
        overrideStore.unshift(next);
        return next;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = overrideStore.findIndex((record) => record.id === where.id);
        const current = overrideStore[index];
        const next = {
          ...current,
          ...data,
          updatedAt: new Date("2026-04-18T10:05:00.000Z")
        };
        overrideStore[index] = next;
        return next;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { status?: { in: GovernedExecutionOverrideRequestStatus[] }; expiresAt?: { lt: Date } }; data: { status: GovernedExecutionOverrideRequestStatus } }) => {
        let count = 0;
        for (const record of overrideStore) {
          if (
            where.status?.in.includes(record.status) &&
            where.expiresAt &&
            record.expiresAt.getTime() < where.expiresAt.lt.getTime()
          ) {
            record.status = data.status;
            count += 1;
          }
        }
        return { count };
      })
    },
    governedTreasuryExecutionRequest: {
      findMany: jest.fn(async () => [...executionRequestStore]),
      findFirst: jest.fn(
        async ({
          where
        }: {
          where: {
            loanAgreementId?: string;
            stakingPoolGovernanceRequestId?: string;
            status?: { in: GovernedTreasuryExecutionRequestStatus[] };
          };
        }) =>
          executionRequestStore.find((record) => {
            if (
              where.loanAgreementId &&
              record.loanAgreementId !== where.loanAgreementId
            ) {
              return false;
            }

            if (
              where.stakingPoolGovernanceRequestId &&
              record.stakingPoolGovernanceRequestId !==
                where.stakingPoolGovernanceRequestId
            ) {
              return false;
            }

            if (where.status?.in && !where.status.in.includes(record.status)) {
              return false;
            }

            return true;
          }) ?? null
      ),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return executionRequestStore.find((record) => record.id === where.id) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const next = createExecutionRequestRecord({
          id: `execution_${executionRequestStore.length + 1}`,
          executionType: data.executionType as GovernedTreasuryExecutionRequestType,
          status:
            (data.status as GovernedTreasuryExecutionRequestStatus | undefined) ??
            GovernedTreasuryExecutionRequestStatus.pending_execution,
          loanAgreementId: (data.loanAgreementId as string | undefined) ?? null,
          stakingPoolGovernanceRequestId:
            (data.stakingPoolGovernanceRequestId as string | undefined) ?? null,
          contractAddress: (data.contractAddress as string | undefined) ?? null,
          contractMethod: data.contractMethod as string,
          walletAddress: (data.walletAddress as string | undefined) ?? null,
          assetId: (data.assetId as string | undefined) ?? null,
          expectedExecutionCalldata:
            (data.expectedExecutionCalldata as string | undefined) ?? null,
          expectedExecutionCalldataHash:
            (data.expectedExecutionCalldataHash as string | undefined) ?? null,
          expectedExecutionMethodSelector:
            (data.expectedExecutionMethodSelector as string | undefined) ?? null
        });
        executionRequestStore.unshift(next);
        return next;
      }),
      update: jest.fn(
        async ({
          where,
          data
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const index = executionRequestStore.findIndex(
            (record) => record.id === where.id
          );
          const current = executionRequestStore[index];
          const next = {
            ...current,
            ...data,
            updatedAt: new Date("2026-04-18T10:05:00.000Z")
          };
          executionRequestStore[index] = next;
          return next;
        }
      )
    },
    $transaction: jest.fn()
  } as unknown as PrismaService;

  (prismaService.$transaction as jest.Mock).mockImplementation(
    async (callback: (client: unknown) => Promise<unknown>) =>
      callback({
        governedExecutionOverrideRequest: prismaService.governedExecutionOverrideRequest,
        governedTreasuryExecutionRequest:
          prismaService.governedTreasuryExecutionRequest,
        asset: prismaService.asset,
        loanEvent: prismaService.loanEvent,
        loanAgreement: prismaService.loanAgreement,
        stakingPoolGovernanceRequest: prismaService.stakingPoolGovernanceRequest,
        auditEvent: prismaService.auditEvent
      })
  );

  return {
    service: new GovernedExecutionService(prismaService),
    prismaService,
    overrideStore,
    executionRequestStore
  };
}

describe("GovernedExecutionService", () => {
  afterEach(() => {
    jest.clearAllMocks();
    mockProvider.getTransactionReceipt.mockResolvedValue({
      status: 1,
      blockNumber: 123n,
      transactionIndex: 4,
      to: "0x0000000000000000000000000000000000000def"
    });
    mockProvider.getTransaction.mockResolvedValue({
      data: "0x1234"
    });
  });

  it("builds a healthy workspace when reserve custody and execution modes are governed", async () => {
    mockConfig.loanFundingExecutionMode = "governed_external";
    mockConfig.stakingWriteExecutionMode = "governed_external";

    const { service } = createService({
      wallets: [createWallet()],
      workers: [createWorkerHeartbeat(true)],
      overrides: []
    });

    const result = await service.getWorkspace({
      operatorId: "operator_1",
      operatorRole: "risk_manager"
    });

    expect(result.posture.status).toBe("healthy");
    expect(result.posture.unsafeReserveWalletCount).toBe(0);
  });

  it("classifies unsafe reserve custody and direct execution modes as critical", async () => {
    mockConfig.loanFundingExecutionMode = "direct_private_key";
    mockConfig.stakingWriteExecutionMode = "direct_private_key";

    const { service } = createService({
      wallets: [
        createWallet({
          custodyType: WalletCustodyType.platform_managed
        })
      ],
      workers: [createWorkerHeartbeat(false)],
      overrides: []
    });

    const result = await service.getWorkspace({
      operatorId: "operator_1",
      operatorRole: "risk_manager"
    });

    expect(result.posture.status).toBe("critical");
    expect(
      result.posture.reasons.map((reason) => reason.code)
    ).toEqual(
      expect.arrayContaining([
        "unsafe_reserve_wallet_custody",
        "loan_funding_not_governed",
        "staking_writes_not_governed"
      ])
    );
  });

  it("requires dual-control approval before direct-key execution is allowed", async () => {
    mockConfig.loanFundingExecutionMode = "direct_private_key";
    mockConfig.stakingWriteExecutionMode = "direct_private_key";

    const { service, overrideStore } = createService();

    await expect(service.assertLoanFundingExecutionAllowed()).rejects.toThrow(
      "Loan funding is blocked"
    );

    const requested = await service.requestOverride(
      {
        allowDirectLoanFunding: true,
        allowDirectStakingWrites: true,
        reasonCode: "incident_window",
        expiresInHours: 2
      },
      {
        operatorId: "operator_requester",
        operatorRole: "operations_admin"
      }
    );

    expect(requested.request.status).toBe("pending_approval");

    await service.approveOverride(
      overrideStore[0].id,
      {},
      {
        operatorId: "operator_approver",
        operatorRole: "risk_manager"
      }
    );

    await expect(service.assertLoanFundingExecutionAllowed()).resolves.toBeUndefined();
    await expect(service.assertStakingWriteExecutionAllowed()).resolves.toBeUndefined();
  });

  it("blocks unsafe managed withdrawals when no approved override exists", async () => {
    const { service } = createService({
      overrides: []
    });

    await expect(
      service.assertManagedWithdrawalExecutionAllowed({
        sourceWalletAddress: "0x0000000000000000000000000000000000000abc",
        sourceWalletKind: WalletKind.treasury,
        sourceWalletCustodyType: WalletCustodyType.platform_managed
      })
    ).rejects.toThrow("Managed withdrawal execution is blocked");
  });

  it("creates a durable external execution request for governed loan creation", async () => {
    mockConfig.loanFundingExecutionMode = "governed_external";

    const { service, prismaService } = createService({
      executionRequests: []
    });

    const result = await service.requestLoanContractCreation({
      loanAgreementId: "loan_agreement_1",
      chainId: 8453,
      borrowAssetId: "asset_usdc",
      collateralAssetId: "asset_eth",
      walletAddress: "0x0000000000000000000000000000000000000abc",
      contractAddress: "0x0000000000000000000000000000000000000def",
      contractMethod: "createLoan",
      borrowerWalletAddress: "0x0000000000000000000000000000000000000abc",
      principalAmount: "1000",
      collateralAmount: "1600",
      serviceFeeAmount: "20",
      installmentAmount: "170",
      installmentCount: 6,
      termMonths: 6,
      autopayEnabled: true,
      requestedByActorType: "operator",
      requestedByActorId: "operator_1",
      requestedByActorRole: "risk_manager"
    });

    expect(result.stateReused).toBe(false);
    expect(result.request.executionType).toBe("loan_contract_creation");
    expect(result.request.expectedExecutionCalldataHash).toBeTruthy();
    expect(result.request.expectedExecutionMethodSelector).toBeTruthy();
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "governed_execution.loan_contract_creation.requested"
      })
    });
  });

  it("records execution success and updates linked loan agreement state", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_loan_1"
    });
    const { service, prismaService } = createService({
      executionRequests: [executionRecord]
    });

    const result = await service.recordExecutionSuccess(
      "execution_loan_1",
      {
        blockchainTransactionHash: "0xloanhash",
        contractLoanId: "1234",
        contractAddress: "0x0000000000000000000000000000000000000def"
      },
      {
        operatorId: "operator_approver",
        operatorRole: "risk_manager"
      }
    );

    expect(result.request.status).toBe("executed");
    expect(prismaService.loanAgreement.update).toHaveBeenCalledWith({
      where: {
        id: "loan_agreement_1"
      },
      data: expect.objectContaining({
        contractLoanId: "1234",
        activationTransactionHash: "0xloanhash"
      })
    });
  });

  it("publishes a signed execution package before worker claim", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_pkg_1"
    });
    const { service } = createService({
      executionRequests: [executionRecord]
    });

    const result = await service.publishExecutionPackage("execution_pkg_1", {
      operatorId: "operator_approver",
      operatorRole: "risk_manager"
    });

    expect(result.stateReused).toBe(false);
    expect(result.request.executionPackageHash).toBeTruthy();
    expect(result.request.executionPackageSignature).toBeTruthy();
    expect(result.request.executionPackagePublishedAt).toBeTruthy();
  });

  it("claims a packaged execution request with an expiring worker lease", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_claim_1"
    });
    const { service, executionRequestStore } = createService({
      executionRequests: [executionRecord]
    });

    await service.publishExecutionPackage("execution_claim_1", {
      operatorId: "operator_approver",
      operatorRole: "risk_manager"
    });

    const result = await service.claimExecutionRequest(
      "execution_claim_1",
      "worker_1",
      120000
    );

    expect(result.claimReused).toBe(false);
    expect(result.request.claimedByWorkerId).toBe("worker_1");
    expect(executionRequestStore[0]?.claimExpiresAt).toBeTruthy();
  });

  it("records a governed dispatch after verifying the signed package", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_dispatch_1"
    });
    const { service, executionRequestStore, prismaService } = createService({
      executionRequests: [executionRecord]
    });

    await service.publishExecutionPackage("execution_dispatch_1", {
      operatorId: "operator_approver",
      operatorRole: "risk_manager"
    });
    await service.claimExecutionRequest("execution_dispatch_1", "worker_1", 120000);

    const result = await service.dispatchExecutionRequest(
      "execution_dispatch_1",
      {
        dispatchReference: "worker:worker_1:execution_dispatch_1"
      },
      "worker_1"
    );

    expect(result.dispatchRecorded).toBe(true);
    expect(result.verificationSucceeded).toBe(true);
    expect(result.request.dispatchStatus).toBe("dispatched");
    expect(executionRequestStore[0]?.claimedByWorkerId).toBeNull();
    expect(prismaService.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "governed_execution.request.dispatched"
      })
    });
  });

  it("persists dispatch failure when package verification does not match", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_dispatch_bad_1",
      canonicalExecutionPayloadText: "{\"broken\":true}",
      executionPackageHash: "0x1234",
      executionPackageChecksumSha256: "bad-checksum",
      executionPackageSignature:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa41",
      executionPackageSignatureAlgorithm: "ethereum-secp256k1-keccak256-v1",
      executionPackageSignerAddress:
        "0x0000000000000000000000000000000000000abc",
      executionPackagePublishedAt: new Date("2030-04-18T10:01:00.000Z"),
      claimedByWorkerId: "worker_1",
      claimedAt: new Date("2030-04-18T10:02:00.000Z"),
      claimExpiresAt: new Date("2030-04-18T10:04:00.000Z")
    });
    const { service, executionRequestStore } = createService({
      executionRequests: [executionRecord]
    });

    const result = await service.dispatchExecutionRequest(
      "execution_dispatch_bad_1",
      {},
      "worker_1"
    );

    expect(result.dispatchRecorded).toBe(true);
    expect(result.verificationSucceeded).toBe(false);
    expect(result.request.dispatchStatus).toBe("dispatch_failed");
    expect(result.verificationFailureReason).toBeTruthy();
    expect(executionRequestStore[0]?.dispatchFailureReason).toBeTruthy();
  });

  it("claims a dispatched execution request for the governed executor", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_executor_claim_1",
      dispatchStatus: "dispatched",
      dispatchReference: "dispatch:execution_executor_claim_1"
    });
    const { service, executionRequestStore } = createService({
      executionRequests: [executionRecord]
    });

    const result = await service.claimExecutionForExecutor(
      "execution_executor_claim_1",
      "executor_1",
      180000
    );

    expect(result.claimReused).toBe(false);
    expect(result.request.claimedByExecutorId).toBe("executor_1");
    expect(executionRequestStore[0]?.executorClaimExpiresAt).toBeTruthy();
  });

  it("records governed executor success after validating dispatch receipt details", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_executor_success_1",
      dispatchStatus: "dispatched",
      dispatchReference: "dispatch:execution_executor_success_1",
      claimedByExecutorId: "executor_1",
      executorClaimedAt: new Date("2030-04-18T10:02:00.000Z"),
      executorClaimExpiresAt: new Date("2030-04-18T10:07:00.000Z"),
      contractAddress: "0x0000000000000000000000000000000000000def"
    });
    const { service, prismaService, executionRequestStore } = createService({
      executionRequests: [executionRecord]
    });
    const signedReceipt = buildExecutorReceipt({
      requestId: "execution_executor_success_1",
      executionType: "loan_contract_creation",
      targetType: "LoanAgreement",
      targetId: "target_1",
      dispatchReference: "dispatch:execution_executor_success_1",
      executorId: "executor_1",
      outcome: "executed",
      transactionChainId: 8453,
      transactionToAddress: "0x0000000000000000000000000000000000000def",
      blockchainTransactionHash: "0xexecutorhash",
      contractLoanId: "loan_1234",
      contractAddress: "0x0000000000000000000000000000000000000def"
    });

    const result = await service.recordExecutionSuccessFromExecutor(
      "execution_executor_success_1",
      {
        dispatchReference: "dispatch:execution_executor_success_1",
        transactionChainId: 8453,
        transactionToAddress: "0x0000000000000000000000000000000000000def",
        blockchainTransactionHash: "0xexecutorhash",
        contractLoanId: "loan_1234",
        contractAddress: "0x0000000000000000000000000000000000000def",
        notedAt: "2030-04-18T10:03:00.000Z",
        canonicalReceiptText: signedReceipt.canonicalReceiptText,
        receiptHash: signedReceipt.receiptHash,
        receiptChecksumSha256: signedReceipt.receiptChecksumSha256,
        receiptSignature: signedReceipt.receiptSignature,
        receiptSignerAddress: signedReceipt.receiptSignerAddress,
        receiptSignatureAlgorithm: signedReceipt.receiptSignatureAlgorithm
      },
      "executor_1"
    );

    expect(result.request.status).toBe("executed");
    expect(result.request.claimedByExecutorId).toBeNull();
    expect(executionRequestStore[0]?.executorReceiptSubmittedAt).toBeTruthy();
    expect(prismaService.loanAgreement.update).toHaveBeenCalledWith({
      where: {
        id: "loan_agreement_1"
      },
      data: expect.objectContaining({
        contractLoanId: "loan_1234",
        activationTransactionHash: "0xexecutorhash"
      })
    });
    expect(mockProvider.getTransactionReceipt).toHaveBeenCalledWith(
      "0xexecutorhash"
    );
  });

  it("rejects governed executor success receipts when dispatch details do not match", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_executor_bad_receipt_1",
      dispatchStatus: "dispatched",
      dispatchReference: "dispatch:execution_executor_bad_receipt_1",
      claimedByExecutorId: "executor_1",
      executorClaimedAt: new Date("2030-04-18T10:02:00.000Z"),
      executorClaimExpiresAt: new Date("2030-04-18T10:07:00.000Z"),
      contractAddress: "0x0000000000000000000000000000000000000def"
    });
    const { service } = createService({
      executionRequests: [executionRecord]
    });
    const signedReceipt = buildExecutorReceipt({
      requestId: "execution_executor_bad_receipt_1",
      executionType: "loan_contract_creation",
      targetType: "LoanAgreement",
      targetId: "target_1",
      dispatchReference: "dispatch:execution_executor_bad_receipt_1",
      executorId: "executor_1",
      outcome: "executed",
      transactionChainId: 8453,
      transactionToAddress: "0x0000000000000000000000000000000000000abc",
      blockchainTransactionHash: "0xexecutorhash",
      contractLoanId: "loan_1234"
    });

    await expect(
      service.recordExecutionSuccessFromExecutor(
        "execution_executor_bad_receipt_1",
        {
          dispatchReference: "dispatch:execution_executor_bad_receipt_1",
          transactionChainId: 8453,
          transactionToAddress: "0x0000000000000000000000000000000000000abc",
          blockchainTransactionHash: "0xexecutorhash",
          contractLoanId: "loan_1234",
          notedAt: "2030-04-18T10:03:00.000Z",
          canonicalReceiptText: signedReceipt.canonicalReceiptText,
          receiptHash: signedReceipt.receiptHash,
          receiptChecksumSha256: signedReceipt.receiptChecksumSha256,
          receiptSignature: signedReceipt.receiptSignature,
          receiptSignerAddress: signedReceipt.receiptSignerAddress,
          receiptSignatureAlgorithm: signedReceipt.receiptSignatureAlgorithm
        },
        "executor_1"
      )
    ).rejects.toThrow("Governed executor receipt target address does not match");
  });

  it("records governed executor failure and resets the dispatch state", async () => {
    const executionRecord = createExecutionRequestRecord({
      id: "execution_executor_failure_1",
      dispatchStatus: "dispatched",
      dispatchReference: "dispatch:execution_executor_failure_1",
      claimedByExecutorId: "executor_1",
      executorClaimedAt: new Date("2030-04-18T10:02:00.000Z"),
      executorClaimExpiresAt: new Date("2030-04-18T10:07:00.000Z"),
      contractAddress: "0x0000000000000000000000000000000000000def"
    });
    const { service, executionRequestStore } = createService({
      executionRequests: [executionRecord]
    });
    const signedReceipt = buildExecutorReceipt({
      requestId: "execution_executor_failure_1",
      executionType: "loan_contract_creation",
      targetType: "LoanAgreement",
      targetId: "target_1",
      dispatchReference: "dispatch:execution_executor_failure_1",
      executorId: "executor_1",
      outcome: "failed",
      transactionChainId: 8453,
      transactionToAddress: "0x0000000000000000000000000000000000000def",
      failureReason: "multisig_rejected"
    });

    const result = await service.recordExecutionFailureFromExecutor(
      "execution_executor_failure_1",
      {
        dispatchReference: "dispatch:execution_executor_failure_1",
        failureReason: "multisig_rejected",
        transactionChainId: 8453,
        transactionToAddress: "0x0000000000000000000000000000000000000def",
        notedAt: "2030-04-18T10:03:00.000Z",
        canonicalReceiptText: signedReceipt.canonicalReceiptText,
        receiptHash: signedReceipt.receiptHash,
        receiptChecksumSha256: signedReceipt.receiptChecksumSha256,
        receiptSignature: signedReceipt.receiptSignature,
        receiptSignerAddress: signedReceipt.receiptSignerAddress,
        receiptSignatureAlgorithm: signedReceipt.receiptSignatureAlgorithm
      },
      "executor_1"
    );

    expect(result.request.status).toBe("execution_failed");
    expect(result.request.dispatchStatus).toBe("dispatch_failed");
    expect(executionRequestStore[0]?.claimedByExecutorId).toBeNull();
    expect(executionRequestStore[0]?.executorReceiptSubmittedAt).toBeTruthy();
  });

  it("rejects governed executor success when the transaction receipt is missing onchain", async () => {
    mockProvider.getTransactionReceipt.mockResolvedValueOnce(null as never);
    const executionRecord = createExecutionRequestRecord({
      id: "execution_executor_missing_chain_receipt_1",
      dispatchStatus: "dispatched",
      dispatchReference: "dispatch:execution_executor_missing_chain_receipt_1",
      claimedByExecutorId: "executor_1",
      executorClaimedAt: new Date("2030-04-18T10:02:00.000Z"),
      executorClaimExpiresAt: new Date("2030-04-18T10:07:00.000Z"),
      contractAddress: "0x0000000000000000000000000000000000000def"
    });
    const { service } = createService({
      executionRequests: [executionRecord]
    });
    const signedReceipt = buildExecutorReceipt({
      requestId: "execution_executor_missing_chain_receipt_1",
      executionType: "loan_contract_creation",
      targetType: "LoanAgreement",
      targetId: "target_1",
      dispatchReference: "dispatch:execution_executor_missing_chain_receipt_1",
      executorId: "executor_1",
      outcome: "executed",
      transactionChainId: 8453,
      transactionToAddress: "0x0000000000000000000000000000000000000def",
      blockchainTransactionHash: "0xmissingreceipt",
      contractLoanId: "loan_1234"
    });

    await expect(
      service.recordExecutionSuccessFromExecutor(
        "execution_executor_missing_chain_receipt_1",
        {
          dispatchReference: "dispatch:execution_executor_missing_chain_receipt_1",
          transactionChainId: 8453,
          transactionToAddress: "0x0000000000000000000000000000000000000def",
          blockchainTransactionHash: "0xmissingreceipt",
          contractLoanId: "loan_1234",
          notedAt: "2030-04-18T10:03:00.000Z",
          canonicalReceiptText: signedReceipt.canonicalReceiptText,
          receiptHash: signedReceipt.receiptHash,
          receiptChecksumSha256: signedReceipt.receiptChecksumSha256,
          receiptSignature: signedReceipt.receiptSignature,
          receiptSignerAddress: signedReceipt.receiptSignerAddress,
          receiptSignatureAlgorithm: signedReceipt.receiptSignatureAlgorithm
        },
        "executor_1"
      )
    ).rejects.toThrow("Governed execution transaction receipt was not found onchain");
  });

  it("rejects governed executor success when onchain calldata does not match the bound execution intent", async () => {
    mockProvider.getTransaction.mockResolvedValueOnce({
      data: "0x12345678"
    });
    const executionRecord = createExecutionRequestRecord({
      id: "execution_executor_bad_calldata_1",
      dispatchStatus: "dispatched",
      dispatchReference: "dispatch:execution_executor_bad_calldata_1",
      claimedByExecutorId: "executor_1",
      executorClaimedAt: new Date("2030-04-18T10:02:00.000Z"),
      executorClaimExpiresAt: new Date("2030-04-18T10:07:00.000Z"),
      contractAddress: "0x0000000000000000000000000000000000000def",
      expectedExecutionCalldataHash:
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      expectedExecutionMethodSelector: "0xbbbbbbbb"
    });
    const { service } = createService({
      executionRequests: [executionRecord]
    });
    const signedReceipt = buildExecutorReceipt({
      requestId: "execution_executor_bad_calldata_1",
      executionType: "loan_contract_creation",
      targetType: "LoanAgreement",
      targetId: "target_1",
      dispatchReference: "dispatch:execution_executor_bad_calldata_1",
      executorId: "executor_1",
      outcome: "executed",
      transactionChainId: 8453,
      transactionToAddress: "0x0000000000000000000000000000000000000def",
      blockchainTransactionHash: "0xbadcalldata",
      contractLoanId: "loan_1234"
    });

    await expect(
      service.recordExecutionSuccessFromExecutor(
        "execution_executor_bad_calldata_1",
        {
          dispatchReference: "dispatch:execution_executor_bad_calldata_1",
          transactionChainId: 8453,
          transactionToAddress: "0x0000000000000000000000000000000000000def",
          blockchainTransactionHash: "0xbadcalldata",
          contractLoanId: "loan_1234",
          notedAt: "2030-04-18T10:03:00.000Z",
          canonicalReceiptText: signedReceipt.canonicalReceiptText,
          receiptHash: signedReceipt.receiptHash,
          receiptChecksumSha256: signedReceipt.receiptChecksumSha256,
          receiptSignature: signedReceipt.receiptSignature,
          receiptSignerAddress: signedReceipt.receiptSignerAddress,
          receiptSignatureAlgorithm: signedReceipt.receiptSignatureAlgorithm
        },
        "executor_1"
      )
    ).rejects.toThrow(
      "Governed execution onchain transaction calldata does not match the expected execution binding"
    );
  });
});
