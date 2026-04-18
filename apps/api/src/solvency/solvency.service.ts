import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
  SolvencyPolicyResumeRequestStatus,
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
import {
  assertOperatorRoleAuthorized,
  normalizeOperatorRole
} from "../auth/internal-operator-role-policy";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import {
  buildMerkleProof,
  buildMerkleRoot,
  buildSha256Checksum,
  buildSignedSolvencyReport,
  hashLiabilityLeaf,
  type LiabilityLeafPayload,
  type SolvencyReportPayload
} from "./solvency-proof";

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
const DEFAULT_PUBLIC_REPORT_LIMIT = 10;

type SnapshotActor = {
  actorType: "operator" | "worker" | "system";
  actorId: string | null;
};

type SolvencyOperatorContext = {
  operatorId: string | null;
  operatorRole: string | null;
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
  manualResumeRequired: boolean;
  manualResumeRequestedAt: string | null;
  manualResumeApprovedAt: string | null;
  manualResumeApprovedByOperatorId: string | null;
  manualResumeApprovedByOperatorRole: string | null;
  metadata: Prisma.JsonValue | null;
  updatedAt: string;
};

type SolvencyResumeGovernanceProjection = {
  requestAllowedOperatorRoles: string[];
  approverAllowedOperatorRoles: string[];
  currentOperator: {
    operatorId: string | null;
    operatorRole: string | null;
    canRequestResume: boolean;
    canApproveResume: boolean;
  };
};

type SolvencyPolicyResumeRequestProjection = {
  id: string;
  environment: WorkerRuntimeEnvironment;
  snapshotId: string;
  status: SolvencyPolicyResumeRequestStatus;
  requestedByOperatorId: string;
  requestedByOperatorRole: string;
  requestNote: string | null;
  expectedPolicyUpdatedAt: string;
  requestedAt: string;
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

type SolvencyReportProjection = {
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
  publishedAt: string;
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
  report: SolvencyReportProjection | null;
};

export type SolvencyWorkspaceResult = {
  generatedAt: string;
  policyState: SolvencyPolicyProjection;
  resumeGovernance: SolvencyResumeGovernanceProjection;
  latestPendingResumeRequest: SolvencyPolicyResumeRequestProjection | null;
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
  liabilityMerkleRoot: string | null;
  liabilityLeafCount: number;
  liabilitySetChecksumSha256: string | null;
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
  latestPendingResumeRequest: SolvencyPolicyResumeRequestProjection | null;
  assetSnapshots: SolvencyAssetDetailProjection[];
  issues: SolvencyIssueProjection[];
  reserveEvidence: SolvencyReserveEvidenceProjection[];
};

export type CustomerLiabilityInclusionProofResult = {
  report: SolvencyReportProjection;
  snapshot: SolvencyWorkspaceSummarySnapshot;
  customerAccountId: string;
  proofs: Array<{
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
      assetType: AssetType;
    };
    leafIndex: number;
    leafHash: string;
    rootHash: string;
    proof: string[];
    payload: LiabilityLeafPayload;
  }>;
};

export type SolvencyPolicyResumeRequestMutationResult = {
  policyState: SolvencyPolicyProjection;
  request: SolvencyPolicyResumeRequestProjection;
};

export type PublicSolvencyReportListResult = {
  generatedAt: string;
  limit: number;
  reports: Array<{
    report: SolvencyReportProjection;
    snapshot: SolvencyWorkspaceSummarySnapshot;
  }>;
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

type LiabilityLeafComputation = {
  assetId: string;
  customerAccountId: string;
  availableLiabilityAmount: Prisma.Decimal;
  reservedLiabilityAmount: Prisma.Decimal;
  pendingCreditAmount: Prisma.Decimal;
  totalLiabilityAmount: Prisma.Decimal;
};

type LiabilityProofLeafComputation = {
  customerAccountId: string;
  leafIndex: number;
  leafHash: string;
  payload: LiabilityLeafPayload;
  availableLiabilityAmount: Prisma.Decimal;
  reservedLiabilityAmount: Prisma.Decimal;
  pendingCreditAmount: Prisma.Decimal;
  totalLiabilityAmount: Prisma.Decimal;
};

type LiabilityProofAssetComputation = {
  assetId: string;
  liabilityMerkleRoot: string | null;
  liabilityLeafCount: number;
  liabilitySetChecksumSha256: string | null;
  leaves: LiabilityProofLeafComputation[];
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
  liabilityMerkleRoot: string | null;
  liabilityLeafCount: number;
  liabilitySetChecksumSha256: string | null;
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
  manualResumeRequired: boolean;
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
  private readonly reportSignerPrivateKey: string;
  private readonly resumeRequestAllowedOperatorRoles: string[];
  private readonly resumeApproverAllowedOperatorRoles: string[];
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
    this.reportSignerPrivateKey = runtimeConfig.reportSignerPrivateKey;
    this.resumeRequestAllowedOperatorRoles = [
      ...runtimeConfig.resumeRequestAllowedOperatorRoles
    ];
    this.resumeApproverAllowedOperatorRoles = [
      ...runtimeConfig.resumeApproverAllowedOperatorRoles
    ];
    this.provider = createJsonRpcProvider(chainRuntimeConfig.rpcUrl);
  }

  async getWorkspace(
    limit = DEFAULT_WORKSPACE_LIMIT,
    operator?: SolvencyOperatorContext
  ): Promise<SolvencyWorkspaceResult> {
    const [
      policyState,
      latestSnapshot,
      recentSnapshots,
      latestHealthySnapshot,
      latestPendingResumeRequest
    ] =
      await Promise.all([
        this.getOrCreatePolicyState(),
        this.prismaService.solvencySnapshot.findFirst({
          where: {
            environment: this.environment
          },
          include: {
            reports: {
              orderBy: {
                publishedAt: "desc"
              },
              take: 1
            }
          },
          orderBy: {
            generatedAt: "desc"
          }
        }),
        this.prismaService.solvencySnapshot.findMany({
          where: {
            environment: this.environment
          },
          include: {
            reports: {
              orderBy: {
                publishedAt: "desc"
              },
              take: 1
            }
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
          include: {
            reports: {
              orderBy: {
                publishedAt: "desc"
              },
              take: 1
            }
          },
          orderBy: {
            generatedAt: "desc"
          }
        }),
        this.prismaService.solvencyPolicyResumeRequest.findFirst({
          where: {
            environment: this.environment,
            status: SolvencyPolicyResumeRequestStatus.pending_approval
          },
          orderBy: {
            requestedAt: "desc"
          }
        })
      ]);

    return {
      generatedAt: new Date().toISOString(),
      policyState: this.mapPolicyStateProjection(policyState),
      resumeGovernance: this.buildResumeGovernanceProjection(operator),
      latestPendingResumeRequest: latestPendingResumeRequest
        ? this.mapPolicyResumeRequestProjection(latestPendingResumeRequest)
        : null,
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
        reports: {
          orderBy: {
            publishedAt: "desc"
          },
          take: 1
        },
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

    const [policyState, latestPendingResumeRequest] = await Promise.all([
      this.getOrCreatePolicyState(),
      this.prismaService.solvencyPolicyResumeRequest.findFirst({
        where: {
          environment: snapshot.environment,
          status: SolvencyPolicyResumeRequestStatus.pending_approval
        },
        orderBy: {
          requestedAt: "desc"
        }
      })
    ]);

    return {
      snapshot: {
        ...this.mapWorkspaceSnapshot(snapshot),
        summarySnapshot: snapshot.summarySnapshot ?? null,
        policyActionSnapshot: snapshot.policyActionSnapshot ?? null
      },
      policyState: this.mapPolicyStateProjection(policyState),
      latestPendingResumeRequest: latestPendingResumeRequest
        ? this.mapPolicyResumeRequestProjection(latestPendingResumeRequest)
        : null,
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
        liabilityMerkleRoot: item.liabilityMerkleRoot ?? null,
        liabilityLeafCount: item.liabilityLeafCount,
        liabilitySetChecksumSha256: item.liabilitySetChecksumSha256 ?? null,
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

      const [liabilitiesByAsset, reserveEvidenceByAsset, liabilityProofByAsset] =
        await Promise.all([
        this.computeLiabilitiesByAsset(assets, mismatchCounts),
        this.computeReserveEvidenceByAsset(assets, reserveWallets),
        this.computeLiabilityLeavesByAsset(pendingSnapshot.id, assets)
      ]);

      const assetComputations = assets.map((asset) =>
        this.buildAssetSnapshotComputation({
          asset,
          liabilities:
            liabilitiesByAsset.get(asset.id) ?? this.createZeroLiabilityComputation(asset),
          reserveEvidence: reserveEvidenceByAsset.get(asset.id) ?? [],
          liabilityProof: liabilityProofByAsset.get(asset.id) ?? {
            assetId: asset.id,
            liabilityMerkleRoot: null,
            liabilityLeafCount: 0,
            liabilitySetChecksumSha256: null,
            leaves: []
          }
        })
      );

      const allIssues = assetComputations.flatMap((item) => item.issues);
      const policyState = this.derivePolicyState(assetComputations, allIssues);
      const summary = this.buildSnapshotSummary(assetComputations, allIssues);
      const signedReport = this.buildSignedReport({
        snapshotId: pendingSnapshot.id,
        generatedAt: pendingSnapshot.generatedAt.toISOString(),
        completedAt: new Date().toISOString(),
        summary,
        assetComputations,
        policyState
      });

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
                liabilityMerkleRoot: item.liabilityMerkleRoot,
                liabilityLeafCount: item.liabilityLeafCount,
                liabilitySetChecksumSha256: item.liabilitySetChecksumSha256,
                summarySnapshot: item.summarySnapshot
              }))
            });
          }

          const liabilityLeafRows = assetComputations.flatMap((item) =>
            (liabilityProofByAsset.get(item.asset.id)?.leaves ?? []).map((leaf) => ({
              snapshotId: pendingSnapshot.id,
              assetId: item.asset.id,
              customerAccountId: leaf.customerAccountId,
              leafIndex: leaf.leafIndex,
              availableLiabilityAmount: leaf.availableLiabilityAmount,
              reservedLiabilityAmount: leaf.reservedLiabilityAmount,
              pendingCreditAmount: leaf.pendingCreditAmount,
              totalLiabilityAmount: leaf.totalLiabilityAmount,
              leafHash: leaf.leafHash,
              canonicalPayload: leaf.payload as unknown as PrismaJsonValue
            }))
          );

          if (liabilityLeafRows.length > 0) {
            await transaction.solvencyLiabilityLeaf.createMany({
              data: liabilityLeafRows
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

          await transaction.solvencyReport.create({
            data: {
              snapshotId: pendingSnapshot.id,
              environment: this.environment,
              chainId: this.productChainId,
              reportVersion: 1,
              reportHash: signedReport.reportHash,
              reportChecksumSha256: signedReport.reportChecksumSha256,
              canonicalPayload:
                signedReport.payload as unknown as PrismaJsonValue,
              canonicalPayloadText: signedReport.canonicalPayloadText,
              signature: signedReport.signature,
              signatureAlgorithm: signedReport.signatureAlgorithm,
              signerAddress: signedReport.signerAddress,
              publishedAt: new Date()
            }
          });

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
                policyStatus: policyState.status,
                reportHash: signedReport.reportHash,
                signerAddress: signedReport.signerAddress
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
            },
            include: {
              reports: {
                orderBy: {
                  publishedAt: "desc"
                },
                take: 1
              }
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

  async getLatestPublicReport(): Promise<{
    report: SolvencyReportProjection;
    snapshot: SolvencyWorkspaceSummarySnapshot;
  }> {
    const snapshot = await this.prismaService.solvencySnapshot.findFirst({
      where: {
        environment: this.environment,
        reports: {
          some: {}
        }
      },
      include: {
        reports: {
          orderBy: {
            publishedAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        generatedAt: "desc"
      }
    });

    if (!snapshot || !snapshot.reports[0]) {
      throw new NotFoundException("No signed solvency report is available.");
    }

    return {
      report: this.mapReportProjection(snapshot.reports[0]),
      snapshot: this.mapWorkspaceSnapshot(snapshot)
    };
  }

  async listPublicReports(limit = DEFAULT_PUBLIC_REPORT_LIMIT): Promise<PublicSolvencyReportListResult> {
    const normalizedLimit = Math.min(Math.max(limit, 1), 50);
    const snapshots = await this.prismaService.solvencySnapshot.findMany({
      where: {
        environment: this.environment,
        reports: {
          some: {}
        }
      },
      include: {
        reports: {
          orderBy: {
            publishedAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        generatedAt: "desc"
      },
      take: normalizedLimit
    });

    return {
      generatedAt: new Date().toISOString(),
      limit: normalizedLimit,
      reports: snapshots
        .filter((snapshot) => Boolean(snapshot.reports[0]))
        .map((snapshot) => ({
          report: this.mapReportProjection(snapshot.reports[0]!),
          snapshot: this.mapWorkspaceSnapshot(snapshot)
        }))
    };
  }

  async getPublicReportBySnapshotId(snapshotId: string): Promise<{
    report: SolvencyReportProjection;
    snapshot: SolvencyWorkspaceSummarySnapshot;
  }> {
    const snapshot = await this.prismaService.solvencySnapshot.findUnique({
      where: {
        id: snapshotId
      },
      include: {
        reports: {
          orderBy: {
            publishedAt: "desc"
          },
          take: 1
        }
      }
    });

    if (!snapshot || !snapshot.reports[0]) {
      throw new NotFoundException("Signed solvency report was not found.");
    }

    return {
      report: this.mapReportProjection(snapshot.reports[0]),
      snapshot: this.mapWorkspaceSnapshot(snapshot)
    };
  }

  async getCustomerLiabilityInclusionProof(
    supabaseUserId: string,
    snapshotId?: string
  ): Promise<CustomerLiabilityInclusionProofResult> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId
        }
      },
      select: {
        id: true
      }
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    const snapshot = snapshotId
      ? await this.prismaService.solvencySnapshot.findUnique({
          where: {
            id: snapshotId
          },
          include: {
            reports: {
              orderBy: {
                publishedAt: "desc"
              },
              take: 1
            }
          }
        })
      : await this.prismaService.solvencySnapshot.findFirst({
          where: {
            environment: this.environment,
            reports: {
              some: {}
            }
          },
          include: {
            reports: {
              orderBy: {
                publishedAt: "desc"
              },
              take: 1
            }
          },
          orderBy: {
            generatedAt: "desc"
          }
        });

    if (!snapshot || !snapshot.reports[0]) {
      throw new NotFoundException("Signed solvency report was not found.");
    }

    const [customerLeaves, allSnapshotLeaves] = await Promise.all([
      this.prismaService.solvencyLiabilityLeaf.findMany({
        where: {
          snapshotId: snapshot.id,
          customerAccountId: customerAccount.id
        },
        orderBy: [
          {
            assetId: "asc"
          },
          {
            leafIndex: "asc"
          }
        ]
      }),
      this.prismaService.solvencyLiabilityLeaf.findMany({
        where: {
          snapshotId: snapshot.id
        },
        include: {
          asset: true
        },
        orderBy: [
          {
            assetId: "asc"
          },
          {
            leafIndex: "asc"
          }
        ]
      })
    ]);
    const assetRecords = await this.prismaService.asset.findMany({
      where: {
        id: {
          in: customerLeaves.map((leaf) => leaf.assetId)
        }
      }
    });

    const allLeafHashesByAsset = new Map<string, string[]>();
    for (const leaf of allSnapshotLeaves) {
      const current = allLeafHashesByAsset.get(leaf.assetId) ?? [];
      current.push(leaf.leafHash);
      allLeafHashesByAsset.set(leaf.assetId, current);
    }

    const assetById = new Map(assetRecords.map((asset) => [asset.id, asset] as const));
    const proofs = customerLeaves.map((leaf) => {
      const asset = assetById.get(leaf.assetId);
      if (!asset) {
        throw new NotFoundException(
          `Asset metadata missing for liability proof asset ${leaf.assetId}.`
        );
      }

      const proof = buildMerkleProof(
        allLeafHashesByAsset.get(leaf.assetId) ?? [],
        leaf.leafIndex
      );
      const rootHash = buildMerkleRoot(allLeafHashesByAsset.get(leaf.assetId) ?? []);

      if (!rootHash) {
        throw new NotFoundException("Liability proof root is missing.");
      }

      return {
        asset: {
          id: asset.id,
          symbol: asset.symbol,
          displayName: asset.displayName,
          decimals: asset.decimals,
          chainId: asset.chainId,
          assetType: asset.assetType
        },
        leafIndex: leaf.leafIndex,
        leafHash: leaf.leafHash,
        rootHash,
        proof,
        payload: leaf.canonicalPayload as unknown as LiabilityLeafPayload
      };
    });

    return {
      report: this.mapReportProjection(snapshot.reports[0]),
      snapshot: this.mapWorkspaceSnapshot(snapshot),
      customerAccountId: customerAccount.id,
      proofs
    };
  }

  async requestPolicyResume(
    snapshotId: string,
    expectedPolicyUpdatedAt: string,
    requestNote: string | undefined,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<SolvencyPolicyResumeRequestMutationResult> {
    const normalizedOperatorRole = this.assertCanRequestResume(operatorRole);
    const policyState = await this.getOrCreatePolicyState();

    if (policyState.status !== SolvencyPolicyStateStatus.paused) {
      throw new ConflictException(
        "Manual resume requests are only available while solvency policy is paused."
      );
    }

    if (!policyState.manualResumeRequired) {
      throw new ConflictException(
        "Current solvency policy does not require governed manual resume."
      );
    }

    if (policyState.updatedAt.toISOString() !== expectedPolicyUpdatedAt) {
      throw new ConflictException(
        "Solvency policy changed after it was loaded. Refresh the workspace and retry."
      );
    }

    const [snapshot, existingPendingRequest] = await Promise.all([
      this.prismaService.solvencySnapshot.findUnique({
        where: {
          id: snapshotId
        },
        include: {
          reports: {
            take: 1
          }
        }
      }),
      this.prismaService.solvencyPolicyResumeRequest.findFirst({
        where: {
          environment: this.environment,
          status: SolvencyPolicyResumeRequestStatus.pending_approval
        },
        orderBy: {
          requestedAt: "desc"
        }
      })
    ]);

    if (existingPendingRequest) {
      throw new ConflictException(
        "A pending solvency resume request already exists for this environment."
      );
    }

    if (!snapshot || snapshot.environment !== this.environment) {
      throw new NotFoundException("Requested solvency snapshot was not found.");
    }

    if (snapshot.status !== SolvencySnapshotStatus.healthy) {
      throw new ConflictException(
        "Manual resume requires a healthy solvency snapshot."
      );
    }

    if (!snapshot.reports[0]) {
      throw new ConflictException(
        "Manual resume requires a signed solvency report for the selected snapshot."
      );
    }

    const normalizedRequestNote = this.normalizeOptionalString(requestNote);
    const createdRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const currentPolicyState = await transaction.solvencyPolicyState.findUnique({
          where: {
            environment: this.environment
          }
        });

        if (!currentPolicyState) {
          throw new NotFoundException("Solvency policy state not found.");
        }

        if (currentPolicyState.updatedAt.toISOString() !== expectedPolicyUpdatedAt) {
          throw new ConflictException(
            "Solvency policy changed after it was loaded. Refresh the workspace and retry."
          );
        }

        const nextRequest = await transaction.solvencyPolicyResumeRequest.create({
          data: {
            environment: this.environment,
            policyStateId: currentPolicyState.id,
            snapshotId: snapshot.id,
            status: SolvencyPolicyResumeRequestStatus.pending_approval,
            requestedByOperatorId: operatorId,
            requestedByOperatorRole: normalizedOperatorRole,
            requestNote: normalizedRequestNote ?? undefined,
            expectedPolicyUpdatedAt: currentPolicyState.updatedAt
          }
        });

        await transaction.solvencyPolicyState.update({
          where: {
            environment: this.environment
          },
          data: {
            manualResumeRequestedAt: nextRequest.requestedAt
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: null,
            actorType: "operator",
            actorId: operatorId,
            action: "solvency.policy_resume.requested",
            targetType: "SolvencyPolicyResumeRequest",
            targetId: nextRequest.id,
            metadata: {
              snapshotId: snapshot.id,
              operatorRole: normalizedOperatorRole,
              requestNote: normalizedRequestNote ?? null
            } as PrismaJsonValue
          }
        });

        return nextRequest;
      }
    );

    return {
      policyState: this.mapPolicyStateProjection(await this.getOrCreatePolicyState()),
      request: this.mapPolicyResumeRequestProjection(createdRequest)
    };
  }

  async approvePolicyResume(
    requestId: string,
    approvalNote: string | undefined,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<SolvencyPolicyResumeRequestMutationResult> {
    const approvedOperatorRole = this.assertCanApproveResume(operatorRole);
    const request = await this.prismaService.solvencyPolicyResumeRequest.findUnique({
      where: {
        id: requestId
      }
    });

    if (!request) {
      throw new NotFoundException("Solvency resume request was not found.");
    }

    if (request.status !== SolvencyPolicyResumeRequestStatus.pending_approval) {
      throw new ConflictException(
        "Only pending solvency resume requests can be approved."
      );
    }

    if (request.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Solvency resume approval requires a different approver than the requester."
      );
    }

    const normalizedApprovalNote = this.normalizeOptionalString(approvalNote);
    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const [currentRequest, policyState, snapshot] = await Promise.all([
          transaction.solvencyPolicyResumeRequest.findUnique({
            where: {
              id: requestId
            }
          }),
          transaction.solvencyPolicyState.findUnique({
            where: {
              environment: this.environment
            }
          }),
          transaction.solvencySnapshot.findUnique({
            where: {
              id: request.snapshotId
            },
            include: {
              reports: {
                take: 1
              }
            }
          })
        ]);

        if (!currentRequest) {
          throw new NotFoundException("Solvency resume request was not found.");
        }

        if (
          currentRequest.status !== SolvencyPolicyResumeRequestStatus.pending_approval
        ) {
          throw new ConflictException(
            "Only pending solvency resume requests can be approved."
          );
        }

        if (!policyState) {
          throw new NotFoundException("Solvency policy state not found.");
        }

        if (policyState.updatedAt.toISOString() !== currentRequest.expectedPolicyUpdatedAt.toISOString()) {
          throw new ConflictException(
            "Solvency policy changed after the resume request was created. Request a new governed resume."
          );
        }

        if (policyState.status !== SolvencyPolicyStateStatus.paused) {
          throw new ConflictException(
            "Solvency policy is no longer paused."
          );
        }

        if (!snapshot || snapshot.status !== SolvencySnapshotStatus.healthy) {
          throw new ConflictException(
            "Resume approval requires the bound snapshot to remain healthy."
          );
        }

        if (!snapshot.reports[0]) {
          throw new ConflictException(
            "Resume approval requires a signed solvency report."
          );
        }

        const approvedAt = new Date();
        const nextRequest = await transaction.solvencyPolicyResumeRequest.update({
          where: {
            id: currentRequest.id
          },
          data: {
            status: SolvencyPolicyResumeRequestStatus.approved,
            approvedByOperatorId: operatorId,
            approvedByOperatorRole: approvedOperatorRole,
            approvalNote: normalizedApprovalNote ?? undefined,
            approvedAt
          }
        });

        await transaction.solvencyPolicyState.update({
          where: {
            environment: this.environment
          },
          data: {
            status: SolvencyPolicyStateStatus.normal,
            pauseWithdrawalApprovals: false,
            pauseManagedWithdrawalExecution: false,
            pauseLoanFunding: false,
            pauseStakingWrites: false,
            requireManualOperatorReview: false,
            reasonCode: "manual_resume_approved",
            reasonSummary:
              "Paused solvency controls were manually resumed after governed approval against a healthy signed snapshot.",
            manualResumeRequired: false,
            manualResumeRequestedAt: null,
            manualResumeApprovedAt: approvedAt,
            manualResumeApprovedByOperatorId: operatorId,
            manualResumeApprovedByOperatorRole: approvedOperatorRole,
            latestSnapshotId: snapshot.id,
            clearedAt: approvedAt,
            metadata: this.toNullableJsonInput({
              approvedResumeRequestId: currentRequest.id,
              approvedSnapshotId: snapshot.id,
              signerAddress: snapshot.reports[0].signerAddress,
              reportHash: snapshot.reports[0].reportHash
            })
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: null,
            actorType: "operator",
            actorId: operatorId,
            action: "solvency.policy_resume.approved",
            targetType: "SolvencyPolicyResumeRequest",
            targetId: currentRequest.id,
            metadata: {
              snapshotId: snapshot.id,
              operatorRole: approvedOperatorRole,
              approvalNote: normalizedApprovalNote ?? null
            } as PrismaJsonValue
          }
        });

        return nextRequest;
      }
    );

    return {
      policyState: this.mapPolicyStateProjection(await this.getOrCreatePolicyState()),
      request: this.mapPolicyResumeRequestProjection(updatedRequest)
    };
  }

  async rejectPolicyResume(
    requestId: string,
    rejectionNote: string | undefined,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<SolvencyPolicyResumeRequestMutationResult> {
    const rejectedOperatorRole = this.assertCanApproveResume(operatorRole);
    const request = await this.prismaService.solvencyPolicyResumeRequest.findUnique({
      where: {
        id: requestId
      }
    });

    if (!request) {
      throw new NotFoundException("Solvency resume request was not found.");
    }

    if (request.status !== SolvencyPolicyResumeRequestStatus.pending_approval) {
      throw new ConflictException(
        "Only pending solvency resume requests can be rejected."
      );
    }

    const normalizedRejectionNote = this.normalizeOptionalString(rejectionNote);
    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const nextRequest = await transaction.solvencyPolicyResumeRequest.update({
          where: {
            id: requestId
          },
          data: {
            status: SolvencyPolicyResumeRequestStatus.rejected,
            rejectedByOperatorId: operatorId,
            rejectedByOperatorRole: rejectedOperatorRole,
            rejectionNote: normalizedRejectionNote ?? undefined,
            rejectedAt: new Date()
          }
        });

        await transaction.auditEvent.create({
          data: {
            customerId: null,
            actorType: "operator",
            actorId: operatorId,
            action: "solvency.policy_resume.rejected",
            targetType: "SolvencyPolicyResumeRequest",
            targetId: nextRequest.id,
            metadata: {
              operatorRole: rejectedOperatorRole,
              rejectionNote: normalizedRejectionNote ?? null
            } as PrismaJsonValue
          }
        });

        return nextRequest;
      }
    );

    return {
      policyState: this.mapPolicyStateProjection(await this.getOrCreatePolicyState()),
      request: this.mapPolicyResumeRequestProjection(updatedRequest)
    };
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
        manualResumeRequired: false,
        manualResumeRequestedAt: null,
        manualResumeApprovedAt: null,
        manualResumeApprovedByOperatorId: null,
        manualResumeApprovedByOperatorRole: null,
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
      manualResumeRequired: record.manualResumeRequired,
      manualResumeRequestedAt: record.manualResumeRequestedAt?.toISOString() ?? null,
      manualResumeApprovedAt: record.manualResumeApprovedAt?.toISOString() ?? null,
      manualResumeApprovedByOperatorId:
        record.manualResumeApprovedByOperatorId ?? null,
      manualResumeApprovedByOperatorRole:
        record.manualResumeApprovedByOperatorRole ?? null,
      metadata: record.metadata ?? null,
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private buildResumeGovernanceProjection(
    operator?: SolvencyOperatorContext
  ): SolvencyResumeGovernanceProjection {
    const operatorRole = normalizeOperatorRole(operator?.operatorRole);

    return {
      requestAllowedOperatorRoles: [...this.resumeRequestAllowedOperatorRoles],
      approverAllowedOperatorRoles: [...this.resumeApproverAllowedOperatorRoles],
      currentOperator: {
        operatorId: operator?.operatorId ?? null,
        operatorRole,
        canRequestResume: Boolean(
          operatorRole &&
            this.resumeRequestAllowedOperatorRoles.includes(operatorRole)
        ),
        canApproveResume: Boolean(
          operatorRole &&
            this.resumeApproverAllowedOperatorRoles.includes(operatorRole)
        )
      }
    };
  }

  private mapPolicyResumeRequestProjection(
    record: Awaited<
      ReturnType<typeof this.prismaService.solvencyPolicyResumeRequest.findFirst>
    > extends infer T
      ? T extends null
        ? never
        : T
      : never
  ): SolvencyPolicyResumeRequestProjection {
    return {
      id: record.id,
      environment: record.environment,
      snapshotId: record.snapshotId,
      status: record.status,
      requestedByOperatorId: record.requestedByOperatorId,
      requestedByOperatorRole: record.requestedByOperatorRole,
      requestNote: record.requestNote ?? null,
      expectedPolicyUpdatedAt: record.expectedPolicyUpdatedAt.toISOString(),
      requestedAt: record.requestedAt.toISOString(),
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

  private mapReportProjection(
    record: {
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
    }
  ): SolvencyReportProjection {
    return {
      id: record.id,
      snapshotId: record.snapshotId,
      environment: record.environment,
      chainId: record.chainId,
      reportVersion: record.reportVersion,
      reportHash: record.reportHash,
      reportChecksumSha256: record.reportChecksumSha256,
      canonicalPayload: record.canonicalPayload ?? null,
      canonicalPayloadText: record.canonicalPayloadText,
      signature: record.signature,
      signatureAlgorithm: record.signatureAlgorithm,
      signerAddress: record.signerAddress,
      publishedAt: record.publishedAt.toISOString()
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
      failureMessage: snapshot.failureMessage ?? null,
      report:
        "reports" in snapshot && Array.isArray(snapshot.reports) && snapshot.reports[0]
          ? this.mapReportProjection(snapshot.reports[0])
          : null
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

  private async computeLiabilityLeavesByAsset(
    snapshotId: string,
    assets: AssetRecord[]
  ): Promise<Map<string, LiabilityProofAssetComputation>> {
    const [ledgerAccounts, customerBalances] = await Promise.all([
      this.prismaService.ledgerAccount.findMany({
        where: {
          chainId: this.productChainId,
          customerAccountId: {
            not: null
          },
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
        where: {
          assetId: {
            in: assets.map((asset) => asset.id)
          }
        },
        select: {
          customerAccountId: true,
          assetId: true,
          availableBalance: true,
          pendingBalance: true
        }
      })
    ]);

    const rawLeavesByAsset = new Map<string, LiabilityLeafComputation[]>();
    const byCompositeKey = new Map<string, LiabilityLeafComputation>();

    for (const account of ledgerAccounts) {
      if (!account.customerAccountId) {
        continue;
      }

      const compositeKey = `${account.assetId}:${account.customerAccountId}`;
      const existing = byCompositeKey.get(compositeKey) ?? {
        assetId: account.assetId,
        customerAccountId: account.customerAccountId,
        availableLiabilityAmount: this.decimal(0),
        reservedLiabilityAmount: this.decimal(0),
        pendingCreditAmount: this.decimal(0),
        totalLiabilityAmount: this.decimal(0)
      };
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
        existing.reservedLiabilityAmount =
          existing.reservedLiabilityAmount.plus(netAmount);
      } else {
        existing.availableLiabilityAmount =
          existing.availableLiabilityAmount.plus(netAmount);
      }

      existing.totalLiabilityAmount = existing.availableLiabilityAmount.plus(
        existing.reservedLiabilityAmount
      );
      byCompositeKey.set(compositeKey, existing);
    }

    for (const [compositeKey, entry] of byCompositeKey.entries()) {
      if (entry.totalLiabilityAmount.lte(0)) {
        continue;
      }

      const current = rawLeavesByAsset.get(entry.assetId) ?? [];
      current.push(entry);
      rawLeavesByAsset.set(entry.assetId, current);
    }

    for (const balance of customerBalances) {
      const compositeKey = `${balance.assetId}:${balance.customerAccountId}`;
      if (byCompositeKey.has(compositeKey)) {
        continue;
      }

      const totalLiabilityAmount = balance.availableBalance.plus(balance.pendingBalance);
      if (totalLiabilityAmount.lte(0)) {
        continue;
      }

      const current = rawLeavesByAsset.get(balance.assetId) ?? [];
      current.push({
        assetId: balance.assetId,
        customerAccountId: balance.customerAccountId,
        availableLiabilityAmount: balance.availableBalance,
        reservedLiabilityAmount: balance.pendingBalance,
        pendingCreditAmount: this.decimal(0),
        totalLiabilityAmount
      });
      rawLeavesByAsset.set(balance.assetId, current);
    }

    const proofByAsset = new Map<string, LiabilityProofAssetComputation>();

    for (const asset of assets) {
      const orderedLeaves = (rawLeavesByAsset.get(asset.id) ?? [])
        .sort((left, right) =>
          left.customerAccountId.localeCompare(right.customerAccountId)
        )
        .map((entry, leafIndex) => {
          const payload: LiabilityLeafPayload = {
            version: 1,
            snapshotId,
            assetId: asset.id,
            assetSymbol: asset.symbol,
            customerAccountId: entry.customerAccountId,
            leafIndex,
            availableLiabilityAmount: entry.availableLiabilityAmount.toString(),
            reservedLiabilityAmount: entry.reservedLiabilityAmount.toString(),
            pendingCreditAmount: entry.pendingCreditAmount.toString(),
            totalLiabilityAmount: entry.totalLiabilityAmount.toString()
          };

          return {
            customerAccountId: entry.customerAccountId,
            leafIndex,
            leafHash: hashLiabilityLeaf(payload),
            payload,
            availableLiabilityAmount: entry.availableLiabilityAmount,
            reservedLiabilityAmount: entry.reservedLiabilityAmount,
            pendingCreditAmount: entry.pendingCreditAmount,
            totalLiabilityAmount: entry.totalLiabilityAmount
          };
        });
      const leafHashes = orderedLeaves.map((leaf) => leaf.leafHash);
      const serializedLeaves = orderedLeaves.map((leaf) => leaf.leafHash).join("\n");

      proofByAsset.set(asset.id, {
        assetId: asset.id,
        liabilityMerkleRoot: buildMerkleRoot(leafHashes),
        liabilityLeafCount: orderedLeaves.length,
        liabilitySetChecksumSha256:
          orderedLeaves.length > 0 ? buildSha256Checksum(serializedLeaves) : null,
        leaves: orderedLeaves
      });
    }

    return proofByAsset;
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
    liabilityProof: LiabilityProofAssetComputation;
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
      liabilityMerkleRoot: input.liabilityProof.liabilityMerkleRoot,
      liabilityLeafCount: input.liabilityProof.liabilityLeafCount,
      liabilitySetChecksumSha256: input.liabilityProof.liabilitySetChecksumSha256,
      issues,
      reserveEvidence: input.reserveEvidence,
      summarySnapshot: {
        assetSymbol: input.asset.symbol,
        totalLiabilityAmount: input.liabilities.totalLiabilityAmount.toString(),
        usableReserveAmount: usableReserveAmount.toString(),
        observedReserveAmount: observedReserveAmount.toString(),
        reserveDeltaAmount: reserveDeltaAmount.toString(),
        reserveRatioBps,
        liabilityMerkleRoot: input.liabilityProof.liabilityMerkleRoot,
        liabilityLeafCount: input.liabilityProof.liabilityLeafCount,
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
        manualResumeRequired: true,
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
        manualResumeRequired: false,
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
      manualResumeRequired: false,
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
    const holdPausedForManualResume =
      currentState?.status === SolvencyPolicyStateStatus.paused &&
      currentState.manualResumeRequired &&
      derivedState.status !== SolvencyPolicyStateStatus.paused;
    const effectiveState = holdPausedForManualResume
      ? {
          status: SolvencyPolicyStateStatus.paused,
          pauseWithdrawalApprovals: true,
          pauseManagedWithdrawalExecution: true,
          pauseLoanFunding: true,
          pauseStakingWrites: true,
          requireManualOperatorReview: true,
          manualResumeRequired: true,
          reasonCode: "manual_resume_required",
          reasonSummary:
            "Latest solvency evidence no longer shows a critical shortfall, but governed manual resume approval is required before sensitive flows resume.",
          metadata: {
            latestDerivedStatus: derivedState.status,
            latestDerivedReasonCode: derivedState.reasonCode,
            latestDerivedReasonSummary: derivedState.reasonSummary
          } satisfies PrismaJsonValue
        }
      : derivedState;
    const invalidatePendingResumeRequests =
      effectiveState.status === SolvencyPolicyStateStatus.paused &&
      !holdPausedForManualResume;
    const resetResumeHistory =
      effectiveState.status === SolvencyPolicyStateStatus.paused &&
      (!currentState ||
        currentState.status !== SolvencyPolicyStateStatus.paused ||
        !currentState.manualResumeRequired);
    const nextState = currentState
      ? await transaction.solvencyPolicyState.update({
          where: {
            environment: this.environment
          },
          data: {
            status: effectiveState.status,
            pauseWithdrawalApprovals: effectiveState.pauseWithdrawalApprovals,
            pauseManagedWithdrawalExecution:
              effectiveState.pauseManagedWithdrawalExecution,
            pauseLoanFunding: effectiveState.pauseLoanFunding,
            pauseStakingWrites: effectiveState.pauseStakingWrites,
            requireManualOperatorReview: effectiveState.requireManualOperatorReview,
            latestSnapshotId: snapshotId,
            triggeredAt:
              effectiveState.status !== SolvencyPolicyStateStatus.normal
                ? currentState.triggeredAt ?? now
                : null,
            clearedAt:
              effectiveState.status === SolvencyPolicyStateStatus.normal ? now : null,
            reasonCode: effectiveState.reasonCode,
            reasonSummary: effectiveState.reasonSummary,
            manualResumeRequired: effectiveState.manualResumeRequired,
            manualResumeRequestedAt: effectiveState.manualResumeRequired
              ? resetResumeHistory || invalidatePendingResumeRequests
                ? null
                : currentState.manualResumeRequestedAt ?? null
              : null,
            manualResumeApprovedAt: effectiveState.manualResumeRequired ? null : null,
            manualResumeApprovedByOperatorId: null,
            manualResumeApprovedByOperatorRole: null,
            metadata: this.toNullableJsonInput(effectiveState.metadata)
          }
        })
      : await transaction.solvencyPolicyState.create({
          data: {
            environment: this.environment,
            status: effectiveState.status,
            pauseWithdrawalApprovals: effectiveState.pauseWithdrawalApprovals,
            pauseManagedWithdrawalExecution:
              effectiveState.pauseManagedWithdrawalExecution,
            pauseLoanFunding: effectiveState.pauseLoanFunding,
            pauseStakingWrites: effectiveState.pauseStakingWrites,
            requireManualOperatorReview: effectiveState.requireManualOperatorReview,
            latestSnapshotId: snapshotId,
            triggeredAt:
              effectiveState.status !== SolvencyPolicyStateStatus.normal ? now : null,
            clearedAt:
              effectiveState.status === SolvencyPolicyStateStatus.normal ? now : null,
            reasonCode: effectiveState.reasonCode,
            reasonSummary: effectiveState.reasonSummary,
            manualResumeRequired: effectiveState.manualResumeRequired,
            manualResumeRequestedAt: null,
            manualResumeApprovedAt: null,
            manualResumeApprovedByOperatorId: null,
            manualResumeApprovedByOperatorRole: null,
            metadata: this.toNullableJsonInput(effectiveState.metadata)
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
      currentState.manualResumeRequired !== nextState.manualResumeRequired ||
      currentState.reasonCode !== nextState.reasonCode ||
      currentState.reasonSummary !== nextState.reasonSummary;

    if (!stateChanged) {
      return;
    }

    if (invalidatePendingResumeRequests) {
      await transaction.solvencyPolicyResumeRequest.updateMany({
        where: {
          environment: this.environment,
          status: SolvencyPolicyResumeRequestStatus.pending_approval
        },
        data: {
          status: SolvencyPolicyResumeRequestStatus.rejected,
          rejectionNote:
            "Superseded by a newer paused solvency snapshot before approval.",
          rejectedAt: now
        }
      });
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
          manualResumeRequired: nextState.manualResumeRequired,
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

  private buildSignedReport(input: {
    snapshotId: string;
    generatedAt: string;
    completedAt: string;
    summary: ReturnType<SolvencyService["buildSnapshotSummary"]>;
    assetComputations: AssetSnapshotComputation[];
    policyState: DerivedPolicyState;
  }): {
    payload: SolvencyReportPayload;
    canonicalPayloadText: string;
    reportHash: string;
    reportChecksumSha256: string;
    signature: string;
    signatureAlgorithm: string;
    signerAddress: string;
  } {
    const payload: SolvencyReportPayload = {
      version: 1,
      snapshotId: input.snapshotId,
      environment: this.environment,
      chainId: this.productChainId,
      snapshotStatus: input.summary.status,
      evidenceFreshness: input.summary.evidenceFreshness,
      generatedAt: input.generatedAt,
      completedAt: input.completedAt,
      totals: {
        totalLiabilityAmount: input.summary.totalLiabilityAmount.toString(),
        totalObservedReserveAmount:
          input.summary.totalObservedReserveAmount.toString(),
        totalUsableReserveAmount:
          input.summary.totalUsableReserveAmount.toString(),
        totalEncumberedReserveAmount:
          input.summary.totalEncumberedReserveAmount.toString(),
        totalReserveDeltaAmount: input.summary.totalReserveDeltaAmount.toString()
      },
      policyState: {
        status: input.policyState.status,
        pauseWithdrawalApprovals: input.policyState.pauseWithdrawalApprovals,
        pauseManagedWithdrawalExecution:
          input.policyState.pauseManagedWithdrawalExecution,
        pauseLoanFunding: input.policyState.pauseLoanFunding,
        pauseStakingWrites: input.policyState.pauseStakingWrites,
        requireManualOperatorReview:
          input.policyState.requireManualOperatorReview,
        manualResumeRequired: input.policyState.manualResumeRequired,
        reasonCode: input.policyState.reasonCode,
        reasonSummary: input.policyState.reasonSummary
      },
      assets: input.assetComputations.map((item) => ({
        assetId: item.asset.id,
        symbol: item.asset.symbol,
        displayName: item.asset.displayName,
        decimals: item.asset.decimals,
        chainId: item.asset.chainId,
        assetType: item.asset.assetType,
        snapshotStatus: item.status,
        evidenceFreshness: item.evidenceFreshness,
        totalLiabilityAmount: item.totalLiabilityAmount.toString(),
        usableReserveAmount: item.usableReserveAmount.toString(),
        observedReserveAmount: item.observedReserveAmount.toString(),
        encumberedReserveAmount: item.encumberedReserveAmount.toString(),
        excludedReserveAmount: item.excludedReserveAmount.toString(),
        reserveDeltaAmount: item.reserveDeltaAmount.toString(),
        reserveRatioBps: item.reserveRatioBps,
        issueCount: item.issues.length,
        liabilityMerkleRoot: item.liabilityMerkleRoot,
        liabilityLeafCount: item.liabilityLeafCount,
        liabilitySetChecksumSha256: item.liabilitySetChecksumSha256
      }))
    };

    return {
      payload,
      ...buildSignedSolvencyReport(payload, this.reportSignerPrivateKey)
    };
  }

  private normalizeOptionalString(value?: string | null): string | null {
    const normalizedValue = value?.trim() ?? null;
    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  }

  private assertCanRequestResume(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.resumeRequestAllowedOperatorRoles,
      "Operator role is not authorized to request solvency policy resume."
    );
  }

  private assertCanApproveResume(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.resumeApproverAllowedOperatorRoles,
      "Operator role is not authorized to approve or reject solvency policy resume."
    );
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
