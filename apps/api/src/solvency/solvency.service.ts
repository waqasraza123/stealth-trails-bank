import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  loadOptionalBlockchainContractReadRuntimeConfig,
  loadProductChainRuntimeConfig,
  loadSolvencyRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { createJsonRpcProvider } from "@stealth-trails-bank/contracts-sdk";
import {
  AssetStatus,
  AssetType,
  LedgerAccountType,
  LedgerPostingDirection,
  Prisma,
  ReviewCaseType,
  SolvencyEvidenceFreshness,
  SolvencyIssueClassification,
  SolvencyIssueSeverity,
  SolvencyPolicyStateStatus,
  SolvencyReserveSourceType,
  SolvencySnapshotStatus,
  TransactionIntentStatus,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment
} from "@prisma/client";
import { ethers } from "ethers";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { ReviewCasesService } from "../review-cases/review-cases.service";

const ERC20_BALANCE_OF_ABI = [
  "function balanceOf(address account) view returns (uint256)"
] as const;
const DEFAULT_WORKSPACE_LIMIT = 10;
const RESERVE_WALLET_KINDS = [
  WalletKind.treasury,
  WalletKind.operational,
  WalletKind.contract
] as const;
const EXECUTION_ENCUMBERED_STATUSES = [
  TransactionIntentStatus.approved,
  TransactionIntentStatus.queued,
  TransactionIntentStatus.broadcast,
  TransactionIntentStatus.confirmed
] as const;

type SnapshotActor = {
  actorType: "operator" | "worker" | "system";
  actorId: string | null;
};

type SolvencyPolicyProjection = {
  environment: WorkerRuntimeEnvironment;
  status: SolvencyPolicyStateStatus;
  pauseWithdrawalApprovals: boolean;
  pauseManagedWithdrawalExecution: boolean;
  pauseLoanFunding: boolean;
  pauseStakingWrites: boolean;
  requireManualOperatorReview: boolean;
  latestSnapshotId: string | null;
  triggeredAt: string | null;
  clearedAt: string | null;
  reasonCode: string | null;
  reasonSummary: string | null;
  metadata: Prisma.JsonValue | null;
  updatedAt: string;
};

type SolvencyWorkspaceSummarySnapshot = {
  id: string;
  environment: WorkerRuntimeEnvironment;
  status: SolvencySnapshotStatus;
  evidenceFreshness: SolvencyEvidenceFreshness;
  generatedAt: string;
  completedAt: string | null;
  totalLiabilityAmount: string;
  totalObservedReserveAmount: string;
  totalUsableReserveAmount: string;
  totalEncumberedReserveAmount: string;
  totalReserveDeltaAmount: string;
  assetCount: number;
  issueCount: number;
  policyActionsTriggered: boolean;
  failureCode: string | null;
  failureMessage: string | null;
};

export type SolvencyWorkspaceResult = {
  generatedAt: string;
  policyState: SolvencyPolicyProjection;
  latestSnapshot: SolvencyWorkspaceSummarySnapshot | null;
  latestHealthySnapshotAt: string | null;
  recentSnapshots: SolvencyWorkspaceSummarySnapshot[];
  limit: number;
};

type SolvencyAssetDetailProjection = {
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
    assetType: AssetType;
  };
  status: SolvencySnapshotStatus;
  evidenceFreshness: SolvencyEvidenceFreshness;
  liabilityAvailableAmount: string;
  liabilityReservedAmount: string;
  pendingCreditAmount: string;
  totalLiabilityAmount: string;
  projectionAvailableAmount: string;
  projectionPendingAmount: string;
  observedReserveAmount: string;
  usableReserveAmount: string;
  encumberedReserveAmount: string;
  excludedReserveAmount: string;
  reserveDeltaAmount: string;
  reserveRatioBps: number | null;
  openReconciliationMismatchCount: number;
  criticalReconciliationMismatchCount: number;
  issueCount: number;
  summarySnapshot: Prisma.JsonValue | null;
};

type SolvencyIssueProjection = {
  id: string;
  assetId: string | null;
  classification: SolvencyIssueClassification;
  severity: SolvencyIssueSeverity;
  reasonCode: string;
  summary: string;
  description: string;
  recommendedAction: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

type SolvencyReserveEvidenceProjection = {
  id: string;
  assetId: string;
  walletId: string | null;
  reserveSourceType: SolvencyReserveSourceType;
  walletAddress: string | null;
  walletKind: WalletKind | null;
  custodyType: WalletCustodyType | null;
  evidenceFreshness: SolvencyEvidenceFreshness;
  observedBalanceAmount: string | null;
  usableBalanceAmount: string | null;
  encumberedBalanceAmount: string | null;
  excludedBalanceAmount: string | null;
  observedAt: string | null;
  staleAfterSeconds: number;
  readErrorCode: string | null;
  readErrorMessage: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

export type SolvencySnapshotDetailResult = {
  snapshot: SolvencyWorkspaceSummarySnapshot & {
    summarySnapshot: Prisma.JsonValue | null;
    policyActionSnapshot: Prisma.JsonValue | null;
  };
  policyState: SolvencyPolicyProjection;
  assetSnapshots: SolvencyAssetDetailProjection[];
  issues: SolvencyIssueProjection[];
  reserveEvidence: SolvencyReserveEvidenceProjection[];
};

export type GeneratedSolvencySnapshotResult = {
  snapshot: SolvencyWorkspaceSummarySnapshot;
  policyState: SolvencyPolicyProjection;
  issueCount: number;
  criticalIssueCount: number;
};

type AssetRecord = {
  id: string;
  symbol: string;
  displayName: string;
  decimals: number;
  chainId: number;
  assetType: AssetType;
  contractAddress: string | null;
};

type ReserveWalletRecord = {
  id: string;
  address: string;
  kind: WalletKind;
  custodyType: WalletCustodyType;
  status: WalletStatus;
};

type LiabilityAssetComputation = {
  asset: AssetRecord;
  availableLiabilityAmount: Prisma.Decimal;
  reservedLiabilityAmount: Prisma.Decimal;
  pendingCreditAmount: Prisma.Decimal;
  totalLiabilityAmount: Prisma.Decimal;
  projectionAvailableAmount: Prisma.Decimal;
  projectionPendingAmount: Prisma.Decimal;
  projectionMatchesLedger: boolean;
  openReconciliationMismatchCount: number;
  criticalReconciliationMismatchCount: number;
};

type ReserveEvidenceComputation = {
  assetId: string;
  walletId: string;
  reserveSourceType: SolvencyReserveSourceType;
  walletAddress: string;
  walletKind: WalletKind;
  custodyType: WalletCustodyType;
  evidenceFreshness: SolvencyEvidenceFreshness;
  observedBalanceAmount: Prisma.Decimal | null;
  usableBalanceAmount: Prisma.Decimal | null;
  encumberedBalanceAmount: Prisma.Decimal | null;
  excludedBalanceAmount: Prisma.Decimal | null;
  observedAt: Date | null;
  staleAfterSeconds: number;
  readErrorCode: string | null;
  readErrorMessage: string | null;
  metadata: PrismaJsonValue | null;
};

type PersistedIssueInput = {
  assetId: string | null;
  classification: SolvencyIssueClassification;
  severity: SolvencyIssueSeverity;
  reasonCode: string;
  summary: string;
  description: string;
  recommendedAction: string | null;
  metadata: PrismaJsonValue | null;
};

type AssetSnapshotComputation = {
  asset: AssetRecord;
  status: SolvencySnapshotStatus;
  evidenceFreshness: SolvencyEvidenceFreshness;
  liabilityAvailableAmount: Prisma.Decimal;
  liabilityReservedAmount: Prisma.Decimal;
  pendingCreditAmount: Prisma.Decimal;
  totalLiabilityAmount: Prisma.Decimal;
  projectionAvailableAmount: Prisma.Decimal;
  projectionPendingAmount: Prisma.Decimal;
  observedReserveAmount: Prisma.Decimal;
  usableReserveAmount: Prisma.Decimal;
  encumberedReserveAmount: Prisma.Decimal;
  excludedReserveAmount: Prisma.Decimal;
  reserveDeltaAmount: Prisma.Decimal;
  reserveRatioBps: number | null;
  openReconciliationMismatchCount: number;
  criticalReconciliationMismatchCount: number;
  issues: PersistedIssueInput[];
  reserveEvidence: ReserveEvidenceComputation[];
  summarySnapshot: PrismaJsonValue;
};

type DerivedPolicyState = {
  status: SolvencyPolicyStateStatus;
  pauseWithdrawalApprovals: boolean;
  pauseManagedWithdrawalExecution: boolean;
  pauseLoanFunding: boolean;
  pauseStakingWrites: boolean;
  requireManualOperatorReview: boolean;
  reasonCode: string | null;
  reasonSummary: string | null;
  metadata: PrismaJsonValue | null;
};

@Injectable()
export class SolvencyService {
  private readonly logger = new Logger(SolvencyService.name);
  private readonly productChainId: number;
  private readonly environment: WorkerRuntimeEnvironment;
  private readonly evidenceStaleAfterSeconds: number;
  private readonly warningReserveRatioBps: number;
  private readonly criticalReserveRatioBps: number;
  private readonly provider: ethers.providers.JsonRpcProvider;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly reviewCasesService: ReviewCasesService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
    const runtimeConfig = loadSolvencyRuntimeConfig();
    const chainRuntimeConfig = loadOptionalBlockchainContractReadRuntimeConfig();
    this.environment =
      runtimeConfig.environment as unknown as WorkerRuntimeEnvironment;
    this.evidenceStaleAfterSeconds = runtimeConfig.evidenceStaleAfterSeconds;
    this.warningReserveRatioBps = runtimeConfig.warningReserveRatioBps;
    this.criticalReserveRatioBps = runtimeConfig.criticalReserveRatioBps;
    this.provider = createJsonRpcProvider(chainRuntimeConfig.rpcUrl);
  }

  async getWorkspace(limit = DEFAULT_WORKSPACE_LIMIT): Promise<SolvencyWorkspaceResult> {
    const [policyState, latestSnapshot, recentSnapshots, latestHealthySnapshot] =
      await Promise.all([
        this.getOrCreatePolicyState(),
        this.prismaService.solvencySnapshot.findFirst({
          where: {
            environment: this.environment
          },
          orderBy: {
            generatedAt: "desc"
          }
        }),
        this.prismaService.solvencySnapshot.findMany({
          where: {
            environment: this.environment
          },
          orderBy: {
            generatedAt: "desc"
          },
          take: limit
        }),
        this.prismaService.solvencySnapshot.findFirst({
          where: {
            environment: this.environment,
            status: SolvencySnapshotStatus.healthy
          },
          orderBy: {
            generatedAt: "desc"
          }
        })
      ]);

    return {
      generatedAt: new Date().toISOString(),
      policyState: this.mapPolicyStateProjection(policyState),
      latestSnapshot: latestSnapshot ? this.mapWorkspaceSnapshot(latestSnapshot) : null,
      latestHealthySnapshotAt: latestHealthySnapshot?.generatedAt.toISOString() ?? null,
      recentSnapshots: recentSnapshots.map((snapshot) =>
        this.mapWorkspaceSnapshot(snapshot)
      ),
      limit
    };
  }

  async getSnapshotDetail(snapshotId: string): Promise<SolvencySnapshotDetailResult> {
    const snapshot = await this.prismaService.solvencySnapshot.findUnique({
      where: {
        id: snapshotId
      },
      include: {
        assetSnapshots: {
          include: {
            asset: true
          },
          orderBy: {
            createdAt: "asc"
          }
        },
        issues: {
          orderBy: [
            {
              severity: "desc"
            },
            {
              createdAt: "asc"
            }
          ]
        },
        reserveEvidence: {
          orderBy: [
            {
              assetId: "asc"
            },
            {
              walletAddress: "asc"
            }
          ]
        }
      }
    });

    if (!snapshot) {
      throw new NotFoundException("Solvency snapshot not found.");
    }

    const policyState = await this.getOrCreatePolicyState();

    return {
      snapshot: {
        ...this.mapWorkspaceSnapshot(snapshot),
        summarySnapshot: snapshot.summarySnapshot ?? null,
        policyActionSnapshot: snapshot.policyActionSnapshot ?? null
      },
      policyState: this.mapPolicyStateProjection(policyState),
      assetSnapshots: snapshot.assetSnapshots.map((item) => ({
        asset: {
          id: item.asset.id,
          symbol: item.asset.symbol,
          displayName: item.asset.displayName,
          decimals: item.asset.decimals,
          chainId: item.asset.chainId,
          assetType: item.asset.assetType
        },
        status: item.status,
        evidenceFreshness: item.evidenceFreshness,
        liabilityAvailableAmount: item.liabilityAvailableAmount.toString(),
        liabilityReservedAmount: item.liabilityReservedAmount.toString(),
        pendingCreditAmount: item.pendingCreditAmount.toString(),
        totalLiabilityAmount: item.totalLiabilityAmount.toString(),
        projectionAvailableAmount: item.projectionAvailableAmount.toString(),
        projectionPendingAmount: item.projectionPendingAmount.toString(),
        observedReserveAmount: item.observedReserveAmount.toString(),
        usableReserveAmount: item.usableReserveAmount.toString(),
        encumberedReserveAmount: item.encumberedReserveAmount.toString(),
        excludedReserveAmount: item.excludedReserveAmount.toString(),
        reserveDeltaAmount: item.reserveDeltaAmount.toString(),
        reserveRatioBps: item.reserveRatioBps,
        openReconciliationMismatchCount: item.openReconciliationMismatchCount,
        criticalReconciliationMismatchCount:
          item.criticalReconciliationMismatchCount,
        issueCount: item.issueCount,
        summarySnapshot: item.summarySnapshot ?? null
      })),
      issues: snapshot.issues.map((issue) => ({
        id: issue.id,
        assetId: issue.assetId ?? null,
        classification: issue.classification,
        severity: issue.severity,
        reasonCode: issue.reasonCode,
        summary: issue.summary,
        description: issue.description,
        recommendedAction: issue.recommendedAction ?? null,
        metadata: issue.metadata ?? null,
        createdAt: issue.createdAt.toISOString()
      })),
      reserveEvidence: snapshot.reserveEvidence.map((evidence) => ({
        id: evidence.id,
        assetId: evidence.assetId,
        walletId: evidence.walletId ?? null,
        reserveSourceType: evidence.reserveSourceType,
        walletAddress: evidence.walletAddress ?? null,
        walletKind: evidence.walletKind ?? null,
        custodyType: evidence.custodyType ?? null,
        evidenceFreshness: evidence.evidenceFreshness,
        observedBalanceAmount: evidence.observedBalanceAmount?.toString() ?? null,
        usableBalanceAmount: evidence.usableBalanceAmount?.toString() ?? null,
        encumberedBalanceAmount:
          evidence.encumberedBalanceAmount?.toString() ?? null,
        excludedBalanceAmount: evidence.excludedBalanceAmount?.toString() ?? null,
        observedAt: evidence.observedAt?.toISOString() ?? null,
        staleAfterSeconds: evidence.staleAfterSeconds,
        readErrorCode: evidence.readErrorCode ?? null,
        readErrorMessage: evidence.readErrorMessage ?? null,
        metadata: evidence.metadata ?? null,
        createdAt: evidence.createdAt.toISOString()
      }))
    };
  }

  async generateSnapshot(actor: SnapshotActor): Promise<GeneratedSolvencySnapshotResult> {
    const startedAt = new Date();
    const pendingSnapshot = await this.prismaService.solvencySnapshot.create({
      data: {
        environment: this.environment,
        chainId: this.productChainId,
        status: SolvencySnapshotStatus.failed,
        evidenceFreshness: SolvencyEvidenceFreshness.unknown,
        generatedAt: startedAt,
        failureCode: null,
        failureMessage: null
      }
    });

    try {
      const [assets, reserveWallets, latestReconciliationScanRun, mismatchCounts] =
        await Promise.all([
          this.listActiveAssets(),
          this.listReserveWallets(),
          this.prismaService.ledgerReconciliationScanRun.findFirst({
            orderBy: {
              startedAt: "desc"
            }
          }),
          this.listOpenReconciliationMismatchCounts()
        ]);

      const [liabilitiesByAsset, reserveEvidenceByAsset] = await Promise.all([
        this.computeLiabilitiesByAsset(assets, mismatchCounts),
        this.computeReserveEvidenceByAsset(assets, reserveWallets)
      ]);

      const assetComputations = assets.map((asset) =>
        this.buildAssetSnapshotComputation({
          asset,
          liabilities:
            liabilitiesByAsset.get(asset.id) ?? this.createZeroLiabilityComputation(asset),
          reserveEvidence: reserveEvidenceByAsset.get(asset.id) ?? []
        })
      );

      const allIssues = assetComputations.flatMap((item) => item.issues);
      const policyState = this.derivePolicyState(assetComputations, allIssues);
      const summary = this.buildSnapshotSummary(assetComputations, allIssues);

      const persistedSnapshot = await this.prismaService.$transaction(
        async (transaction) => {
          await transaction.solvencySnapshot.update({
            where: {
              id: pendingSnapshot.id
            },
            data: {
              status: summary.status,
              evidenceFreshness: summary.evidenceFreshness,
              completedAt: new Date(),
              latestReconciliationScanRunId: latestReconciliationScanRun?.id ?? null,
              totalLiabilityAmount: summary.totalLiabilityAmount,
              totalUsableReserveAmount: summary.totalUsableReserveAmount,
              totalObservedReserveAmount: summary.totalObservedReserveAmount,
              totalEncumberedReserveAmount: summary.totalEncumberedReserveAmount,
              totalReserveDeltaAmount: summary.totalReserveDeltaAmount,
              assetCount: assetComputations.length,
              issueCount: allIssues.length,
              policyActionsTriggered: policyState.status !== SolvencyPolicyStateStatus.normal,
              summarySnapshot: summary.summarySnapshot,
              policyActionSnapshot: this.toNullableJsonInput(policyState.metadata),
              failureCode: null,
              failureMessage: null
            }
          });

          if (assetComputations.length > 0) {
            await transaction.solvencyAssetSnapshot.createMany({
              data: assetComputations.map((item) => ({
                snapshotId: pendingSnapshot.id,
                assetId: item.asset.id,
                status: item.status,
                evidenceFreshness: item.evidenceFreshness,
                liabilityAvailableAmount: item.liabilityAvailableAmount,
                liabilityReservedAmount: item.liabilityReservedAmount,
                pendingCreditAmount: item.pendingCreditAmount,
                totalLiabilityAmount: item.totalLiabilityAmount,
                projectionAvailableAmount: item.projectionAvailableAmount,
                projectionPendingAmount: item.projectionPendingAmount,
                observedReserveAmount: item.observedReserveAmount,
                usableReserveAmount: item.usableReserveAmount,
                encumberedReserveAmount: item.encumberedReserveAmount,
                excludedReserveAmount: item.excludedReserveAmount,
                reserveDeltaAmount: item.reserveDeltaAmount,
                reserveRatioBps: item.reserveRatioBps,
                openReconciliationMismatchCount:
                  item.openReconciliationMismatchCount,
                criticalReconciliationMismatchCount:
                  item.criticalReconciliationMismatchCount,
                issueCount: item.issues.length,
                summarySnapshot: item.summarySnapshot
              }))
            });
          }

          const reserveEvidenceRows = assetComputations.flatMap((item) =>
            item.reserveEvidence.map((evidence) => ({
              snapshotId: pendingSnapshot.id,
              assetId: evidence.assetId,
              walletId: evidence.walletId,
              reserveSourceType: evidence.reserveSourceType,
              walletAddress: evidence.walletAddress,
              walletKind: evidence.walletKind,
              custodyType: evidence.custodyType,
              evidenceFreshness: evidence.evidenceFreshness,
              observedBalanceAmount: evidence.observedBalanceAmount,
              usableBalanceAmount: evidence.usableBalanceAmount,
              encumberedBalanceAmount: evidence.encumberedBalanceAmount,
              excludedBalanceAmount: evidence.excludedBalanceAmount,
              observedAt: evidence.observedAt,
              staleAfterSeconds: evidence.staleAfterSeconds,
              readErrorCode: evidence.readErrorCode,
              readErrorMessage: evidence.readErrorMessage,
              metadata: this.toNullableJsonInput(evidence.metadata)
            }))
          );

          if (reserveEvidenceRows.length > 0) {
            await transaction.solvencyReserveEvidence.createMany({
              data: reserveEvidenceRows
            });
          }

          if (allIssues.length > 0) {
            await transaction.solvencyIssue.createMany({
              data: allIssues.map((issue) => ({
                snapshotId: pendingSnapshot.id,
                assetId: issue.assetId,
                classification: issue.classification,
                severity: issue.severity,
                reasonCode: issue.reasonCode,
                summary: issue.summary,
                description: issue.description,
                recommendedAction: issue.recommendedAction,
                metadata: this.toNullableJsonInput(issue.metadata)
              }))
            });
          }

          await this.persistPolicyState(
            transaction,
            pendingSnapshot.id,
            summary.status,
            policyState,
            actor
          );

          await transaction.auditEvent.create({
            data: {
              customerId: null,
              actorType: actor.actorType,
              actorId: actor.actorId,
              action: "solvency.snapshot.created",
              targetType: "SolvencySnapshot",
              targetId: pendingSnapshot.id,
              metadata: {
                status: summary.status,
                evidenceFreshness: summary.evidenceFreshness,
                totalLiabilityAmount: summary.totalLiabilityAmount.toString(),
                totalObservedReserveAmount:
                  summary.totalObservedReserveAmount.toString(),
                totalUsableReserveAmount:
                  summary.totalUsableReserveAmount.toString(),
                totalReserveDeltaAmount: summary.totalReserveDeltaAmount.toString(),
                issueCount: allIssues.length,
                criticalIssueCount: allIssues.filter(
                  (issue) => issue.severity === SolvencyIssueSeverity.critical
                ).length,
                policyStatus: policyState.status
              } as PrismaJsonValue
            }
          });

          for (const issue of allIssues.filter(
            (item) => item.severity === SolvencyIssueSeverity.critical
          )) {
            await transaction.auditEvent.create({
              data: {
                customerId: null,
                actorType: actor.actorType,
                actorId: actor.actorId,
                action: "solvency.issue.detected",
                targetType: "SolvencySnapshot",
                targetId: pendingSnapshot.id,
                metadata: {
                  assetId: issue.assetId,
                  classification: issue.classification,
                  reasonCode: issue.reasonCode,
                  summary: issue.summary
                } as PrismaJsonValue
              }
            });
          }

          return transaction.solvencySnapshot.findUniqueOrThrow({
            where: {
              id: pendingSnapshot.id
            }
          });
        }
      );

      const currentPolicyState = await this.getOrCreatePolicyState();

      return {
        snapshot: this.mapWorkspaceSnapshot(persistedSnapshot),
        policyState: this.mapPolicyStateProjection(currentPolicyState),
        issueCount: allIssues.length,
        criticalIssueCount: allIssues.filter(
          (issue) => issue.severity === SolvencyIssueSeverity.critical
        ).length
      };
    } catch (error) {
      const normalizedError = this.normalizeError(error);
      this.logger.error("Failed to generate solvency snapshot.", normalizedError.stack);

      await this.prismaService.solvencySnapshot.update({
        where: {
          id: pendingSnapshot.id
        },
        data: {
          completedAt: new Date(),
          status: SolvencySnapshotStatus.failed,
          evidenceFreshness: SolvencyEvidenceFreshness.unknown,
          failureCode: normalizedError.code,
          failureMessage: normalizedError.message
        }
      });

      await this.prismaService.auditEvent.create({
        data: {
          customerId: null,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "solvency.snapshot.failed",
          targetType: "SolvencySnapshot",
          targetId: pendingSnapshot.id,
          metadata: {
            failureCode: normalizedError.code,
            failureMessage: normalizedError.message
          } as PrismaJsonValue
        }
      });

      throw new ServiceUnavailableException(
        `Solvency snapshot generation failed: ${normalizedError.message}`
      );
    }
  }

  async assertWithdrawalApprovalAllowed(): Promise<void> {
    const policyState = await this.getOrCreatePolicyState();

    if (policyState.pauseWithdrawalApprovals) {
      throw new ConflictException(
        policyState.reasonSummary ??
          "Withdrawal approvals are paused by the current solvency policy state."
      );
    }
  }

  async assertManagedWithdrawalExecutionAllowed(): Promise<void> {
    const policyState = await this.getOrCreatePolicyState();

    if (policyState.pauseManagedWithdrawalExecution) {
      throw new ConflictException(
        policyState.reasonSummary ??
          "Managed withdrawal execution is paused by the current solvency policy state."
      );
    }
  }

  async assertLoanFundingAllowed(): Promise<void> {
    const policyState = await this.getOrCreatePolicyState();

    if (policyState.pauseLoanFunding) {
      throw new ConflictException(
        policyState.reasonSummary ??
          "Loan funding is paused by the current solvency policy state."
      );
    }
  }

  async assertStakingWritesAllowed(): Promise<void> {
    const policyState = await this.getOrCreatePolicyState();

    if (policyState.pauseStakingWrites) {
      throw new ConflictException(
        policyState.reasonSummary ??
          "Staking write actions are paused by the current solvency policy state."
      );
    }
  }

  private async getOrCreatePolicyState() {
    const existing = await this.prismaService.solvencyPolicyState.findUnique({
      where: {
        environment: this.environment
      }
    });

    if (existing) {
      return existing;
    }

    return this.prismaService.solvencyPolicyState.create({
      data: {
        environment: this.environment,
        status: SolvencyPolicyStateStatus.normal,
        pauseWithdrawalApprovals: false,
        pauseManagedWithdrawalExecution: false,
        pauseLoanFunding: false,
        pauseStakingWrites: false,
        requireManualOperatorReview: false,
        reasonCode: null,
        reasonSummary: null,
        metadata: Prisma.DbNull
      }
    });
  }

  private mapPolicyStateProjection(
    record: Awaited<ReturnType<SolvencyService["getOrCreatePolicyState"]>>
  ): SolvencyPolicyProjection {
    return {
      environment: record.environment,
      status: record.status,
      pauseWithdrawalApprovals: record.pauseWithdrawalApprovals,
      pauseManagedWithdrawalExecution: record.pauseManagedWithdrawalExecution,
      pauseLoanFunding: record.pauseLoanFunding,
      pauseStakingWrites: record.pauseStakingWrites,
      requireManualOperatorReview: record.requireManualOperatorReview,
      latestSnapshotId: record.latestSnapshotId ?? null,
      triggeredAt: record.triggeredAt?.toISOString() ?? null,
      clearedAt: record.clearedAt?.toISOString() ?? null,
      reasonCode: record.reasonCode ?? null,
      reasonSummary: record.reasonSummary ?? null,
      metadata: record.metadata ?? null,
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private mapWorkspaceSnapshot(
    snapshot: Awaited<
      ReturnType<typeof this.prismaService.solvencySnapshot.findFirst>
    > extends infer T
      ? T extends null
        ? never
        : T
      : never
  ): SolvencyWorkspaceSummarySnapshot {
    return {
      id: snapshot.id,
      environment: snapshot.environment,
      status: snapshot.status,
      evidenceFreshness: snapshot.evidenceFreshness,
      generatedAt: snapshot.generatedAt.toISOString(),
      completedAt: snapshot.completedAt?.toISOString() ?? null,
      totalLiabilityAmount: snapshot.totalLiabilityAmount.toString(),
      totalObservedReserveAmount: snapshot.totalObservedReserveAmount.toString(),
      totalUsableReserveAmount: snapshot.totalUsableReserveAmount.toString(),
      totalEncumberedReserveAmount:
        snapshot.totalEncumberedReserveAmount.toString(),
      totalReserveDeltaAmount: snapshot.totalReserveDeltaAmount.toString(),
      assetCount: snapshot.assetCount,
      issueCount: snapshot.issueCount,
      policyActionsTriggered: snapshot.policyActionsTriggered,
      failureCode: snapshot.failureCode ?? null,
      failureMessage: snapshot.failureMessage ?? null
    };
  }

  private async listActiveAssets(): Promise<AssetRecord[]> {
    const assets = await this.prismaService.asset.findMany({
      where: {
        chainId: this.productChainId,
        status: AssetStatus.active
      },
      orderBy: {
        symbol: "asc"
      }
    });

    return assets.map((asset) => ({
      id: asset.id,
      symbol: asset.symbol,
      displayName: asset.displayName,
      decimals: asset.decimals,
      chainId: asset.chainId,
      assetType: asset.assetType,
      contractAddress: asset.contractAddress
    }));
  }

  private async listReserveWallets(): Promise<ReserveWalletRecord[]> {
    const wallets = await this.prismaService.wallet.findMany({
      where: {
        chainId: this.productChainId,
        customerAccountId: null,
        status: WalletStatus.active,
        kind: {
          in: [...RESERVE_WALLET_KINDS]
        }
      },
      orderBy: [
        {
          kind: "asc"
        },
        {
          address: "asc"
        }
      ]
    });

    return wallets.map((wallet) => ({
      id: wallet.id,
      address: wallet.address,
      kind: wallet.kind,
      custodyType: wallet.custodyType,
      status: wallet.status
    }));
  }

  private async listOpenReconciliationMismatchCounts() {
    const counts = await this.prismaService.ledgerReconciliationMismatch.groupBy({
      by: ["assetId", "severity"],
      where: {
        chainId: this.productChainId,
        status: "open",
        assetId: {
          not: null
        }
      },
      _count: {
        _all: true
      }
    });

    const byAsset = new Map<
      string,
      { open: number; critical: number }
    >();

    for (const item of counts) {
      if (!item.assetId) {
        continue;
      }

      const current = byAsset.get(item.assetId) ?? {
        open: 0,
        critical: 0
      };
      current.open += item._count._all;
      if (item.severity === "critical") {
        current.critical += item._count._all;
      }
      byAsset.set(item.assetId, current);
    }

    return byAsset;
  }

  private async computeLiabilitiesByAsset(
    assets: AssetRecord[],
    mismatchCounts: Map<string, { open: number; critical: number }>
  ): Promise<Map<string, LiabilityAssetComputation>> {
    const [ledgerAccounts, customerBalances] = await Promise.all([
      this.prismaService.ledgerAccount.findMany({
        where: {
          chainId: this.productChainId,
          accountType: {
            in: [
              LedgerAccountType.customer_asset_liability,
              LedgerAccountType.customer_asset_pending_withdrawal_liability
            ]
          }
        },
        include: {
          ledgerPostings: {
            select: {
              direction: true,
              amount: true
            }
          }
        }
      }),
      this.prismaService.customerAssetBalance.findMany({
        include: {
          asset: {
            select: {
              id: true
            }
          }
        }
      })
    ]);

    const byAsset = new Map<string, LiabilityAssetComputation>();

    for (const asset of assets) {
      const mismatch = mismatchCounts.get(asset.id) ?? {
        open: 0,
        critical: 0
      };
      byAsset.set(asset.id, {
        asset,
        availableLiabilityAmount: this.decimal(0),
        reservedLiabilityAmount: this.decimal(0),
        pendingCreditAmount: this.decimal(0),
        totalLiabilityAmount: this.decimal(0),
        projectionAvailableAmount: this.decimal(0),
        projectionPendingAmount: this.decimal(0),
        projectionMatchesLedger: true,
        openReconciliationMismatchCount: mismatch.open,
        criticalReconciliationMismatchCount: mismatch.critical
      });
    }

    for (const account of ledgerAccounts) {
      const entry = byAsset.get(account.assetId);

      if (!entry) {
        continue;
      }

      const netAmount = account.ledgerPostings.reduce((current, posting) => {
        const amount = new Prisma.Decimal(posting.amount);
        return posting.direction === LedgerPostingDirection.credit
          ? current.plus(amount)
          : current.minus(amount);
      }, this.decimal(0));

      if (
        account.accountType ===
        LedgerAccountType.customer_asset_pending_withdrawal_liability
      ) {
        entry.reservedLiabilityAmount =
          entry.reservedLiabilityAmount.plus(netAmount);
      } else {
        entry.availableLiabilityAmount =
          entry.availableLiabilityAmount.plus(netAmount);
      }
    }

    for (const balance of customerBalances) {
      const entry = byAsset.get(balance.asset.id);

      if (!entry) {
        continue;
      }

      entry.projectionAvailableAmount = entry.projectionAvailableAmount.plus(
        balance.availableBalance
      );
      entry.projectionPendingAmount = entry.projectionPendingAmount.plus(
        balance.pendingBalance
      );
    }

    for (const entry of byAsset.values()) {
      entry.totalLiabilityAmount = entry.availableLiabilityAmount.plus(
        entry.reservedLiabilityAmount
      );
      entry.projectionMatchesLedger =
        entry.projectionAvailableAmount.eq(entry.availableLiabilityAmount) &&
        entry.projectionPendingAmount.eq(entry.reservedLiabilityAmount);
    }

    return byAsset;
  }

  private async computeReserveEvidenceByAsset(
    assets: AssetRecord[],
    reserveWallets: ReserveWalletRecord[]
  ): Promise<Map<string, ReserveEvidenceComputation[]>> {
    const byAsset = new Map<string, ReserveEvidenceComputation[]>();

    if (reserveWallets.length === 0) {
      return byAsset;
    }

    const walletIds = reserveWallets.map((wallet) => wallet.id);
    const previousEvidence = await this.prismaService.solvencyReserveEvidence.findMany({
      where: {
        walletId: {
          in: walletIds
        },
        assetId: {
          in: assets.map((asset) => asset.id)
        },
        evidenceFreshness: SolvencyEvidenceFreshness.fresh
      },
      orderBy: {
        createdAt: "desc"
      },
      distinct: ["walletId", "assetId"]
    });
    const previousEvidenceByKey = new Map(
      previousEvidence
        .filter((item) => item.walletId)
        .map((item) => [`${item.walletId}:${item.assetId}`, item] as const)
    );

    const encumberedByKey = await this.listReserveEncumbrances(walletIds);

    for (const asset of assets) {
      const evidenceRows: ReserveEvidenceComputation[] = [];

      for (const wallet of reserveWallets) {
        const reserveSourceType = this.mapReserveSourceType(wallet.kind);
        const encumberedAmount =
          encumberedByKey.get(`${wallet.id}:${asset.id}`) ?? this.decimal(0);
        const previous =
          previousEvidenceByKey.get(`${wallet.id}:${asset.id}`) ?? null;

        try {
          const observedBalanceAmount = await this.readWalletAssetBalance(wallet, asset);
          const usableBalanceAmount = Prisma.Decimal.max(
            observedBalanceAmount.minus(encumberedAmount),
            this.decimal(0)
          );

          evidenceRows.push({
            assetId: asset.id,
            walletId: wallet.id,
            reserveSourceType,
            walletAddress: wallet.address,
            walletKind: wallet.kind,
            custodyType: wallet.custodyType,
            evidenceFreshness: SolvencyEvidenceFreshness.fresh,
            observedBalanceAmount,
            usableBalanceAmount,
            encumberedBalanceAmount: encumberedAmount,
            excludedBalanceAmount: this.decimal(0),
            observedAt: new Date(),
            staleAfterSeconds: this.evidenceStaleAfterSeconds,
            readErrorCode: null,
            readErrorMessage: null,
            metadata: {
              previousObservedAt: previous?.observedAt?.toISOString() ?? null
            }
          });
        } catch (error) {
          const normalizedError = this.normalizeError(error);
          evidenceRows.push({
            assetId: asset.id,
            walletId: wallet.id,
            reserveSourceType,
            walletAddress: wallet.address,
            walletKind: wallet.kind,
            custodyType: wallet.custodyType,
            evidenceFreshness: previous
              ? SolvencyEvidenceFreshness.stale
              : SolvencyEvidenceFreshness.missing,
            observedBalanceAmount: null,
            usableBalanceAmount: null,
            encumberedBalanceAmount: encumberedAmount,
            excludedBalanceAmount: this.decimal(0),
            observedAt: previous?.observedAt ?? null,
            staleAfterSeconds: this.evidenceStaleAfterSeconds,
            readErrorCode: normalizedError.code,
            readErrorMessage: normalizedError.message,
            metadata: {
              previousObservedAt: previous?.observedAt?.toISOString() ?? null,
              previousObservedBalanceAmount:
                previous?.observedBalanceAmount?.toString() ?? null
            }
          });
        }
      }

      byAsset.set(asset.id, evidenceRows);
    }

    return byAsset;
  }

  private async listReserveEncumbrances(walletIds: string[]) {
    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        chainId: this.productChainId,
        sourceWalletId: {
          in: walletIds
        },
        status: {
          in: [...EXECUTION_ENCUMBERED_STATUSES]
        }
      },
      select: {
        sourceWalletId: true,
        assetId: true,
        requestedAmount: true
      }
    });

    const byKey = new Map<string, Prisma.Decimal>();

    for (const intent of intents) {
      if (!intent.sourceWalletId) {
        continue;
      }

      const key = `${intent.sourceWalletId}:${intent.assetId}`;
      byKey.set(
        key,
        (byKey.get(key) ?? this.decimal(0)).plus(intent.requestedAmount)
      );
    }

    return byKey;
  }

  private buildAssetSnapshotComputation(input: {
    asset: AssetRecord;
    liabilities: LiabilityAssetComputation;
    reserveEvidence: ReserveEvidenceComputation[];
  }): AssetSnapshotComputation {
    const observedReserveAmount = input.reserveEvidence.reduce(
      (current, item) =>
        current.plus(item.observedBalanceAmount ?? this.decimal(0)),
      this.decimal(0)
    );
    const usableReserveAmount = input.reserveEvidence.reduce(
      (current, item) =>
        current.plus(item.usableBalanceAmount ?? this.decimal(0)),
      this.decimal(0)
    );
    const encumberedReserveAmount = input.reserveEvidence.reduce(
      (current, item) =>
        current.plus(item.encumberedBalanceAmount ?? this.decimal(0)),
      this.decimal(0)
    );
    const excludedReserveAmount = input.reserveEvidence.reduce(
      (current, item) =>
        current.plus(item.excludedBalanceAmount ?? this.decimal(0)),
      this.decimal(0)
    );
    const reserveDeltaAmount = usableReserveAmount.minus(
      input.liabilities.totalLiabilityAmount
    );
    const reserveRatioBps = this.computeReserveRatioBps(
      usableReserveAmount,
      input.liabilities.totalLiabilityAmount
    );
    const evidenceFreshness = this.mergeEvidenceFreshness(
      input.reserveEvidence.map((item) => item.evidenceFreshness)
    );
    const issues: PersistedIssueInput[] = [];

    if (!input.liabilities.projectionMatchesLedger) {
      issues.push({
        assetId: input.asset.id,
        classification: SolvencyIssueClassification.reconciliation_mismatch,
        severity:
          input.liabilities.criticalReconciliationMismatchCount > 0
            ? SolvencyIssueSeverity.critical
            : SolvencyIssueSeverity.warning,
        reasonCode: "customer_balance_projection_mismatch",
        summary: `${input.asset.symbol} liability projection diverges from immutable ledger balances.`,
        description:
          "Customer balance projections do not match the asset liability ledger and require operator review.",
        recommendedAction: "Confirm reconciliation state and block automated release paths until explained.",
        metadata: {
          projectionAvailableAmount:
            input.liabilities.projectionAvailableAmount.toString(),
          projectionPendingAmount:
            input.liabilities.projectionPendingAmount.toString(),
          ledgerAvailableAmount:
            input.liabilities.availableLiabilityAmount.toString(),
          ledgerReservedAmount:
            input.liabilities.reservedLiabilityAmount.toString()
        }
      });
    }

    if (input.liabilities.openReconciliationMismatchCount > 0) {
      issues.push({
        assetId: input.asset.id,
        classification: SolvencyIssueClassification.reconciliation_mismatch,
        severity:
          input.liabilities.criticalReconciliationMismatchCount > 0
            ? SolvencyIssueSeverity.critical
            : SolvencyIssueSeverity.warning,
        reasonCode: "open_reconciliation_mismatch_present",
        summary: `${input.asset.symbol} has open reconciliation mismatches.`,
        description:
          "Open reconciliation mismatches exist for this asset and weaken confidence in the liability or settlement state.",
        recommendedAction: "Review the linked mismatch workspaces before resuming sensitive flows.",
        metadata: {
          openMismatchCount: input.liabilities.openReconciliationMismatchCount,
          criticalMismatchCount:
            input.liabilities.criticalReconciliationMismatchCount
        }
      });
    }

    const staleEvidenceCount = input.reserveEvidence.filter(
      (item) => item.evidenceFreshness === SolvencyEvidenceFreshness.stale
    ).length;
    const missingEvidenceCount = input.reserveEvidence.filter(
      (item) => item.evidenceFreshness === SolvencyEvidenceFreshness.missing
    ).length;

    if (missingEvidenceCount > 0) {
      issues.push({
        assetId: input.asset.id,
        classification: SolvencyIssueClassification.unknown_reserve_state,
        severity:
          input.liabilities.totalLiabilityAmount.greaterThan(0)
            ? SolvencyIssueSeverity.critical
            : SolvencyIssueSeverity.warning,
        reasonCode: "reserve_evidence_missing",
        summary: `${input.asset.symbol} reserve evidence is missing for one or more controlled wallets.`,
        description:
          "The bank could not read all reserve balances required to support a defensible solvency conclusion for this asset.",
        recommendedAction:
          "Restore reserve reads or mark the affected wallet coverage before allowing new risk-sensitive actions.",
        metadata: {
          missingEvidenceCount
        }
      });
    } else if (staleEvidenceCount > 0) {
      issues.push({
        assetId: input.asset.id,
        classification: SolvencyIssueClassification.stale_evidence,
        severity:
          input.liabilities.totalLiabilityAmount.greaterThan(0)
            ? SolvencyIssueSeverity.warning
            : SolvencyIssueSeverity.info,
        reasonCode: "reserve_evidence_stale",
        summary: `${input.asset.symbol} reserve evidence is stale.`,
        description:
          "Fresh reserve reads were unavailable for one or more controlled wallets, so the asset reserve picture is degraded.",
        recommendedAction: "Refresh reserve evidence and verify the affected wallets.",
        metadata: {
          staleEvidenceCount
        }
      });
    }

    if (reserveDeltaAmount.lessThan(0)) {
      issues.push({
        assetId: input.asset.id,
        classification: SolvencyIssueClassification.reserve_shortfall,
        severity: SolvencyIssueSeverity.critical,
        reasonCode: "usable_reserve_shortfall",
        summary: `${input.asset.symbol} usable reserves are below customer liabilities.`,
        description:
          "Authoritative liabilities exceed usable reserve balances after encumbered execution amounts are removed.",
        recommendedAction:
          "Pause sensitive outflows, raise manual review, and restore reserves before resuming activity.",
        metadata: {
          totalLiabilityAmount: input.liabilities.totalLiabilityAmount.toString(),
          usableReserveAmount: usableReserveAmount.toString(),
          reserveDeltaAmount: reserveDeltaAmount.toString()
        }
      });
    } else if (
      reserveRatioBps !== null &&
      input.liabilities.totalLiabilityAmount.greaterThan(0) &&
      reserveRatioBps < this.warningReserveRatioBps
    ) {
      issues.push({
        assetId: input.asset.id,
        classification: SolvencyIssueClassification.informational_drift,
        severity: SolvencyIssueSeverity.warning,
        reasonCode: "low_reserve_buffer",
        summary: `${input.asset.symbol} reserve coverage is above par but below the warning buffer.`,
        description:
          "The asset is solvent, but the reserve buffer is thinner than the configured warning threshold.",
        recommendedAction:
          "Monitor treasury posture and replenish reserves before approving additional outflows.",
        metadata: {
          reserveRatioBps,
          warningReserveRatioBps: this.warningReserveRatioBps
        }
      });
    }

    const hasCriticalShortfallLikeIssue = issues.some(
      (item) =>
        item.classification === SolvencyIssueClassification.reserve_shortfall ||
        item.classification === SolvencyIssueClassification.unknown_reserve_state
    );
    const hasCriticalReconciliationIssue = issues.some(
      (item) =>
        item.classification === SolvencyIssueClassification.reconciliation_mismatch &&
        item.severity === SolvencyIssueSeverity.critical
    );

    if (hasCriticalShortfallLikeIssue && hasCriticalReconciliationIssue) {
      issues.push({
        assetId: input.asset.id,
        classification: SolvencyIssueClassification.critical_solvency_risk,
        severity: SolvencyIssueSeverity.critical,
        reasonCode: "compound_solvency_risk",
        summary: `${input.asset.symbol} has both reserve integrity and reconciliation risk.`,
        description:
          "Multiple critical signals indicate the bank cannot safely rely on the current solvency posture for this asset.",
        recommendedAction:
          "Keep safety controls active until reserve evidence and reconciliation both return to a healthy state.",
        metadata: null
      });
    }

    const status = this.resolveStatusFromIssues(issues);

    return {
      asset: input.asset,
      status,
      evidenceFreshness,
      liabilityAvailableAmount: input.liabilities.availableLiabilityAmount,
      liabilityReservedAmount: input.liabilities.reservedLiabilityAmount,
      pendingCreditAmount: input.liabilities.pendingCreditAmount,
      totalLiabilityAmount: input.liabilities.totalLiabilityAmount,
      projectionAvailableAmount: input.liabilities.projectionAvailableAmount,
      projectionPendingAmount: input.liabilities.projectionPendingAmount,
      observedReserveAmount,
      usableReserveAmount,
      encumberedReserveAmount,
      excludedReserveAmount,
      reserveDeltaAmount,
      reserveRatioBps,
      openReconciliationMismatchCount:
        input.liabilities.openReconciliationMismatchCount,
      criticalReconciliationMismatchCount:
        input.liabilities.criticalReconciliationMismatchCount,
      issues,
      reserveEvidence: input.reserveEvidence,
      summarySnapshot: {
        assetSymbol: input.asset.symbol,
        totalLiabilityAmount: input.liabilities.totalLiabilityAmount.toString(),
        usableReserveAmount: usableReserveAmount.toString(),
        observedReserveAmount: observedReserveAmount.toString(),
        reserveDeltaAmount: reserveDeltaAmount.toString(),
        reserveRatioBps,
        evidenceFreshness,
        issueClassifications: issues.map((issue) => issue.classification)
      }
    };
  }

  private derivePolicyState(
    assetComputations: AssetSnapshotComputation[],
    issues: PersistedIssueInput[]
  ): DerivedPolicyState {
    const criticalIssue = issues.find(
      (issue) => issue.severity === SolvencyIssueSeverity.critical
    );

    if (criticalIssue) {
      return {
        status: SolvencyPolicyStateStatus.paused,
        pauseWithdrawalApprovals: true,
        pauseManagedWithdrawalExecution: true,
        pauseLoanFunding: true,
        pauseStakingWrites: true,
        requireManualOperatorReview: true,
        reasonCode: criticalIssue.reasonCode,
        reasonSummary: criticalIssue.summary,
        metadata: {
          assetId: criticalIssue.assetId,
          assetStatuses: assetComputations.map((item) => ({
            assetId: item.asset.id,
            assetSymbol: item.asset.symbol,
            status: item.status
          }))
        }
      };
    }

    const warningIssue = issues.find(
      (issue) => issue.severity === SolvencyIssueSeverity.warning
    );

    if (warningIssue) {
      return {
        status: SolvencyPolicyStateStatus.guarded,
        pauseWithdrawalApprovals: false,
        pauseManagedWithdrawalExecution: false,
        pauseLoanFunding: false,
        pauseStakingWrites: false,
        requireManualOperatorReview: true,
        reasonCode: warningIssue.reasonCode,
        reasonSummary: warningIssue.summary,
        metadata: {
          assetId: warningIssue.assetId
        }
      };
    }

    return {
      status: SolvencyPolicyStateStatus.normal,
      pauseWithdrawalApprovals: false,
      pauseManagedWithdrawalExecution: false,
      pauseLoanFunding: false,
      pauseStakingWrites: false,
      requireManualOperatorReview: false,
      reasonCode: null,
      reasonSummary: null,
      metadata: null
    };
  }

  private buildSnapshotSummary(
    assetComputations: AssetSnapshotComputation[],
    issues: PersistedIssueInput[]
  ) {
    const totalLiabilityAmount = assetComputations.reduce(
      (current, item) => current.plus(item.totalLiabilityAmount),
      this.decimal(0)
    );
    const totalObservedReserveAmount = assetComputations.reduce(
      (current, item) => current.plus(item.observedReserveAmount),
      this.decimal(0)
    );
    const totalUsableReserveAmount = assetComputations.reduce(
      (current, item) => current.plus(item.usableReserveAmount),
      this.decimal(0)
    );
    const totalEncumberedReserveAmount = assetComputations.reduce(
      (current, item) => current.plus(item.encumberedReserveAmount),
      this.decimal(0)
    );
    const totalReserveDeltaAmount = totalUsableReserveAmount.minus(
      totalLiabilityAmount
    );

    return {
      status: this.resolveStatusFromIssues(issues),
      evidenceFreshness: this.mergeEvidenceFreshness(
        assetComputations.map((item) => item.evidenceFreshness)
      ),
      totalLiabilityAmount,
      totalObservedReserveAmount,
      totalUsableReserveAmount,
      totalEncumberedReserveAmount,
      totalReserveDeltaAmount,
      summarySnapshot: {
        totalLiabilityAmount: totalLiabilityAmount.toString(),
        totalObservedReserveAmount: totalObservedReserveAmount.toString(),
        totalUsableReserveAmount: totalUsableReserveAmount.toString(),
        totalEncumberedReserveAmount: totalEncumberedReserveAmount.toString(),
        totalReserveDeltaAmount: totalReserveDeltaAmount.toString(),
        issueClassifications: issues.map((issue) => issue.classification),
        assetStatuses: assetComputations.map((item) => ({
          assetId: item.asset.id,
          assetSymbol: item.asset.symbol,
          status: item.status
        }))
      } as PrismaJsonValue
    };
  }

  private async persistPolicyState(
    transaction: Prisma.TransactionClient,
    snapshotId: string,
    snapshotStatus: SolvencySnapshotStatus,
    derivedState: DerivedPolicyState,
    actor: SnapshotActor
  ): Promise<void> {
    const currentState = await transaction.solvencyPolicyState.findUnique({
      where: {
        environment: this.environment
      }
    });

    const now = new Date();
    const nextState = currentState
      ? await transaction.solvencyPolicyState.update({
          where: {
            environment: this.environment
          },
          data: {
            status: derivedState.status,
            pauseWithdrawalApprovals: derivedState.pauseWithdrawalApprovals,
            pauseManagedWithdrawalExecution:
              derivedState.pauseManagedWithdrawalExecution,
            pauseLoanFunding: derivedState.pauseLoanFunding,
            pauseStakingWrites: derivedState.pauseStakingWrites,
            requireManualOperatorReview: derivedState.requireManualOperatorReview,
            latestSnapshotId: snapshotId,
            triggeredAt:
              derivedState.status !== SolvencyPolicyStateStatus.normal
                ? currentState.triggeredAt ?? now
                : null,
            clearedAt:
              derivedState.status === SolvencyPolicyStateStatus.normal ? now : null,
            reasonCode: derivedState.reasonCode,
            reasonSummary: derivedState.reasonSummary,
            metadata: this.toNullableJsonInput(derivedState.metadata)
          }
        })
      : await transaction.solvencyPolicyState.create({
          data: {
            environment: this.environment,
            status: derivedState.status,
            pauseWithdrawalApprovals: derivedState.pauseWithdrawalApprovals,
            pauseManagedWithdrawalExecution:
              derivedState.pauseManagedWithdrawalExecution,
            pauseLoanFunding: derivedState.pauseLoanFunding,
            pauseStakingWrites: derivedState.pauseStakingWrites,
            requireManualOperatorReview: derivedState.requireManualOperatorReview,
            latestSnapshotId: snapshotId,
            triggeredAt:
              derivedState.status !== SolvencyPolicyStateStatus.normal ? now : null,
            clearedAt:
              derivedState.status === SolvencyPolicyStateStatus.normal ? now : null,
            reasonCode: derivedState.reasonCode,
            reasonSummary: derivedState.reasonSummary,
            metadata: this.toNullableJsonInput(derivedState.metadata)
          }
        });

    const stateChanged =
      !currentState ||
      currentState.status !== nextState.status ||
      currentState.pauseWithdrawalApprovals !==
        nextState.pauseWithdrawalApprovals ||
      currentState.pauseManagedWithdrawalExecution !==
        nextState.pauseManagedWithdrawalExecution ||
      currentState.pauseLoanFunding !== nextState.pauseLoanFunding ||
      currentState.pauseStakingWrites !== nextState.pauseStakingWrites ||
      currentState.requireManualOperatorReview !==
        nextState.requireManualOperatorReview ||
      currentState.reasonCode !== nextState.reasonCode ||
      currentState.reasonSummary !== nextState.reasonSummary;

    if (!stateChanged) {
      return;
    }

    await transaction.auditEvent.create({
      data: {
        customerId: null,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action:
          nextState.status === SolvencyPolicyStateStatus.normal
            ? "solvency.policy.cleared"
            : "solvency.policy.triggered",
        targetType: "SolvencyPolicyState",
        targetId: nextState.id,
        metadata: {
          snapshotId,
          snapshotStatus,
          previousStatus: currentState?.status ?? null,
          newStatus: nextState.status,
          pauseWithdrawalApprovals: nextState.pauseWithdrawalApprovals,
          pauseManagedWithdrawalExecution:
            nextState.pauseManagedWithdrawalExecution,
          pauseLoanFunding: nextState.pauseLoanFunding,
          pauseStakingWrites: nextState.pauseStakingWrites,
          requireManualOperatorReview: nextState.requireManualOperatorReview,
          reasonCode: nextState.reasonCode,
          reasonSummary: nextState.reasonSummary
        } as PrismaJsonValue
      }
    });

    if (nextState.status === SolvencyPolicyStateStatus.paused) {
      const reviewCaseResult = await this.reviewCasesService.openOrReuseReviewCase(
        transaction as unknown as PrismaService,
        {
          customerId: null,
          customerAccountId: null,
          transactionIntentId: null,
          type: ReviewCaseType.manual_intervention,
          reasonCode: `solvency_policy:${nextState.reasonCode ?? "guarded"}`,
          notes:
            nextState.reasonSummary ??
            "Critical solvency controls were triggered automatically.",
          actorType: actor.actorType,
          actorId: actor.actorId,
          auditAction: "review_case.solvency_policy.opened",
          auditMetadata: {
            snapshotId,
            policyStateId: nextState.id,
            policyStatus: nextState.status
          }
        }
      );

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: actor.actorType,
          actorId: actor.actorId,
          action: "solvency.review_case.opened",
          targetType: "ReviewCase",
          targetId: reviewCaseResult.reviewCase.id,
          metadata: {
            snapshotId,
            policyStateId: nextState.id,
            reviewCaseReused: reviewCaseResult.reviewCaseReused,
            policyStatus: nextState.status
          } as PrismaJsonValue
        }
      });
    }
  }

  private createZeroLiabilityComputation(asset: AssetRecord): LiabilityAssetComputation {
    return {
      asset,
      availableLiabilityAmount: this.decimal(0),
      reservedLiabilityAmount: this.decimal(0),
      pendingCreditAmount: this.decimal(0),
      totalLiabilityAmount: this.decimal(0),
      projectionAvailableAmount: this.decimal(0),
      projectionPendingAmount: this.decimal(0),
      projectionMatchesLedger: true,
      openReconciliationMismatchCount: 0,
      criticalReconciliationMismatchCount: 0
    };
  }

  private mapReserveSourceType(kind: WalletKind): SolvencyReserveSourceType {
    if (kind === WalletKind.operational) {
      return SolvencyReserveSourceType.operational_wallet;
    }

    if (kind === WalletKind.contract) {
      return SolvencyReserveSourceType.contract_wallet;
    }

    return SolvencyReserveSourceType.treasury_wallet;
  }

  private async readWalletAssetBalance(
    wallet: ReserveWalletRecord,
    asset: AssetRecord
  ): Promise<Prisma.Decimal> {
    if (asset.assetType === AssetType.native) {
      const balance = await this.provider.getBalance(wallet.address);
      return this.decimal(
        ethers.utils.formatUnits(balance, asset.decimals)
      );
    }

    if (!asset.contractAddress) {
      throw new Error("ERC20 asset is missing a contract address.");
    }

    const contract = new ethers.Contract(
      asset.contractAddress,
      ERC20_BALANCE_OF_ABI,
      this.provider
    );
    const balance = await contract.balanceOf(wallet.address);

    return this.decimal(ethers.utils.formatUnits(balance, asset.decimals));
  }

  private computeReserveRatioBps(
    usableReserveAmount: Prisma.Decimal,
    liabilityAmount: Prisma.Decimal
  ): number | null {
    if (liabilityAmount.eq(0)) {
      return usableReserveAmount.eq(0) ? null : 100000;
    }

    return usableReserveAmount
      .mul(10000)
      .div(liabilityAmount)
      .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  private mergeEvidenceFreshness(
    values: SolvencyEvidenceFreshness[]
  ): SolvencyEvidenceFreshness {
    if (values.length === 0) {
      return SolvencyEvidenceFreshness.unknown;
    }

    if (values.includes(SolvencyEvidenceFreshness.missing)) {
      return SolvencyEvidenceFreshness.missing;
    }

    if (values.includes(SolvencyEvidenceFreshness.stale)) {
      return SolvencyEvidenceFreshness.stale;
    }

    if (values.every((value) => value === SolvencyEvidenceFreshness.fresh)) {
      return SolvencyEvidenceFreshness.fresh;
    }

    return SolvencyEvidenceFreshness.unknown;
  }

  private resolveStatusFromIssues(
    issues: Array<{ severity: SolvencyIssueSeverity }>
  ): SolvencySnapshotStatus {
    if (issues.some((issue) => issue.severity === SolvencyIssueSeverity.critical)) {
      return SolvencySnapshotStatus.critical;
    }

    if (issues.some((issue) => issue.severity === SolvencyIssueSeverity.warning)) {
      return SolvencySnapshotStatus.warning;
    }

    return SolvencySnapshotStatus.healthy;
  }

  private decimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(value);
  }

  private toNullableJsonInput(
    value: PrismaJsonValue | null | undefined
  ): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
    if (value === null) {
      return Prisma.DbNull;
    }

    return typeof value === "undefined" ? undefined : value;
  }

  private normalizeError(error: unknown): { code: string; message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        code: error.name || "solvency_snapshot_failed",
        message: error.message,
        stack: error.stack
      };
    }

    return {
      code: "solvency_snapshot_failed",
      message: "Solvency snapshot generation failed."
    };
  }
}
