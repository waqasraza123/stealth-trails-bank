import { ethers } from "ethers";
import {
  AssetStatus,
  AssetType,
  LedgerAccountType,
  LedgerPostingDirection,
  Prisma,
  SolvencyEvidenceFreshness,
  SolvencyIssueClassification,
  SolvencyPolicyStateStatus,
  SolvencySnapshotStatus,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { SolvencyService } from "./solvency.service";

const mockProvider = {
  getBalance: jest.fn()
};

jest.mock("@stealth-trails-bank/config/api", () => ({
  loadProductChainRuntimeConfig: () => ({
    productChainId: 8453
  }),
  loadSolvencyRuntimeConfig: () => ({
    environment: "production",
    evidenceStaleAfterSeconds: 300,
    warningReserveRatioBps: 10500,
    criticalReserveRatioBps: 10000,
    reportSignerPrivateKey:
      "0x59c6995e998f97a5a0044966f0945384d8f6d6e74a09a3db9e8f4c7a89f5f001",
    resumeRequestAllowedOperatorRoles: ["operations_admin"],
    resumeApproverAllowedOperatorRoles: ["operations_admin", "compliance_admin"]
  }),
  loadOptionalBlockchainContractReadRuntimeConfig: () => ({
    rpcUrl: "https://rpc.example.com"
  })
}));

jest.mock("@stealth-trails-bank/contracts-sdk", () => ({
  createJsonRpcProvider: () => mockProvider
}));

type ScenarioInput = {
  ledgerAvailableAmount: string;
  ledgerReservedAmount?: string;
  projectionAvailableAmount?: string;
  projectionPendingAmount?: string;
  reserveWallets?: Array<{
    id: string;
    address: string;
    kind: WalletKind;
    custodyType: WalletCustodyType;
  }>;
  reserveBalancesByWalletId?: Record<string, string>;
  reserveReadFailuresByWalletId?: Record<string, Error>;
  previousEvidenceByWalletId?: Record<
    string,
    {
      observedAt: Date;
      observedBalanceAmount: string;
    }
  >;
  reserveEncumbrancesByWalletId?: Record<string, string>;
  mismatchOpenCount?: number;
  mismatchCriticalCount?: number;
  workspaceSnapshots?: Array<{
    id: string;
    generatedAt: Date;
    status: SolvencySnapshotStatus;
    evidenceFreshness: SolvencyEvidenceFreshness;
    totalLiabilityAmount: Prisma.Decimal;
    totalObservedReserveAmount: Prisma.Decimal;
    totalUsableReserveAmount: Prisma.Decimal;
    totalEncumberedReserveAmount: Prisma.Decimal;
    totalReserveDeltaAmount: Prisma.Decimal;
    assetCount: number;
    issueCount: number;
    policyActionsTriggered: boolean;
    completedAt: Date | null;
    failureCode: string | null;
    failureMessage: string | null;
    reports?: Array<{
      id: string;
      snapshotId: string;
      environment: WorkerRuntimeEnvironment;
      chainId: number;
      reportVersion: number;
      reportHash: string;
      reportChecksumSha256: string;
      canonicalPayload: Prisma.JsonValue | null;
      canonicalPayloadText: string;
      signature: string;
      signatureAlgorithm: string;
      signerAddress: string;
      publishedAt: Date;
    }>;
  }>;
};

function decimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function createScenario(input: ScenarioInput) {
  const asset = {
    id: "asset_eth",
    symbol: "ETH",
    displayName: "Ether",
    decimals: 18,
    chainId: 8453,
    assetType: AssetType.native,
    contractAddress: null,
    status: AssetStatus.active
  };
  const reserveWallets =
    input.reserveWallets ??
    [
      {
        id: "wallet_treasury_1",
        address: "0x0000000000000000000000000000000000000aaa",
        kind: WalletKind.treasury,
        custodyType: WalletCustodyType.multisig_controlled
      }
    ];
  const prismaService = {
    asset: {
      findMany: jest.fn().mockResolvedValue([asset])
    },
    wallet: {
      findMany: jest.fn().mockResolvedValue(
        reserveWallets.map((wallet) => ({
          ...wallet,
          chainId: 8453,
          status: WalletStatus.active,
          customerAccountId: null
        }))
      )
    },
    ledgerReconciliationScanRun: {
      findFirst: jest.fn().mockResolvedValue(null)
    },
    ledgerReconciliationMismatch: {
      groupBy: jest.fn().mockResolvedValue(
        input.mismatchOpenCount
          ? [
              {
                assetId: asset.id,
                severity:
                  input.mismatchCriticalCount && input.mismatchCriticalCount > 0
                    ? "critical"
                    : "warning",
                _count: {
                  _all: input.mismatchOpenCount
                }
              }
            ]
          : []
      )
    },
    ledgerAccount: {
      findMany: jest.fn().mockResolvedValue(
        [
          {
            id: "ledger_available",
            assetId: asset.id,
            chainId: 8453,
            customerAccountId: "customer_account_1",
            accountType: LedgerAccountType.customer_asset_liability,
            ledgerPostings: [
              {
                direction: LedgerPostingDirection.credit,
                amount: decimal(input.ledgerAvailableAmount)
              }
            ]
          },
          input.ledgerReservedAmount && input.ledgerReservedAmount !== "0"
            ? {
                id: "ledger_reserved",
                assetId: asset.id,
                chainId: 8453,
                customerAccountId: "customer_account_1",
                accountType:
                  LedgerAccountType.customer_asset_pending_withdrawal_liability,
                ledgerPostings: [
                  {
                    direction: LedgerPostingDirection.credit,
                    amount: decimal(input.ledgerReservedAmount)
                  }
                ]
              }
            : null
        ].filter(Boolean)
      )
    },
    customerAssetBalance: {
      findMany: jest.fn().mockResolvedValue([
        {
          customerAccountId: "customer_account_1",
          assetId: asset.id,
          asset: {
            id: asset.id
          },
          availableBalance: decimal(
            input.projectionAvailableAmount ?? input.ledgerAvailableAmount
          ),
          pendingBalance: decimal(
            input.projectionPendingAmount ?? input.ledgerReservedAmount ?? "0"
          )
        }
      ])
    },
    transactionIntent: {
      findMany: jest.fn().mockResolvedValue(
        reserveWallets
          .map((wallet) => {
            const amount = input.reserveEncumbrancesByWalletId?.[wallet.id];

            if (!amount) {
              return null;
            }

            return {
              sourceWalletId: wallet.id,
              assetId: asset.id,
              requestedAmount: decimal(amount)
            };
          })
          .filter(Boolean)
      )
    },
    solvencyReserveEvidence: {
      findMany: jest.fn().mockResolvedValue(
        reserveWallets
          .map((wallet) => {
            const previous = input.previousEvidenceByWalletId?.[wallet.id];

            if (!previous) {
              return null;
            }

            return {
              walletId: wallet.id,
              assetId: asset.id,
              evidenceFreshness: SolvencyEvidenceFreshness.fresh,
              observedAt: previous.observedAt,
              observedBalanceAmount: decimal(previous.observedBalanceAmount)
            };
          })
          .filter(Boolean)
      )
    },
    solvencySnapshot: {
      create: jest.fn().mockResolvedValue({
        id: "snapshot_1",
        generatedAt: new Date("2026-04-18T12:00:00.000Z")
      }),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    customerAccount: {
      findFirst: jest.fn().mockResolvedValue({
        id: "customer_account_1"
      })
    },
    solvencyLiabilityLeaf: {
      findMany: jest.fn()
    },
    solvencyReport: {
      findFirst: jest.fn()
    },
    solvencyPolicyResumeRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn()
    },
    solvencyPolicyState: {
      findUnique: jest.fn()
    },
    auditEvent: {
      create: jest.fn().mockResolvedValue({})
    },
    $transaction: jest.fn()
  } as unknown as PrismaService & Record<string, any>;

  const persistedState: { current: Record<string, unknown> | null } = {
    current: {
      id: "policy_1",
      environment: WorkerRuntimeEnvironment.production,
      status: SolvencyPolicyStateStatus.normal,
      pauseWithdrawalApprovals: false,
      pauseManagedWithdrawalExecution: false,
      pauseLoanFunding: false,
      pauseStakingWrites: false,
      requireManualOperatorReview: false,
      latestSnapshotId: null,
      triggeredAt: null,
      clearedAt: null,
      reasonCode: null,
      reasonSummary: null,
      manualResumeRequired: false,
      manualResumeRequestedAt: null,
      manualResumeApprovedAt: null,
      manualResumeApprovedByOperatorId: null,
      manualResumeApprovedByOperatorRole: null,
      metadata: null,
      updatedAt: new Date("2026-04-18T11:59:00.000Z")
    }
  };
  const persistedSnapshot: { current: Record<string, unknown> | null } = {
    current: null
  };
  const persistedLiabilityLeaves: Array<Record<string, unknown>> = [];
  const persistedReports: Array<Record<string, unknown>> = [];
  const persistedResumeRequests: Array<Record<string, unknown>> = [];
  const transactionClient = {
    solvencySnapshot: {
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        persistedSnapshot.current = {
          id: where.id,
          environment: WorkerRuntimeEnvironment.production,
          chainId: 8453,
          generatedAt: new Date("2026-04-18T12:00:00.000Z"),
          completedAt: data.completedAt ?? null,
          latestReconciliationScanRunId:
            data.latestReconciliationScanRunId ?? null,
          totalLiabilityAmount: data.totalLiabilityAmount ?? decimal("0"),
          totalObservedReserveAmount:
            data.totalObservedReserveAmount ?? decimal("0"),
          totalUsableReserveAmount: data.totalUsableReserveAmount ?? decimal("0"),
          totalEncumberedReserveAmount:
            data.totalEncumberedReserveAmount ?? decimal("0"),
          totalReserveDeltaAmount: data.totalReserveDeltaAmount ?? decimal("0"),
          assetCount: data.assetCount ?? 0,
          issueCount: data.issueCount ?? 0,
          status: data.status,
          evidenceFreshness: data.evidenceFreshness,
          policyActionsTriggered: data.policyActionsTriggered ?? false,
          summarySnapshot: data.summarySnapshot ?? null,
          policyActionSnapshot: data.policyActionSnapshot ?? null,
          failureCode: data.failureCode ?? null,
          failureMessage: data.failureMessage ?? null,
          reports: [...persistedReports],
          assetSnapshots: [],
          issues: [],
          reserveEvidence: []
        };

        return persistedSnapshot.current;
      }),
      findUniqueOrThrow: jest
        .fn()
        .mockImplementation(async () =>
          persistedSnapshot.current
            ? {
                ...persistedSnapshot.current,
                reports: [...persistedReports]
              }
            : null
        ),
      findUnique: jest.fn().mockImplementation(async ({ where }) =>
        persistedSnapshot.current && persistedSnapshot.current.id === where.id
          ? {
              ...persistedSnapshot.current,
              reports: [...persistedReports]
            }
          : null
      )
    },
    solvencyAssetSnapshot: {
      createMany: jest.fn().mockResolvedValue({ count: 1 })
    },
    solvencyLiabilityLeaf: {
      createMany: jest.fn().mockImplementation(async ({ data }) => {
        persistedLiabilityLeaves.push(...data);
        return { count: data.length };
      })
    },
    solvencyReport: {
      create: jest.fn().mockImplementation(async ({ data }) => {
        const record = {
          id: "report_1",
          createdAt: new Date("2026-04-18T12:00:01.000Z"),
          ...data
        };
        persistedReports.splice(0, persistedReports.length, record);
        return record;
      })
    },
    solvencyReserveEvidence: {
      createMany: jest.fn().mockResolvedValue({ count: reserveWallets.length })
    },
    solvencyIssue: {
      createMany: jest.fn().mockResolvedValue({ count: 0 })
    },
    solvencyPolicyState: {
      findUnique: jest.fn().mockImplementation(async () => persistedState.current),
      create: jest.fn().mockImplementation(async ({ data }) => {
        persistedState.current = {
          id: "policy_1",
          environment: WorkerRuntimeEnvironment.production,
          updatedAt: new Date("2026-04-18T12:00:01.000Z"),
          ...data
        };

        return persistedState.current;
      }),
      update: jest.fn().mockImplementation(async ({ data }) => {
        persistedState.current = {
          ...(persistedState.current ?? {}),
          updatedAt: new Date("2026-04-18T12:00:01.000Z"),
          ...data
        };

        return persistedState.current;
      })
    },
    solvencyPolicyResumeRequest: {
      findUnique: jest.fn().mockImplementation(async ({ where }) =>
        persistedResumeRequests.find((item) => item.id === where.id) ?? null
      ),
      create: jest.fn().mockImplementation(async ({ data }) => {
        const record = {
          id: `resume_request_${persistedResumeRequests.length + 1}`,
          requestedAt: new Date("2026-04-18T12:00:02.000Z"),
          approvedByOperatorId: null,
          approvedByOperatorRole: null,
          approvalNote: null,
          approvedAt: null,
          rejectedByOperatorId: null,
          rejectedByOperatorRole: null,
          rejectionNote: null,
          rejectedAt: null,
          createdAt: new Date("2026-04-18T12:00:02.000Z"),
          updatedAt: new Date("2026-04-18T12:00:02.000Z"),
          ...data
        };
        persistedResumeRequests.push(record);
        return record;
      }),
      update: jest.fn().mockImplementation(async ({ where, data }) => {
        const index = persistedResumeRequests.findIndex((item) => item.id === where.id);
        if (index === -1) {
          return null;
        }

        persistedResumeRequests[index] = {
          ...persistedResumeRequests[index],
          ...data,
          updatedAt: new Date("2026-04-18T12:00:03.000Z")
        };
        return persistedResumeRequests[index];
      }),
      updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
        let count = 0;
        persistedResumeRequests.forEach((item, index) => {
          if (
            item.environment === where.environment &&
            item.status === where.status
          ) {
            persistedResumeRequests[index] = {
              ...item,
              ...data,
              updatedAt: new Date("2026-04-18T12:00:03.000Z")
            };
            count += 1;
          }
        });
        return { count };
      }),
      findFirst: jest.fn().mockImplementation(async ({ where }) => {
        const records = persistedResumeRequests
          .filter(
            (item) =>
              item.environment === where.environment &&
              item.status === where.status
          )
          .sort(
            (left, right) =>
              new Date(String(right.requestedAt)).getTime() -
              new Date(String(left.requestedAt)).getTime()
          );
        return records[0] ?? null;
      })
    },
    auditEvent: {
      create: jest.fn().mockResolvedValue({})
    }
  };

  (prismaService.$transaction as jest.Mock).mockImplementation(
    async (callback: (client: typeof transactionClient) => unknown) =>
      callback(transactionClient)
  );
  (prismaService.solvencyPolicyState.findUnique as jest.Mock).mockImplementation(
    async () => persistedState.current
  );
  (prismaService.solvencySnapshot.findFirst as jest.Mock).mockImplementation(
    async ({ where }) => {
      if (persistedSnapshot.current) {
        if (where?.id && persistedSnapshot.current.id !== where.id) {
          return null;
        }

        if (where?.status && persistedSnapshot.current.status !== where.status) {
          return null;
        }

        if (where?.reports?.some && persistedReports.length === 0) {
          return null;
        }

        return {
          ...persistedSnapshot.current,
          reports: [...persistedReports]
        };
      }

      if (!input.workspaceSnapshots) {
        return null;
      }

      if (where?.status) {
        return (
          input.workspaceSnapshots.find((snapshot) => snapshot.status === where.status) ??
          null
        );
      }

      return input.workspaceSnapshots[0] ?? null;
    }
  );
  (prismaService.solvencySnapshot.findMany as jest.Mock).mockImplementation(
    async () => input.workspaceSnapshots ?? []
  );
  (prismaService.solvencySnapshot.findUnique as jest.Mock).mockImplementation(
    async ({ where }) => {
      if (persistedSnapshot.current && persistedSnapshot.current.id === where.id) {
        return {
          ...persistedSnapshot.current,
          reports: [...persistedReports],
          assetSnapshots: [],
          issues: [],
          reserveEvidence: []
        };
      }

      return (
        input.workspaceSnapshots?.find((snapshot) => snapshot.id === where.id) ?? null
      );
    }
  );
  (prismaService.solvencyLiabilityLeaf.findMany as jest.Mock).mockImplementation(
    async ({ where }) => {
      const rows = persistedLiabilityLeaves.filter((item) => {
        if (item.snapshotId !== where.snapshotId) {
          return false;
        }

        if (where.customerAccountId && item.customerAccountId !== where.customerAccountId) {
          return false;
        }

        return true;
      });

      return rows.map((item) => ({
        ...item,
        asset: {
          id: asset.id,
          symbol: asset.symbol,
          displayName: asset.displayName,
          decimals: asset.decimals,
          chainId: asset.chainId,
          assetType: asset.assetType
        }
      }));
    }
  );
  (prismaService.solvencyPolicyResumeRequest.findFirst as jest.Mock).mockImplementation(
    async ({ where }) =>
      persistedResumeRequests.find(
        (item) =>
          item.environment === where.environment && item.status === where.status
      ) ?? null
  );
  (prismaService.solvencyPolicyResumeRequest.findUnique as jest.Mock).mockImplementation(
    async ({ where }) =>
      persistedResumeRequests.find((item) => item.id === where.id) ?? null
  );

  mockProvider.getBalance.mockImplementation(async (walletAddress: string) => {
    const wallet = reserveWallets.find((item) => item.address === walletAddress);

    if (!wallet) {
      throw new Error("Unknown wallet.");
    }

    const failure = input.reserveReadFailuresByWalletId?.[wallet.id];

    if (failure) {
      throw failure;
    }

    const balance = input.reserveBalancesByWalletId?.[wallet.id] ?? "0";
    return ethers.utils.parseUnits(balance, asset.decimals);
  });

  const reviewCasesService = {
    openOrReuseReviewCase: jest.fn().mockResolvedValue({
      reviewCase: {
        id: "review_case_1"
      },
      reviewCaseReused: false
    })
  } as unknown as ReviewCasesService;

  return {
    service: new SolvencyService(prismaService, reviewCasesService),
    prismaService,
    transactionClient,
    reviewCasesService,
    persistedReports,
    persistedResumeRequests
  };
}

describe("SolvencyService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("computes a healthy asset snapshot with authoritative liabilities and reserves", async () => {
    const { service, transactionClient } = createScenario({
      ledgerAvailableAmount: "10",
      reserveBalancesByWalletId: {
        wallet_treasury_1: "12"
      }
    });

    const result = await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });

    const createdAssetRow =
      (transactionClient.solvencyAssetSnapshot.createMany as jest.Mock).mock
        .calls[0][0].data[0];
    const createdLiabilityLeaf =
      (transactionClient.solvencyLiabilityLeaf.createMany as jest.Mock).mock
        .calls[0][0].data[0];
    const createdReport = (transactionClient.solvencyReport.create as jest.Mock).mock
      .calls[0][0].data;

    expect(createdAssetRow.totalLiabilityAmount.toString()).toBe("10");
    expect(createdAssetRow.usableReserveAmount.toString()).toBe("12");
    expect(createdAssetRow.liabilityLeafCount).toBe(1);
    expect(createdAssetRow.liabilityMerkleRoot).toBeTruthy();
    expect(createdLiabilityLeaf.leafIndex).toBe(0);
    expect(createdReport.reportHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(createdReport.signature).toMatch(/^0x[0-9a-f]+$/);
    expect(result.snapshot.status).toBe(SolvencySnapshotStatus.healthy);
    expect(result.policyState.status).toBe(SolvencyPolicyStateStatus.normal);
    expect(result.issueCount).toBe(0);
  });

  it("keeps reserved liabilities and encumbered reserves out of freely usable amounts", async () => {
    const { service, transactionClient } = createScenario({
      ledgerAvailableAmount: "8",
      ledgerReservedAmount: "2",
      reserveBalancesByWalletId: {
        wallet_treasury_1: "12"
      },
      reserveEncumbrancesByWalletId: {
        wallet_treasury_1: "1"
      }
    });

    await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });

    const createdAssetRow =
      (transactionClient.solvencyAssetSnapshot.createMany as jest.Mock).mock
        .calls[0][0].data[0];
    const createdEvidenceRow =
      (transactionClient.solvencyReserveEvidence.createMany as jest.Mock).mock
        .calls[0][0].data[0];

    expect(createdAssetRow.liabilityReservedAmount.toString()).toBe("2");
    expect(createdAssetRow.totalLiabilityAmount.toString()).toBe("10");
    expect(createdAssetRow.encumberedReserveAmount.toString()).toBe("1");
    expect(createdAssetRow.usableReserveAmount.toString()).toBe("11");
    expect(createdEvidenceRow.usableBalanceAmount.toString()).toBe("11");
  });

  it("detects reserve shortfalls and triggers paused policy controls", async () => {
    const { service, transactionClient, reviewCasesService } = createScenario({
      ledgerAvailableAmount: "10",
      reserveBalancesByWalletId: {
        wallet_treasury_1: "8"
      }
    });

    const result = await service.generateSnapshot({
      actorType: "operator",
      actorId: "operator_1"
    });

    const createdIssues =
      (transactionClient.solvencyIssue.createMany as jest.Mock).mock.calls[0][0]
        .data;
    const policyUpdate =
      (transactionClient.solvencyPolicyState.update as jest.Mock).mock.calls[0][0]
        .data;

    expect(
      createdIssues.some(
        (issue: { classification: SolvencyIssueClassification }) =>
          issue.classification === SolvencyIssueClassification.reserve_shortfall
      )
    ).toBe(true);
    expect(policyUpdate.pauseWithdrawalApprovals).toBe(true);
    expect(policyUpdate.pauseManagedWithdrawalExecution).toBe(true);
    expect(policyUpdate.pauseLoanFunding).toBe(true);
    expect(policyUpdate.pauseStakingWrites).toBe(true);
    expect(result.snapshot.status).toBe(SolvencySnapshotStatus.critical);
    expect(result.policyState.status).toBe(SolvencyPolicyStateStatus.paused);
    expect(result.policyState.manualResumeRequired).toBe(true);
    expect(reviewCasesService.openOrReuseReviewCase).toHaveBeenCalledTimes(1);
  });

  it("marks reserve evidence as missing and critical when liabilities cannot be covered with fresh reads", async () => {
    const { service, transactionClient } = createScenario({
      ledgerAvailableAmount: "5",
      reserveReadFailuresByWalletId: {
        wallet_treasury_1: new Error("RPC timeout")
      }
    });

    const result = await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });

    const createdIssues =
      (transactionClient.solvencyIssue.createMany as jest.Mock).mock.calls[0][0]
        .data;
    const reserveEvidenceRow =
      (transactionClient.solvencyReserveEvidence.createMany as jest.Mock).mock
        .calls[0][0].data[0];

    expect(reserveEvidenceRow.evidenceFreshness).toBe(
      SolvencyEvidenceFreshness.missing
    );
    expect(
      createdIssues.some(
        (issue: { classification: SolvencyIssueClassification }) =>
          issue.classification ===
          SolvencyIssueClassification.unknown_reserve_state
      )
    ).toBe(true);
    expect(result.snapshot.status).toBe(SolvencySnapshotStatus.critical);
    expect(result.policyState.status).toBe(SolvencyPolicyStateStatus.paused);
  });

  it("degrades to guarded state when one reserve source is stale but usable reserves still cover liabilities", async () => {
    const { service, transactionClient } = createScenario({
      ledgerAvailableAmount: "5",
      reserveWallets: [
        {
          id: "wallet_treasury_1",
          address: "0x0000000000000000000000000000000000000aaa",
          kind: WalletKind.treasury,
          custodyType: WalletCustodyType.multisig_controlled
        },
        {
          id: "wallet_operational_1",
          address: "0x0000000000000000000000000000000000000bbb",
          kind: WalletKind.operational,
          custodyType: WalletCustodyType.platform_managed
        }
      ],
      reserveBalancesByWalletId: {
        wallet_treasury_1: "6"
      },
      reserveReadFailuresByWalletId: {
        wallet_operational_1: new Error("Read failed")
      },
      previousEvidenceByWalletId: {
        wallet_operational_1: {
          observedAt: new Date("2026-04-18T11:55:00.000Z"),
          observedBalanceAmount: "4"
        }
      }
    });

    const result = await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });

    const createdIssues =
      (transactionClient.solvencyIssue.createMany as jest.Mock).mock.calls[0][0]
        .data;

    expect(
      createdIssues.some(
        (issue: { classification: SolvencyIssueClassification }) =>
          issue.classification === SolvencyIssueClassification.stale_evidence
      )
    ).toBe(true);
    expect(result.snapshot.status).toBe(SolvencySnapshotStatus.warning);
    expect(result.policyState.status).toBe(SolvencyPolicyStateStatus.guarded);
  });

  it("returns historical workspace snapshots with latest healthy evidence", async () => {
    const { service } = createScenario({
      ledgerAvailableAmount: "0",
      reserveBalancesByWalletId: {
        wallet_treasury_1: "0"
      },
      workspaceSnapshots: [
        {
          id: "snapshot_critical",
          generatedAt: new Date("2026-04-18T12:00:00.000Z"),
          completedAt: new Date("2026-04-18T12:00:01.000Z"),
          status: SolvencySnapshotStatus.critical,
          evidenceFreshness: SolvencyEvidenceFreshness.missing,
          totalLiabilityAmount: decimal("10"),
          totalObservedReserveAmount: decimal("0"),
          totalUsableReserveAmount: decimal("0"),
          totalEncumberedReserveAmount: decimal("0"),
          totalReserveDeltaAmount: decimal("-10"),
          assetCount: 1,
          issueCount: 2,
          policyActionsTriggered: true,
          failureCode: null,
          failureMessage: null
        },
        {
          id: "snapshot_healthy",
          generatedAt: new Date("2026-04-18T11:00:00.000Z"),
          completedAt: new Date("2026-04-18T11:00:01.000Z"),
          status: SolvencySnapshotStatus.healthy,
          evidenceFreshness: SolvencyEvidenceFreshness.fresh,
          totalLiabilityAmount: decimal("8"),
          totalObservedReserveAmount: decimal("10"),
          totalUsableReserveAmount: decimal("10"),
          totalEncumberedReserveAmount: decimal("0"),
          totalReserveDeltaAmount: decimal("2"),
          assetCount: 1,
          issueCount: 0,
          policyActionsTriggered: false,
          failureCode: null,
          failureMessage: null
        }
      ]
    });

    const workspace = await service.getWorkspace(5);

    expect(workspace.latestSnapshot?.id).toBe("snapshot_critical");
    expect(workspace.latestHealthySnapshotAt).toBe("2026-04-18T11:00:00.000Z");
    expect(workspace.recentSnapshots).toHaveLength(2);
    expect(workspace.limit).toBe(5);
  });

  it("returns customer liability inclusion proofs from persisted liability leaves", async () => {
    const { service } = createScenario({
      ledgerAvailableAmount: "10",
      reserveBalancesByWalletId: {
        wallet_treasury_1: "12"
      }
    });

    const generated = await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });
    const proof = await service.getCustomerLiabilityInclusionProof(
      "supabase_user_1",
      generated.snapshot.id
    );

    expect(proof.snapshot.id).toBe(generated.snapshot.id);
    expect(proof.report.reportHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(proof.proofs).toHaveLength(1);
    expect(proof.proofs[0]?.payload.totalLiabilityAmount).toBe("10");
    expect(proof.proofs[0]?.rootHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(Array.isArray(proof.proofs[0]?.proof)).toBe(true);
  });

  it("holds paused policy controls until a governed manual resume is approved", async () => {
    const { service } = createScenario({
      ledgerAvailableAmount: "10",
      reserveBalancesByWalletId: {
        wallet_treasury_1: "8"
      }
    });

    await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });

    mockProvider.getBalance.mockResolvedValueOnce(
      ethers.utils.parseUnits("12", 18)
    );
    const secondResult = await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });

    expect(secondResult.snapshot.status).toBe(SolvencySnapshotStatus.healthy);
    expect(secondResult.policyState.status).toBe(SolvencyPolicyStateStatus.paused);
    expect(secondResult.policyState.manualResumeRequired).toBe(true);
  });

  it("creates and approves governed manual resume requests with dual control", async () => {
    const { service, persistedResumeRequests } = createScenario({
      ledgerAvailableAmount: "10",
      reserveBalancesByWalletId: {
        wallet_treasury_1: "8"
      }
    });

    await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });

    mockProvider.getBalance.mockResolvedValueOnce(
      ethers.utils.parseUnits("12", 18)
    );
    const healthy = await service.generateSnapshot({
      actorType: "worker",
      actorId: "worker_1"
    });

    const requested = await service.requestPolicyResume(
      healthy.snapshot.id,
      healthy.policyState.updatedAt,
      "Reviewed signed snapshot",
      "operator_requester",
      "operations_admin"
    );

    expect(requested.request.status).toBe("pending_approval");
    expect(persistedResumeRequests).toHaveLength(1);

    const approved = await service.approvePolicyResume(
      requested.request.id,
      "Second operator approved",
      "operator_approver",
      "compliance_admin"
    );

    expect(approved.request.status).toBe("approved");
    expect(approved.policyState.status).toBe(SolvencyPolicyStateStatus.normal);
    expect(approved.policyState.manualResumeRequired).toBe(false);
  });
});
