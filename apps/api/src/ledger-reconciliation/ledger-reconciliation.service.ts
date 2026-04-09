import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  BlockchainTransactionStatus,
  LedgerAccountType,
  LedgerPostingDirection,
  LedgerReconciliationMismatchRecommendedAction,
  LedgerReconciliationMismatchScope,
  LedgerReconciliationMismatchSeverity,
  LedgerReconciliationMismatchStatus,
  LedgerReconciliationScanRunStatus,
  LedgerReconciliationScanTriggerSource,
  PolicyDecision,
  Prisma,
  ReviewCaseStatus,
  ReviewCaseType,
  ReviewCaseEventType,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { classifyDepositSettlementReconciliation } from "../transaction-intents/domain/deposit-settlement-reconciliation";
import { classifyWithdrawalSettlementReconciliation } from "../transaction-intents/domain/withdrawal-settlement-reconciliation";
import { TransactionIntentsService } from "../transaction-intents/transaction-intents.service";
import { WithdrawalIntentsService } from "../transaction-intents/withdrawal-intents.service";
import { GetLedgerReconciliationWorkspaceDto } from "./dto/get-ledger-reconciliation-workspace.dto";
import { ListLedgerReconciliationRunsDto } from "./dto/list-ledger-reconciliation-runs.dto";
import { ListLedgerReconciliationMismatchesDto } from "./dto/list-ledger-reconciliation-mismatches.dto";
import { ScanLedgerReconciliationDto } from "./dto/scan-ledger-reconciliation.dto";

const mismatchInclude = {
  customer: {
    select: {
      id: true,
      email: true,
      supabaseUserId: true,
      firstName: true,
      lastName: true
    }
  },
  customerAccount: {
    select: {
      id: true,
      status: true
    }
  },
  asset: {
    select: {
      id: true,
      symbol: true,
      displayName: true,
      decimals: true,
      chainId: true
    }
  },
  transactionIntent: {
    select: {
      id: true,
      intentType: true,
      status: true,
      policyDecision: true,
      requestedAmount: true,
      settledAmount: true,
      createdAt: true,
      updatedAt: true
    }
  },
  linkedReviewCase: {
    select: {
      id: true,
      type: true,
      status: true,
      assignedOperatorId: true,
      updatedAt: true
    }
  }
} satisfies Prisma.LedgerReconciliationMismatchInclude;

const transactionIntentMismatchInclude = {
  asset: {
    select: {
      id: true,
      symbol: true,
      displayName: true,
      decimals: true,
      chainId: true
    }
  },
  customerAccount: {
    select: {
      id: true,
      customerId: true,
      status: true,
      customer: {
        select: {
          id: true,
          email: true,
          supabaseUserId: true,
          firstName: true,
          lastName: true
        }
      }
    }
  },
  blockchainTransactions: {
    orderBy: {
      createdAt: "desc"
    },
    take: 1,
    select: {
      id: true,
      txHash: true,
      status: true,
      fromAddress: true,
      toAddress: true,
      confirmedAt: true,
      createdAt: true,
      updatedAt: true
    }
  },
  ledgerJournal: {
    select: {
      id: true,
      journalType: true,
      postedAt: true,
      createdAt: true,
      ledgerPostings: {
        select: {
          id: true,
          direction: true,
          amount: true,
          ledgerAccount: {
            select: {
              id: true,
              ledgerKey: true,
              accountType: true,
              customerAccountId: true
            }
          }
        }
      }
    }
  },
  reviewCases: {
    where: {
      type: ReviewCaseType.reconciliation_review,
      status: {
        in: [ReviewCaseStatus.open, ReviewCaseStatus.in_progress]
      }
    },
    orderBy: {
      updatedAt: "desc"
    },
    select: {
      id: true,
      type: true,
      status: true,
      reasonCode: true,
      assignedOperatorId: true,
      updatedAt: true
    }
  }
} satisfies Prisma.TransactionIntentInclude;

type MismatchRecord = Prisma.LedgerReconciliationMismatchGetPayload<{
  include: typeof mismatchInclude;
}>;

type TransactionIntentMismatchRecord = Prisma.TransactionIntentGetPayload<{
  include: typeof transactionIntentMismatchInclude;
}>;

type BalanceProjectionRecord = Prisma.CustomerAssetBalanceGetPayload<{
  include: {
    customerAccount: {
      select: {
        id: true;
        customerId: true;
        status: true;
        customer: {
          select: {
            id: true;
            email: true;
            supabaseUserId: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
    asset: {
      select: {
        id: true;
        symbol: true;
        displayName: true;
        decimals: true;
        chainId: true;
      };
    };
  };
}>;

type LiabilityAccountRecord = Prisma.LedgerAccountGetPayload<{
  include: {
    asset: {
      select: {
        id: true;
        symbol: true;
        displayName: true;
        decimals: true;
        chainId: true;
      };
    };
    customerAccount: {
      select: {
        id: true;
        customerId: true;
        status: true;
        customer: {
          select: {
            id: true;
            email: true;
            supabaseUserId: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
    ledgerPostings: {
      select: {
        direction: true;
        amount: true;
      };
    };
  };
}>;

type ReservedWithdrawalRecord = Prisma.TransactionIntentGetPayload<{
  include: {
    asset: {
      select: {
        id: true;
        symbol: true;
        displayName: true;
        decimals: true;
        chainId: true;
      };
    };
    customerAccount: {
      select: {
        id: true;
        customerId: true;
        status: true;
        customer: {
          select: {
            id: true;
            email: true;
            supabaseUserId: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;

type ReconciliationCandidate = {
  mismatchKey: string;
  scope: LedgerReconciliationMismatchScope;
  severity: LedgerReconciliationMismatchSeverity;
  recommendedAction: LedgerReconciliationMismatchRecommendedAction;
  reasonCode: string;
  summary: string;
  chainId: number;
  customerId: string | null;
  customerAccountId: string | null;
  transactionIntentId: string | null;
  assetId: string | null;
  linkedReviewCaseId: string | null;
  latestSnapshot: Prisma.JsonValue;
};

type MismatchProjection = {
  id: string;
  mismatchKey: string;
  scope: LedgerReconciliationMismatchScope;
  status: LedgerReconciliationMismatchStatus;
  severity: LedgerReconciliationMismatchSeverity;
  recommendedAction: LedgerReconciliationMismatchRecommendedAction;
  reasonCode: string;
  summary: string;
  chainId: number;
  customer: {
    customerId: string | null;
    email: string | null;
    supabaseUserId: string | null;
    firstName: string;
    lastName: string;
  } | null;
  customerAccount: {
    customerAccountId: string | null;
    status: string | null;
  } | null;
  asset: {
    assetId: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  } | null;
  transactionIntent: {
    transactionIntentId: string;
    intentType: string;
    status: string;
    policyDecision: string;
    requestedAmount: string;
    settledAmount: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  linkedReviewCase: {
    reviewCaseId: string;
    type: string;
    status: string;
    assignedOperatorId: string | null;
    updatedAt: string;
  } | null;
  latestSnapshot: Prisma.JsonValue;
  resolutionMetadata: Prisma.JsonValue | null;
  resolutionNote: string | null;
  detectionCount: number;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  resolvedByOperatorId: string | null;
  dismissedAt: string | null;
  dismissedByOperatorId: string | null;
  createdAt: string;
  updatedAt: string;
};

type ScanLedgerReconciliationResult = {
  scannedAt: string;
  createdCount: number;
  reopenedCount: number;
  refreshedCount: number;
  autoResolvedCount: number;
  activeMismatchCount: number;
  mismatches: MismatchProjection[];
};

type ListLedgerReconciliationMismatchesResult = {
  mismatches: MismatchProjection[];
  limit: number;
  totalCount: number;
  summary: {
    byStatus: Array<{
      status: string;
      count: number;
    }>;
    byScope: Array<{
      scope: string;
      count: number;
    }>;
    bySeverity: Array<{
      severity: string;
      count: number;
    }>;
    byRecommendedAction: Array<{
      recommendedAction: string;
      count: number;
    }>;
  };
};

type LedgerReconciliationWorkspaceResult = {
  mismatch: MismatchProjection;
  currentSnapshot: Prisma.JsonValue | null;
  recentAuditEvents: Array<{
    id: string;
    actorType: string;
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: string;
  }>;
};

type ActionResult = {
  mismatch: MismatchProjection;
};

type ScanRunRecord = Prisma.LedgerReconciliationScanRunGetPayload<{}>;

type ScanRunProjection = {
  id: string;
  triggerSource: LedgerReconciliationScanTriggerSource;
  status: LedgerReconciliationScanRunStatus;
  requestedScope: LedgerReconciliationMismatchScope | null;
  customerAccountId: string | null;
  transactionIntentId: string | null;
  triggeredByOperatorId: string | null;
  triggeredByWorkerId: string | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  createdCount: number;
  reopenedCount: number;
  refreshedCount: number;
  autoResolvedCount: number;
  activeMismatchCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  resultSnapshot: Prisma.JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

type TrackedScanResult = {
  scanRun: ScanRunProjection;
  result: ScanLedgerReconciliationResult;
};

type ListLedgerReconciliationRunsResult = {
  runs: ScanRunProjection[];
  limit: number;
  totalCount: number;
};

type ScanTriggerContext =
  | {
      triggerSource: "operator";
      operatorId: string;
      workerId?: never;
    }
  | {
      triggerSource: "worker";
      workerId: string;
      operatorId?: never;
    }
  | {
      triggerSource: "system";
      operatorId?: never;
      workerId?: never;
    };

type ReconciliationActor = {
  actorType: "operator" | "worker" | "system";
  actorId: string | null;
};

@Injectable()
export class LedgerReconciliationService {
  private readonly productChainId: number;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly transactionIntentsService: TransactionIntentsService,
    private readonly withdrawalIntentsService: WithdrawalIntentsService,
    private readonly reviewCasesService: ReviewCasesService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private createZeroDecimal(): Prisma.Decimal {
    return new Prisma.Decimal(0);
  }

  private toDecimal(value: Prisma.Decimal | string | number | null | undefined): Prisma.Decimal {
    if (value instanceof Prisma.Decimal) {
      return value;
    }

    if (value === null || value === undefined) {
      return this.createZeroDecimal();
    }

    return new Prisma.Decimal(value);
  }

  private formatCustomerName(firstName?: string | null, lastName?: string | null): string {
    return [firstName?.trim(), lastName?.trim()].filter(Boolean).join(" ").trim();
  }

  private mapMismatchProjection(record: MismatchRecord): MismatchProjection {
    return {
      id: record.id,
      mismatchKey: record.mismatchKey,
      scope: record.scope,
      status: record.status,
      severity: record.severity,
      recommendedAction: record.recommendedAction,
      reasonCode: record.reasonCode,
      summary: record.summary,
      chainId: record.chainId,
      customer: record.customer
        ? {
            customerId: record.customer.id,
            email: record.customer.email,
            supabaseUserId: record.customer.supabaseUserId,
            firstName: record.customer.firstName ?? "",
            lastName: record.customer.lastName ?? ""
          }
        : null,
      customerAccount: record.customerAccount
        ? {
            customerAccountId: record.customerAccount.id,
            status: record.customerAccount.status
          }
        : null,
      asset: record.asset
        ? {
            assetId: record.asset.id,
            symbol: record.asset.symbol,
            displayName: record.asset.displayName,
            decimals: record.asset.decimals,
            chainId: record.asset.chainId
          }
        : null,
      transactionIntent: record.transactionIntent
        ? {
            transactionIntentId: record.transactionIntent.id,
            intentType: record.transactionIntent.intentType,
            status: record.transactionIntent.status,
            policyDecision: record.transactionIntent.policyDecision,
            requestedAmount: record.transactionIntent.requestedAmount.toString(),
            settledAmount: record.transactionIntent.settledAmount?.toString() ?? null,
            createdAt: record.transactionIntent.createdAt.toISOString(),
            updatedAt: record.transactionIntent.updatedAt.toISOString()
          }
        : null,
      linkedReviewCase: record.linkedReviewCase
        ? {
            reviewCaseId: record.linkedReviewCase.id,
            type: record.linkedReviewCase.type,
            status: record.linkedReviewCase.status,
            assignedOperatorId: record.linkedReviewCase.assignedOperatorId,
            updatedAt: record.linkedReviewCase.updatedAt.toISOString()
          }
        : null,
      latestSnapshot: record.latestSnapshot,
      resolutionMetadata: record.resolutionMetadata ?? null,
      resolutionNote: record.resolutionNote ?? null,
      detectionCount: record.detectionCount,
      firstDetectedAt: record.firstDetectedAt.toISOString(),
      lastDetectedAt: record.lastDetectedAt.toISOString(),
      resolvedAt: record.resolvedAt?.toISOString() ?? null,
      resolvedByOperatorId: record.resolvedByOperatorId ?? null,
      dismissedAt: record.dismissedAt?.toISOString() ?? null,
      dismissedByOperatorId: record.dismissedByOperatorId ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private mapScanRunProjection(record: ScanRunRecord): ScanRunProjection {
    return {
      id: record.id,
      triggerSource: record.triggerSource,
      status: record.status,
      requestedScope: record.requestedScope ?? null,
      customerAccountId: record.customerAccountId ?? null,
      transactionIntentId: record.transactionIntentId ?? null,
      triggeredByOperatorId: record.triggeredByOperatorId ?? null,
      triggeredByWorkerId: record.triggeredByWorkerId ?? null,
      startedAt: record.startedAt.toISOString(),
      completedAt: record.completedAt?.toISOString() ?? null,
      durationMs: record.durationMs ?? null,
      createdCount: record.createdCount,
      reopenedCount: record.reopenedCount,
      refreshedCount: record.refreshedCount,
      autoResolvedCount: record.autoResolvedCount,
      activeMismatchCount: record.activeMismatchCount,
      errorCode: record.errorCode ?? null,
      errorMessage: record.errorMessage ?? null,
      resultSnapshot: record.resultSnapshot ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private buildMismatchWhereInput(
    query:
      | ListLedgerReconciliationMismatchesDto
      | ScanLedgerReconciliationDto
      | { customerAccountId?: string; transactionIntentId?: string; scope?: string }
  ): Prisma.LedgerReconciliationMismatchWhereInput {
    const where: Prisma.LedgerReconciliationMismatchWhereInput = {
      chainId: this.productChainId
    };

    if (query.scope) {
      where.scope = query.scope as LedgerReconciliationMismatchScope;
    }

    if ("status" in query && query.status) {
      where.status = query.status as LedgerReconciliationMismatchStatus;
    }

    if ("recommendedAction" in query && query.recommendedAction) {
      where.recommendedAction =
        query.recommendedAction as LedgerReconciliationMismatchRecommendedAction;
    }

    if ("reasonCode" in query && query.reasonCode?.trim()) {
      where.reasonCode = query.reasonCode.trim();
    }

    if (query.customerAccountId?.trim()) {
      where.customerAccountId = query.customerAccountId.trim();
    }

    if (query.transactionIntentId?.trim()) {
      where.transactionIntentId = query.transactionIntentId.trim();
    }

    if ("email" in query && query.email?.trim()) {
      where.customer = {
        is: {
          email: query.email.trim().toLowerCase()
        }
      };
    }

    return where;
  }

  private buildScanRunWhereInput(
    query: ListLedgerReconciliationRunsDto
  ): Prisma.LedgerReconciliationScanRunWhereInput {
    const where: Prisma.LedgerReconciliationScanRunWhereInput = {};

    if (query.status) {
      where.status = query.status as LedgerReconciliationScanRunStatus;
    }

    if (query.triggerSource) {
      where.triggerSource =
        query.triggerSource as LedgerReconciliationScanTriggerSource;
    }

    if (query.scope) {
      where.requestedScope = query.scope as LedgerReconciliationMismatchScope;
    }

    if (query.customerAccountId?.trim()) {
      where.customerAccountId = query.customerAccountId.trim();
    }

    if (query.transactionIntentId?.trim()) {
      where.transactionIntentId = query.transactionIntentId.trim();
    }

    if (query.workerId?.trim()) {
      where.triggeredByWorkerId = query.workerId.trim();
    }

    return where;
  }

  private ensureSupportedScanQuery(query: ScanLedgerReconciliationDto): void {
    if (
      query.scope === "customer_balance" &&
      query.transactionIntentId?.trim()
    ) {
      throw new BadRequestException(
        "transactionIntentId cannot be combined with customer_balance scope."
      );
    }
  }

  private async appendMismatchAuditEvent(
    actorType: "operator" | "worker" | "system",
    actorId: string | null,
    action: string,
    mismatch: {
      id: string;
      customerId: string | null;
      customerAccountId: string | null;
      transactionIntentId: string | null;
      assetId: string | null;
      reasonCode: string;
      scope: LedgerReconciliationMismatchScope;
      recommendedAction: LedgerReconciliationMismatchRecommendedAction;
    },
    metadata: Record<string, unknown> | null
  ): Promise<void> {
    await this.prismaService.auditEvent.create({
      data: {
        customerId: mismatch.customerId,
        actorType,
        actorId,
        action,
        targetType: "LedgerReconciliationMismatch",
        targetId: mismatch.id,
        metadata: {
          customerAccountId: mismatch.customerAccountId,
          transactionIntentId: mismatch.transactionIntentId,
          assetId: mismatch.assetId,
          scope: mismatch.scope,
          reasonCode: mismatch.reasonCode,
          recommendedAction: mismatch.recommendedAction,
          ...(metadata ?? {})
        } as Prisma.InputJsonValue
      }
    });
  }

  private async resolveLinkedReviewCaseForResolvedMismatch(
    transaction: Prisma.TransactionClient,
    mismatch: MismatchRecord,
    actor: ReconciliationActor
  ): Promise<string | null> {
    const linkedReviewCase = mismatch.linkedReviewCase;

    if (
      !linkedReviewCase ||
      linkedReviewCase.type !== ReviewCaseType.reconciliation_review ||
      (linkedReviewCase.status !== ReviewCaseStatus.open &&
        linkedReviewCase.status !== ReviewCaseStatus.in_progress)
    ) {
      return null;
    }

    const resolvedAt = new Date();
    const resolutionNote =
      "Automatically resolved after the linked ledger reconciliation mismatch cleared.";

    await transaction.reviewCase.update({
      where: {
        id: linkedReviewCase.id
      },
      data: {
        status: ReviewCaseStatus.resolved,
        resolvedAt,
        assignedOperatorId:
          linkedReviewCase.assignedOperatorId ??
          (actor.actorType === "operator" ? actor.actorId : null)
      }
    });

    await transaction.reviewCaseEvent.create({
      data: {
        reviewCaseId: linkedReviewCase.id,
        actorType: actor.actorType,
        actorId: actor.actorId,
        eventType: ReviewCaseEventType.resolved,
        note: resolutionNote,
        metadata: {
          previousStatus: linkedReviewCase.status,
          newStatus: ReviewCaseStatus.resolved,
          resolutionSource: "ledger_reconciliation_scan",
          mismatchId: mismatch.id,
          mismatchKey: mismatch.mismatchKey
        } as Prisma.InputJsonValue
      }
    });

    await transaction.auditEvent.create({
      data: {
        customerId: mismatch.customerId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "review_case.resolved",
        targetType: "ReviewCase",
        targetId: linkedReviewCase.id,
        metadata: {
          previousStatus: linkedReviewCase.status,
          newStatus: ReviewCaseStatus.resolved,
          resolutionSource: "ledger_reconciliation_scan",
          reviewCaseType: linkedReviewCase.type,
          transactionIntentId: mismatch.transactionIntentId,
          customerAccountId: mismatch.customerAccountId,
          mismatchId: mismatch.id,
          mismatchKey: mismatch.mismatchKey
        } as Prisma.InputJsonValue
      }
    });

    return linkedReviewCase.id;
  }

  private async buildTransactionIntentCandidates(
    query: ScanLedgerReconciliationDto
  ): Promise<ReconciliationCandidate[]> {
    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        chainId: this.productChainId,
        intentType: {
          in: [TransactionIntentType.deposit, TransactionIntentType.withdrawal]
        },
        status: {
          in: [
            TransactionIntentStatus.broadcast,
            TransactionIntentStatus.confirmed,
            TransactionIntentStatus.settled
          ]
        },
        ...(query.customerAccountId?.trim()
          ? {
              customerAccountId: query.customerAccountId.trim()
            }
          : {}),
        ...(query.transactionIntentId?.trim()
          ? {
              id: query.transactionIntentId.trim()
            }
          : {})
      },
      orderBy: {
        updatedAt: "desc"
      },
      include: transactionIntentMismatchInclude
    });

    return intents.flatMap((intent) => {
      if (!intent.customerAccount) {
        return [];
      }

      const latestBlockchainTransaction = intent.blockchainTransactions[0] ?? null;
      const reconciliation =
        intent.intentType === TransactionIntentType.deposit
          ? classifyDepositSettlementReconciliation({
              status: intent.status,
              policyDecision: intent.policyDecision,
              requestedAmount: intent.requestedAmount.toString(),
              settledAmount: intent.settledAmount?.toString() ?? null,
              latestBlockchainStatus: latestBlockchainTransaction?.status ?? null,
              hasLedgerJournal: Boolean(intent.ledgerJournal)
            })
          : classifyWithdrawalSettlementReconciliation({
              status: intent.status,
              policyDecision: intent.policyDecision,
              requestedAmount: intent.requestedAmount.toString(),
              settledAmount: intent.settledAmount?.toString() ?? null,
              latestBlockchainStatus: latestBlockchainTransaction?.status ?? null,
              hasLedgerJournal: Boolean(intent.ledgerJournal)
            });

      if (
        reconciliation.state === "waiting_for_confirmation" ||
        reconciliation.state === "healthy_settled"
      ) {
        return [];
      }

      const linkedReviewCase =
        intent.reviewCases.find(
          (reviewCase) => reviewCase.reasonCode === reconciliation.reasonCode
        ) ?? intent.reviewCases[0] ?? null;

      const recommendedAction =
        reconciliation.replayAction === "confirm"
          ? LedgerReconciliationMismatchRecommendedAction.replay_confirm
          : reconciliation.replayAction === "settle"
            ? LedgerReconciliationMismatchRecommendedAction.replay_settle
            : linkedReviewCase
              ? LedgerReconciliationMismatchRecommendedAction.none
              : LedgerReconciliationMismatchRecommendedAction.open_review_case;

      return [
        {
          mismatchKey: `transaction_intent:${intent.id}`,
          scope: LedgerReconciliationMismatchScope.transaction_intent,
          severity: reconciliation.actionable
            ? LedgerReconciliationMismatchSeverity.warning
            : LedgerReconciliationMismatchSeverity.critical,
          recommendedAction,
          reasonCode: reconciliation.reasonCode,
          summary:
            `${intent.intentType} intent ${intent.id} requires reconciliation: ` +
            reconciliation.reason,
          chainId: intent.chainId,
          customerId: intent.customerAccount.customer.id,
          customerAccountId: intent.customerAccount.id,
          transactionIntentId: intent.id,
          assetId: intent.asset.id,
          linkedReviewCaseId: linkedReviewCase?.id ?? null,
          latestSnapshot: {
            scope: LedgerReconciliationMismatchScope.transaction_intent,
            intent: {
              id: intent.id,
              intentType: intent.intentType,
              status: intent.status,
              policyDecision: intent.policyDecision,
              requestedAmount: intent.requestedAmount.toString(),
              settledAmount: intent.settledAmount?.toString() ?? null,
              createdAt: intent.createdAt.toISOString(),
              updatedAt: intent.updatedAt.toISOString()
            },
            customer: {
              customerId: intent.customerAccount.customer.id,
              customerAccountId: intent.customerAccount.id,
              email: intent.customerAccount.customer.email,
              supabaseUserId: intent.customerAccount.customer.supabaseUserId,
              firstName: intent.customerAccount.customer.firstName ?? "",
              lastName: intent.customerAccount.customer.lastName ?? ""
            },
            asset: {
              id: intent.asset.id,
              symbol: intent.asset.symbol,
              displayName: intent.asset.displayName,
              decimals: intent.asset.decimals,
              chainId: intent.asset.chainId
            },
            latestBlockchainTransaction: latestBlockchainTransaction
              ? {
                  id: latestBlockchainTransaction.id,
                  txHash: latestBlockchainTransaction.txHash,
                  status: latestBlockchainTransaction.status,
                  fromAddress: latestBlockchainTransaction.fromAddress,
                  toAddress: latestBlockchainTransaction.toAddress,
                  confirmedAt:
                    latestBlockchainTransaction.confirmedAt?.toISOString() ?? null,
                  createdAt: latestBlockchainTransaction.createdAt.toISOString(),
                  updatedAt: latestBlockchainTransaction.updatedAt.toISOString()
                }
              : null,
            ledgerJournal: intent.ledgerJournal
              ? {
                  id: intent.ledgerJournal.id,
                  journalType: intent.ledgerJournal.journalType,
                  postedAt: intent.ledgerJournal.postedAt.toISOString(),
                  createdAt: intent.ledgerJournal.createdAt.toISOString(),
                  ledgerPostings: intent.ledgerJournal.ledgerPostings.map((posting) => ({
                    id: posting.id,
                    direction: posting.direction,
                    amount: posting.amount.toString(),
                    ledgerAccountId: posting.ledgerAccount.id,
                    ledgerKey: posting.ledgerAccount.ledgerKey,
                    ledgerAccountType: posting.ledgerAccount.accountType,
                    ledgerAccountCustomerAccountId:
                      posting.ledgerAccount.customerAccountId
                  }))
                }
              : null,
            linkedReviewCase: linkedReviewCase
              ? {
                  id: linkedReviewCase.id,
                  status: linkedReviewCase.status,
                  type: linkedReviewCase.type,
                  reasonCode: linkedReviewCase.reasonCode,
                  assignedOperatorId: linkedReviewCase.assignedOperatorId,
                  updatedAt: linkedReviewCase.updatedAt.toISOString()
                }
              : null,
            reconciliation
          } as Prisma.JsonValue
        }
      ];
    });
  }

  private async buildBalanceCandidates(
    query: ScanLedgerReconciliationDto
  ): Promise<ReconciliationCandidate[]> {
    const accountFilter = query.customerAccountId?.trim();
    const balances = await this.prismaService.customerAssetBalance.findMany({
      where: {
        asset: {
          chainId: this.productChainId
        },
        ...(accountFilter
          ? {
              customerAccountId: accountFilter
            }
          : {})
      },
      include: {
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            status: true,
            customer: {
              select: {
                id: true,
                email: true,
                supabaseUserId: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        }
      }
    });

    const liabilityAccounts = await this.prismaService.ledgerAccount.findMany({
      where: {
        accountType: LedgerAccountType.customer_asset_liability,
        chainId: this.productChainId,
        ...(accountFilter
          ? {
              customerAccountId: accountFilter
            }
          : {})
      },
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            status: true,
            customer: {
              select: {
                id: true,
                email: true,
                supabaseUserId: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        ledgerPostings: {
          select: {
            direction: true,
            amount: true
          }
        }
      }
    });

    const reservedWithdrawals = await this.prismaService.transactionIntent.findMany({
      where: {
        chainId: this.productChainId,
        intentType: TransactionIntentType.withdrawal,
        status: {
          in: [
            TransactionIntentStatus.requested,
            TransactionIntentStatus.approved,
            TransactionIntentStatus.queued,
            TransactionIntentStatus.broadcast,
            TransactionIntentStatus.confirmed
          ]
        },
        ...(accountFilter
          ? {
              customerAccountId: accountFilter
            }
          : {})
      },
      include: {
        asset: {
          select: {
            id: true,
            symbol: true,
            displayName: true,
            decimals: true,
            chainId: true
          }
        },
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            status: true,
            customer: {
              select: {
                id: true,
                email: true,
                supabaseUserId: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    type BalanceKeyEntry = {
      balance: BalanceProjectionRecord | null;
      asset: {
        id: string;
        symbol: string;
        displayName: string;
        decimals: number;
        chainId: number;
      };
      customerAccount: {
        id: string;
        customerId: string;
        status: string;
        customer: {
          id: string;
          email: string;
          supabaseUserId: string;
          firstName: string | null;
          lastName: string | null;
        };
      };
      liabilityAmount: Prisma.Decimal;
      reservedAmount: Prisma.Decimal;
      reservedIntentIds: string[];
    };

    const byKey = new Map<string, BalanceKeyEntry>();

    const readKey = (customerAccountId: string, assetId: string) =>
      `${customerAccountId}:${assetId}`;

    const ensureEntry = (
      customerAccount: BalanceKeyEntry["customerAccount"],
      asset: BalanceKeyEntry["asset"]
    ): BalanceKeyEntry => {
      const key = readKey(customerAccount.id, asset.id);
      const existing = byKey.get(key);

      if (existing) {
        return existing;
      }

      const created: BalanceKeyEntry = {
        balance: null,
        asset,
        customerAccount,
        liabilityAmount: this.createZeroDecimal(),
        reservedAmount: this.createZeroDecimal(),
        reservedIntentIds: []
      };

      byKey.set(key, created);
      return created;
    };

    for (const balance of balances) {
      const entry = ensureEntry(
        balance.customerAccount,
        balance.asset
      );
      entry.balance = balance;
    }

    for (const account of liabilityAccounts) {
      if (!account.customerAccountId || !account.customerAccount) {
        continue;
      }

      const entry = ensureEntry(account.customerAccount, account.asset);
      const liabilityAmount = account.ledgerPostings.reduce((current, posting) => {
        const amount = this.toDecimal(posting.amount);

        return posting.direction === LedgerPostingDirection.credit
          ? current.plus(amount)
          : current.minus(amount);
      }, this.createZeroDecimal());

      entry.liabilityAmount = entry.liabilityAmount.plus(liabilityAmount);
    }

    for (const intent of reservedWithdrawals) {
      if (!intent.customerAccount) {
        continue;
      }

      const entry = ensureEntry(intent.customerAccount, intent.asset);
      entry.reservedAmount = entry.reservedAmount.plus(intent.requestedAmount);
      entry.reservedIntentIds.push(intent.id);
    }

    return Array.from(byKey.values()).flatMap((entry) => {
      const actualAvailable = this.toDecimal(entry.balance?.availableBalance ?? 0);
      const actualPending = this.toDecimal(entry.balance?.pendingBalance ?? 0);
      const expectedPending = entry.reservedAmount;
      const expectedAvailable = entry.liabilityAmount.minus(expectedPending);

      const hasMeaningfulExpectedBalance =
        !entry.liabilityAmount.eq(0) || !entry.reservedAmount.eq(0);
      const hasActualBalance = Boolean(entry.balance);

      if (
        !hasMeaningfulExpectedBalance &&
        (!hasActualBalance ||
          (actualAvailable.eq(0) && actualPending.eq(0)))
      ) {
        return [];
      }

      const impossibleExpectedState =
        expectedAvailable.lessThan(0) || expectedPending.lessThan(0);
      const expectedMatchesActual =
        actualAvailable.eq(expectedAvailable) && actualPending.eq(expectedPending);

      if (!impossibleExpectedState && expectedMatchesActual) {
        return [];
      }

      const recommendedAction = impossibleExpectedState
        ? LedgerReconciliationMismatchRecommendedAction.open_review_case
        : LedgerReconciliationMismatchRecommendedAction.repair_customer_balance;

      const reasonCode = impossibleExpectedState
        ? "customer_asset_balance_projection_unrepairable"
        : "customer_asset_balance_projection_mismatch";

      const summary = impossibleExpectedState
        ? `Customer balance projection for ${entry.asset.symbol} on account ${entry.customerAccount.id} cannot be repaired safely because the derived available balance would be negative.`
        : `Customer balance projection for ${entry.asset.symbol} on account ${entry.customerAccount.id} diverges from ledger liability and reserved withdrawal state.`;

      return [
        {
          mismatchKey: `customer_balance:${entry.customerAccount.id}:${entry.asset.id}`,
          scope: LedgerReconciliationMismatchScope.customer_balance,
          severity: LedgerReconciliationMismatchSeverity.critical,
          recommendedAction,
          reasonCode,
          summary,
          chainId: entry.asset.chainId,
          customerId: entry.customerAccount.customer.id,
          customerAccountId: entry.customerAccount.id,
          transactionIntentId: null,
          assetId: entry.asset.id,
          linkedReviewCaseId: null,
          latestSnapshot: {
            scope: LedgerReconciliationMismatchScope.customer_balance,
            customer: {
              customerId: entry.customerAccount.customer.id,
              customerAccountId: entry.customerAccount.id,
              email: entry.customerAccount.customer.email,
              supabaseUserId: entry.customerAccount.customer.supabaseUserId,
              firstName: entry.customerAccount.customer.firstName ?? "",
              lastName: entry.customerAccount.customer.lastName ?? "",
              accountStatus: entry.customerAccount.status
            },
            asset: entry.asset,
            actualBalance: {
              exists: hasActualBalance,
              availableBalance: actualAvailable.toString(),
              pendingBalance: actualPending.toString()
            },
            expectedBalance: {
              availableBalance: expectedAvailable.toString(),
              pendingBalance: expectedPending.toString()
            },
            ledgerLiabilityAmount: entry.liabilityAmount.toString(),
            reservedWithdrawalAmount: entry.reservedAmount.toString(),
            reservedWithdrawalIntentIds: entry.reservedIntentIds
          } as Prisma.JsonValue
        }
      ];
    });
  }

  private async findMismatchById(mismatchId: string): Promise<MismatchRecord> {
    const mismatch = await this.prismaService.ledgerReconciliationMismatch.findUnique({
      where: {
        id: mismatchId
      },
      include: mismatchInclude
    });

    if (!mismatch) {
      throw new NotFoundException("Ledger reconciliation mismatch not found.");
    }

    return mismatch;
  }

  private async fetchOpenMismatchByKey(
    mismatchKey: string
  ): Promise<MismatchRecord | null> {
    return this.prismaService.ledgerReconciliationMismatch.findUnique({
      where: {
        mismatchKey
      },
      include: mismatchInclude
    });
  }

  private async refreshMismatchAfterTargetedScan(
    query: ScanLedgerReconciliationDto,
    mismatchKey: string,
    operatorId: string
  ): Promise<MismatchRecord> {
    await this.scanMismatches(query, {
      actorType: "operator",
      actorId: operatorId
    });
    const refreshed = await this.fetchOpenMismatchByKey(mismatchKey);

    if (refreshed) {
      return refreshed;
    }

    const resolved = await this.prismaService.ledgerReconciliationMismatch.findFirst({
      where: {
        mismatchKey
      },
      orderBy: {
        updatedAt: "desc"
      },
      include: mismatchInclude
    });

    if (!resolved) {
      throw new NotFoundException("Ledger reconciliation mismatch not found.");
    }

    return resolved;
  }

  async scanMismatches(
    query: ScanLedgerReconciliationDto,
    actor: ReconciliationActor
  ): Promise<ScanLedgerReconciliationResult> {
    this.ensureSupportedScanQuery(query);

    const candidates: ReconciliationCandidate[] = [];

    if (!query.scope || query.scope === "transaction_intent") {
      candidates.push(...(await this.buildTransactionIntentCandidates(query)));
    }

    if (!query.scope || query.scope === "customer_balance") {
      candidates.push(...(await this.buildBalanceCandidates(query)));
    }

    const existingMismatches = await this.prismaService.ledgerReconciliationMismatch.findMany({
      where: this.buildMismatchWhereInput(query),
      include: mismatchInclude
    });
    const existingByKey = new Map(
      existingMismatches.map((mismatch) => [mismatch.mismatchKey, mismatch])
    );
    const candidateKeys = new Set(candidates.map((candidate) => candidate.mismatchKey));

    let createdCount = 0;
    let reopenedCount = 0;
    let refreshedCount = 0;
    let autoResolvedCount = 0;

    for (const candidate of candidates) {
      const existing = existingByKey.get(candidate.mismatchKey);

      if (!existing) {
        const created = await this.prismaService.ledgerReconciliationMismatch.create({
          data: {
            mismatchKey: candidate.mismatchKey,
            scope: candidate.scope,
            status: LedgerReconciliationMismatchStatus.open,
            severity: candidate.severity,
            recommendedAction: candidate.recommendedAction,
            reasonCode: candidate.reasonCode,
            summary: candidate.summary,
            chainId: candidate.chainId,
            customerId: candidate.customerId,
            customerAccountId: candidate.customerAccountId,
            transactionIntentId: candidate.transactionIntentId,
            assetId: candidate.assetId,
            linkedReviewCaseId: candidate.linkedReviewCaseId,
            latestSnapshot: candidate.latestSnapshot as Prisma.InputJsonValue
          },
          include: mismatchInclude
        });

        createdCount += 1;
        existingByKey.set(candidate.mismatchKey, created);

        await this.appendMismatchAuditEvent(
          actor.actorType,
          actor.actorId,
          "ledger_reconciliation.mismatch.opened",
          {
            id: created.id,
            customerId: created.customerId ?? null,
            customerAccountId: created.customerAccountId ?? null,
            transactionIntentId: created.transactionIntentId ?? null,
            assetId: created.assetId ?? null,
            reasonCode: created.reasonCode,
            scope: created.scope,
            recommendedAction: created.recommendedAction
          },
          {
            mismatchKey: created.mismatchKey
          }
        );

        continue;
      }

      const reopened = existing.status !== LedgerReconciliationMismatchStatus.open;
      const hasActiveLinkedReviewCase =
        existing.linkedReviewCase?.status === ReviewCaseStatus.open ||
        existing.linkedReviewCase?.status === ReviewCaseStatus.in_progress;
      const preservedLinkedReviewCaseId =
        candidate.linkedReviewCaseId ??
        (hasActiveLinkedReviewCase ? existing.linkedReviewCase?.id ?? null : null);
      const recommendedAction =
        candidate.recommendedAction ===
          LedgerReconciliationMismatchRecommendedAction.open_review_case &&
        preservedLinkedReviewCaseId
          ? LedgerReconciliationMismatchRecommendedAction.none
          : candidate.recommendedAction;

      const updated = await this.prismaService.ledgerReconciliationMismatch.update({
        where: {
          id: existing.id
        },
        data: {
          status: LedgerReconciliationMismatchStatus.open,
          severity: candidate.severity,
          recommendedAction,
          reasonCode: candidate.reasonCode,
          summary: candidate.summary,
          customerId: candidate.customerId,
          customerAccountId: candidate.customerAccountId,
          transactionIntentId: candidate.transactionIntentId,
          assetId: candidate.assetId,
          linkedReviewCaseId: preservedLinkedReviewCaseId,
          latestSnapshot: candidate.latestSnapshot as Prisma.InputJsonValue,
          detectionCount: {
            increment: 1
          },
          lastDetectedAt: new Date(),
          resolvedAt: null,
          resolvedByOperatorId: null,
          dismissedAt: null,
          dismissedByOperatorId: null,
          resolutionMetadata: Prisma.JsonNull,
          resolutionNote: null
        },
        include: mismatchInclude
      });

      if (reopened) {
        reopenedCount += 1;

        await this.appendMismatchAuditEvent(
          actor.actorType,
          actor.actorId,
          "ledger_reconciliation.mismatch.reopened",
          {
            id: updated.id,
            customerId: updated.customerId ?? null,
            customerAccountId: updated.customerAccountId ?? null,
            transactionIntentId: updated.transactionIntentId ?? null,
            assetId: updated.assetId ?? null,
            reasonCode: updated.reasonCode,
            scope: updated.scope,
            recommendedAction: updated.recommendedAction
          },
          {
            mismatchKey: updated.mismatchKey
          }
        );
      } else {
        refreshedCount += 1;
      }
    }

    for (const existing of existingMismatches) {
      if (
        existing.status !== LedgerReconciliationMismatchStatus.open ||
        candidateKeys.has(existing.mismatchKey)
      ) {
        continue;
      }

      const resolved = await this.prismaService.$transaction(
        async (transaction) => {
          const updatedMismatch =
            await transaction.ledgerReconciliationMismatch.update({
              where: {
                id: existing.id
              },
              data: {
                status: LedgerReconciliationMismatchStatus.resolved,
                recommendedAction: LedgerReconciliationMismatchRecommendedAction.none,
                resolvedAt: new Date(),
                resolvedByOperatorId: null,
                resolutionNote: "Automatically resolved by reconciliation scan.",
                resolutionMetadata: {
                  resolvedBy: "system_reconciliation_scan"
                } as Prisma.InputJsonValue
              },
              include: mismatchInclude
            });

          const resolvedReviewCaseId =
            await this.resolveLinkedReviewCaseForResolvedMismatch(
              transaction,
              updatedMismatch,
              actor
            );

          await this.appendMismatchAuditEvent(
            actor.actorType,
            actor.actorId,
            "ledger_reconciliation.mismatch.resolved_by_scan",
            {
              id: updatedMismatch.id,
              customerId: updatedMismatch.customerId ?? null,
              customerAccountId: updatedMismatch.customerAccountId ?? null,
              transactionIntentId: updatedMismatch.transactionIntentId ?? null,
              assetId: updatedMismatch.assetId ?? null,
              reasonCode: updatedMismatch.reasonCode,
              scope: updatedMismatch.scope,
              recommendedAction: updatedMismatch.recommendedAction
            },
            resolvedReviewCaseId
              ? {
                  resolvedReviewCaseId
                }
              : null
          );

          return updatedMismatch;
        }
      );

      autoResolvedCount += 1;
    }

    const activeMismatches = await this.prismaService.ledgerReconciliationMismatch.findMany({
      where: {
        ...this.buildMismatchWhereInput(query),
        status: LedgerReconciliationMismatchStatus.open
      },
      orderBy: {
        updatedAt: "desc"
      },
      include: mismatchInclude
    });

    return {
      scannedAt: new Date().toISOString(),
      createdCount,
      reopenedCount,
      refreshedCount,
      autoResolvedCount,
      activeMismatchCount: activeMismatches.length,
      mismatches: activeMismatches.map((mismatch) =>
        this.mapMismatchProjection(mismatch)
      )
    };
  }

  async runTrackedScan(
    query: ScanLedgerReconciliationDto,
    trigger: ScanTriggerContext
  ): Promise<TrackedScanResult> {
    const startedAt = new Date();
    const scanActorId =
      trigger.triggerSource === "operator"
        ? trigger.operatorId
        : trigger.triggerSource === "worker"
          ? trigger.workerId
          : "system-reconciliation";

    const run = await this.prismaService.ledgerReconciliationScanRun.create({
      data: {
        triggerSource:
          trigger.triggerSource as LedgerReconciliationScanTriggerSource,
        status: LedgerReconciliationScanRunStatus.running,
        requestedScope: query.scope
          ? (query.scope as LedgerReconciliationMismatchScope)
          : null,
        customerAccountId: query.customerAccountId?.trim() || null,
        transactionIntentId: query.transactionIntentId?.trim() || null,
        triggeredByOperatorId: trigger.triggerSource === "operator" ? trigger.operatorId : null,
        triggeredByWorkerId: trigger.triggerSource === "worker" ? trigger.workerId : null
      }
    });

    try {
      const result = await this.scanMismatches(query, {
        actorType: trigger.triggerSource,
        actorId: scanActorId
      });

      const completedAt = new Date();
      const updatedRun = await this.prismaService.ledgerReconciliationScanRun.update({
        where: {
          id: run.id
        },
        data: {
          status: LedgerReconciliationScanRunStatus.succeeded,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          createdCount: result.createdCount,
          reopenedCount: result.reopenedCount,
          refreshedCount: result.refreshedCount,
          autoResolvedCount: result.autoResolvedCount,
          activeMismatchCount: result.activeMismatchCount,
          resultSnapshot: result as Prisma.InputJsonValue,
          errorCode: null,
          errorMessage: null
        }
      });

      return {
        scanRun: this.mapScanRunProjection(updatedRun),
        result
      };
    } catch (error) {
      const completedAt = new Date();
      const errorMessage =
        error instanceof Error ? error.message : "Ledger reconciliation scan failed.";
      const errorCode =
        error instanceof BadRequestException
          ? "bad_request"
          : error instanceof ConflictException
            ? "conflict"
            : error instanceof NotFoundException
              ? "not_found"
              : "scan_failed";

      const failedRun = await this.prismaService.ledgerReconciliationScanRun.update({
        where: {
          id: run.id
        },
        data: {
          status: LedgerReconciliationScanRunStatus.failed,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          errorCode,
          errorMessage
        }
      });

      await this.prismaService.auditEvent.create({
        data: {
          actorType:
            trigger.triggerSource === "worker"
              ? "worker"
              : trigger.triggerSource,
          actorId:
            trigger.triggerSource === "operator"
              ? trigger.operatorId
              : trigger.triggerSource === "worker"
                ? trigger.workerId
                : null,
          action: "ledger_reconciliation.scan.failed",
          targetType: "LedgerReconciliationScanRun",
          targetId: failedRun.id,
          metadata: {
            requestedScope: query.scope ?? null,
            customerAccountId: query.customerAccountId?.trim() ?? null,
            transactionIntentId: query.transactionIntentId?.trim() ?? null,
            errorCode,
            errorMessage
          } as Prisma.InputJsonValue
        }
      });

      throw error;
    }
  }

  async listMismatches(
    query: ListLedgerReconciliationMismatchesDto
  ): Promise<ListLedgerReconciliationMismatchesResult> {
    const limit = query.limit ?? 20;
    const where = this.buildMismatchWhereInput(query);

    const [mismatches, totalCount, byStatus, byScope, bySeverity, byRecommendedAction] =
      await Promise.all([
        this.prismaService.ledgerReconciliationMismatch.findMany({
          where,
          orderBy: {
            updatedAt: "desc"
          },
          take: limit,
          include: mismatchInclude
        }),
        this.prismaService.ledgerReconciliationMismatch.count({
          where
        }),
        this.prismaService.ledgerReconciliationMismatch.groupBy({
          by: ["status"],
          where,
          _count: {
            _all: true
          }
        }),
        this.prismaService.ledgerReconciliationMismatch.groupBy({
          by: ["scope"],
          where,
          _count: {
            _all: true
          }
        }),
        this.prismaService.ledgerReconciliationMismatch.groupBy({
          by: ["severity"],
          where,
          _count: {
            _all: true
          }
        }),
        this.prismaService.ledgerReconciliationMismatch.groupBy({
          by: ["recommendedAction"],
          where,
          _count: {
            _all: true
          }
        })
      ]);

    return {
      mismatches: mismatches.map((mismatch) => this.mapMismatchProjection(mismatch)),
      limit,
      totalCount,
      summary: {
        byStatus: byStatus.map((item) => ({
          status: item.status,
          count: item._count._all
        })),
        byScope: byScope.map((item) => ({
          scope: item.scope,
          count: item._count._all
        })),
        bySeverity: bySeverity.map((item) => ({
          severity: item.severity,
          count: item._count._all
        })),
        byRecommendedAction: byRecommendedAction.map((item) => ({
          recommendedAction: item.recommendedAction,
          count: item._count._all
        }))
      }
    };
  }

  async listScanRuns(
    query: ListLedgerReconciliationRunsDto
  ): Promise<ListLedgerReconciliationRunsResult> {
    const limit = query.limit ?? 20;
    const where = this.buildScanRunWhereInput(query);

    const [runs, totalCount] = await Promise.all([
      this.prismaService.ledgerReconciliationScanRun.findMany({
        where,
        orderBy: {
          startedAt: "desc"
        },
        take: limit
      }),
      this.prismaService.ledgerReconciliationScanRun.count({
        where
      })
    ]);

    return {
      runs: runs.map((run) => this.mapScanRunProjection(run)),
      limit,
      totalCount
    };
  }

  async getMismatchWorkspace(
    mismatchId: string,
    query: GetLedgerReconciliationWorkspaceDto
  ): Promise<LedgerReconciliationWorkspaceResult> {
    const mismatch = await this.findMismatchById(mismatchId);
    const recentAuditLimit = query.recentAuditLimit ?? 20;
    let currentSnapshot: Prisma.JsonValue | null = null;

    if (mismatch.scope === LedgerReconciliationMismatchScope.transaction_intent) {
      const current = await this.buildTransactionIntentCandidates({
        scope: "transaction_intent",
        transactionIntentId: mismatch.transactionIntentId ?? undefined
      });
      currentSnapshot = current[0]?.latestSnapshot ?? null;
    } else if (mismatch.customerAccountId && mismatch.assetId) {
      const current = await this.buildBalanceCandidates({
        scope: "customer_balance",
        customerAccountId: mismatch.customerAccountId
      });
      currentSnapshot =
        current.find((candidate) => candidate.mismatchKey === mismatch.mismatchKey)
          ?.latestSnapshot ?? null;
    }

    const recentAuditEvents = await this.prismaService.auditEvent.findMany({
      where: {
        OR: [
          {
            targetType: "LedgerReconciliationMismatch",
            targetId: mismatch.id
          },
          ...(mismatch.transactionIntentId
            ? [
                {
                  targetType: "TransactionIntent",
                  targetId: mismatch.transactionIntentId
                } satisfies Prisma.AuditEventWhereInput
              ]
            : []),
          ...(mismatch.linkedReviewCaseId
            ? [
                {
                  targetType: "ReviewCase",
                  targetId: mismatch.linkedReviewCaseId
                } satisfies Prisma.AuditEventWhereInput
              ]
            : [])
        ]
      },
      orderBy: {
        createdAt: "desc"
      },
      take: recentAuditLimit
    });

    return {
      mismatch: this.mapMismatchProjection(mismatch),
      currentSnapshot,
      recentAuditEvents: recentAuditEvents.map((event) => ({
        id: event.id,
        actorType: event.actorType,
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata ?? null,
        createdAt: event.createdAt.toISOString()
      }))
    };
  }

  async replayConfirmMismatch(
    mismatchId: string,
    operatorId: string,
    note: string | null
  ): Promise<ActionResult> {
    const mismatch = await this.findMismatchById(mismatchId);

    if (
      mismatch.recommendedAction !==
      LedgerReconciliationMismatchRecommendedAction.replay_confirm
    ) {
      throw new ConflictException(
        "Mismatch is not in a replay-confirm actionable state."
      );
    }

    if (!mismatch.transactionIntentId) {
      throw new ConflictException("Mismatch does not reference a transaction intent.");
    }

    if (!mismatch.transactionIntent) {
      throw new ConflictException("Linked transaction intent could not be resolved.");
    }

    if (mismatch.transactionIntent.intentType === TransactionIntentType.deposit) {
      await this.transactionIntentsService.replayConfirmDepositIntent(
        mismatch.transactionIntentId,
        operatorId,
        note
      );
    } else {
      await this.withdrawalIntentsService.replayConfirmWithdrawalIntent(
        mismatch.transactionIntentId,
        operatorId,
        note
      );
    }

    const refreshed = await this.refreshMismatchAfterTargetedScan(
      {
        scope: "transaction_intent",
        transactionIntentId: mismatch.transactionIntentId
      },
      mismatch.mismatchKey,
      operatorId
    );

    return {
      mismatch: this.mapMismatchProjection(refreshed)
    };
  }

  async replaySettleMismatch(
    mismatchId: string,
    operatorId: string,
    note: string | null
  ): Promise<ActionResult> {
    const mismatch = await this.findMismatchById(mismatchId);

    if (
      mismatch.recommendedAction !==
      LedgerReconciliationMismatchRecommendedAction.replay_settle
    ) {
      throw new ConflictException(
        "Mismatch is not in a replay-settle actionable state."
      );
    }

    if (!mismatch.transactionIntentId || !mismatch.transactionIntent) {
      throw new ConflictException("Mismatch does not reference a transaction intent.");
    }

    if (mismatch.transactionIntent.intentType === TransactionIntentType.deposit) {
      await this.transactionIntentsService.replaySettleConfirmedDepositIntent(
        mismatch.transactionIntentId,
        operatorId,
        note
      );
    } else {
      await this.withdrawalIntentsService.replaySettleConfirmedWithdrawalIntent(
        mismatch.transactionIntentId,
        operatorId,
        note
      );
    }

    const refreshed = await this.refreshMismatchAfterTargetedScan(
      {
        scope: "transaction_intent",
        transactionIntentId: mismatch.transactionIntentId
      },
      mismatch.mismatchKey,
      operatorId
    );

    return {
      mismatch: this.mapMismatchProjection(refreshed)
    };
  }

  async openReviewCaseForMismatch(
    mismatchId: string,
    operatorId: string,
    note: string | null
  ): Promise<ActionResult> {
    const mismatch = await this.findMismatchById(mismatchId);

    if (
      mismatch.recommendedAction !==
      LedgerReconciliationMismatchRecommendedAction.open_review_case
    ) {
      throw new ConflictException(
        "Mismatch is not in an open-review-case actionable state."
      );
    }

    if (!mismatch.customerAccountId) {
      throw new ConflictException(
        "Mismatch does not contain enough context to open a review case."
      );
    }

    const reviewCaseResult = await this.reviewCasesService.openOrReuseReviewCase(
      this.prismaService,
      {
        customerId: mismatch.customer?.id ?? mismatch.customerId ?? null,
        customerAccountId: mismatch.customerAccountId,
        transactionIntentId: mismatch.transactionIntentId,
        type: ReviewCaseType.reconciliation_review,
        reasonCode: mismatch.reasonCode,
        notes: note ?? mismatch.summary,
        actorType: "operator",
        actorId: operatorId,
        auditAction: "review_case.reconciliation_review.opened",
        auditMetadata: {
          source: "ledger_reconciliation_mismatch",
          mismatchId: mismatch.id,
          mismatchScope: mismatch.scope,
          assetId: mismatch.assetId
        }
      }
    );

    const updated = await this.prismaService.ledgerReconciliationMismatch.update({
      where: {
        id: mismatch.id
      },
      data: {
        linkedReviewCaseId: reviewCaseResult.reviewCase.id,
        recommendedAction: LedgerReconciliationMismatchRecommendedAction.none
      },
      include: mismatchInclude
    });

    await this.appendMismatchAuditEvent(
      "operator",
      operatorId,
      "ledger_reconciliation.mismatch.linked_review_case",
      {
        id: updated.id,
        customerId: updated.customerId ?? null,
        customerAccountId: updated.customerAccountId ?? null,
        transactionIntentId: updated.transactionIntentId ?? null,
        assetId: updated.assetId ?? null,
        reasonCode: updated.reasonCode,
        scope: updated.scope,
        recommendedAction: updated.recommendedAction
      },
      {
        reviewCaseId: reviewCaseResult.reviewCase.id
      }
    );

    return {
      mismatch: this.mapMismatchProjection(updated)
    };
  }

  async repairCustomerBalanceMismatch(
    mismatchId: string,
    operatorId: string,
    note: string | null
  ): Promise<ActionResult> {
    const mismatch = await this.findMismatchById(mismatchId);

    if (
      mismatch.recommendedAction !==
      LedgerReconciliationMismatchRecommendedAction.repair_customer_balance
    ) {
      throw new ConflictException(
        "Mismatch is not in a repair-customer-balance actionable state."
      );
    }

    if (!mismatch.customerAccountId || !mismatch.assetId) {
      throw new ConflictException(
        "Mismatch does not contain enough context to repair a balance projection."
      );
    }

    const currentCandidates = await this.buildBalanceCandidates({
      scope: "customer_balance",
      customerAccountId: mismatch.customerAccountId
    });
    const currentCandidate = currentCandidates.find(
      (candidate) => candidate.mismatchKey === mismatch.mismatchKey
    );

    if (!currentCandidate) {
      throw new ConflictException(
        "Balance mismatch no longer exists in the current reconciliation snapshot."
      );
    }

    if (
      currentCandidate.recommendedAction !==
      LedgerReconciliationMismatchRecommendedAction.repair_customer_balance
    ) {
      throw new ConflictException(
        "Balance mismatch is not safe to repair automatically."
      );
    }

    const snapshot = currentCandidate.latestSnapshot as Prisma.JsonObject;
    const expectedBalance = snapshot.expectedBalance as Prisma.JsonObject;
    const actualBalance = snapshot.actualBalance as Prisma.JsonObject;
    const expectedAvailable = this.toDecimal(expectedBalance.availableBalance as string);
    const expectedPending = this.toDecimal(expectedBalance.pendingBalance as string);

    await this.prismaService.$transaction(async (transaction) => {
      await transaction.customerAssetBalance.upsert({
        where: {
          customerAccountId_assetId: {
            customerAccountId: mismatch.customerAccountId!,
            assetId: mismatch.assetId!
          }
        },
        create: {
          customerAccountId: mismatch.customerAccountId!,
          assetId: mismatch.assetId!,
          availableBalance: expectedAvailable,
          pendingBalance: expectedPending
        },
        update: {
          availableBalance: expectedAvailable,
          pendingBalance: expectedPending
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: mismatch.customer?.id ?? null,
          actorType: "operator",
          actorId: operatorId,
          action: "ledger_reconciliation.customer_balance_projection.repaired",
          targetType: "LedgerReconciliationMismatch",
          targetId: mismatch.id,
          metadata: {
            customerAccountId: mismatch.customerAccountId,
            assetId: mismatch.assetId,
            previousAvailableBalance: actualBalance.availableBalance,
            previousPendingBalance: actualBalance.pendingBalance,
            repairedAvailableBalance: expectedAvailable.toString(),
            repairedPendingBalance: expectedPending.toString(),
            note
          } as Prisma.InputJsonValue
        }
      });
    });

    const refreshed = await this.refreshMismatchAfterTargetedScan(
      {
        scope: "customer_balance",
        customerAccountId: mismatch.customerAccountId
      },
      mismatch.mismatchKey,
      operatorId
    );

    if (refreshed.status !== LedgerReconciliationMismatchStatus.resolved) {
      throw new ConflictException(
        "Balance repair did not clear the mismatch; manual review is still required."
      );
    }

    const resolved = await this.prismaService.ledgerReconciliationMismatch.update({
      where: {
        id: refreshed.id
      },
      data: {
        recommendedAction: LedgerReconciliationMismatchRecommendedAction.none,
        latestSnapshot: currentCandidate.latestSnapshot as Prisma.InputJsonValue,
        resolutionMetadata: {
          repairAction: "repair_customer_balance",
          previousAvailableBalance: actualBalance.availableBalance,
          previousPendingBalance: actualBalance.pendingBalance,
          repairedAvailableBalance: expectedAvailable.toString(),
          repairedPendingBalance: expectedPending.toString()
        } as Prisma.InputJsonValue,
        resolutionNote: note ?? "Customer balance projection rebuilt from ledger.",
        resolvedByOperatorId: operatorId
      },
      include: mismatchInclude
    });

    return {
      mismatch: this.mapMismatchProjection(resolved)
    };
  }

  async dismissMismatch(
    mismatchId: string,
    operatorId: string,
    note: string | null
  ): Promise<ActionResult> {
    const mismatch = await this.findMismatchById(mismatchId);

    if (mismatch.status !== LedgerReconciliationMismatchStatus.open) {
      throw new ConflictException("Only open mismatches can be dismissed.");
    }

    const dismissed = await this.prismaService.ledgerReconciliationMismatch.update({
      where: {
        id: mismatch.id
      },
      data: {
        status: LedgerReconciliationMismatchStatus.dismissed,
        dismissedAt: new Date(),
        dismissedByOperatorId: operatorId,
        resolutionNote: note ?? "Dismissed by operator."
      },
      include: mismatchInclude
    });

    await this.appendMismatchAuditEvent(
      "operator",
      operatorId,
      "ledger_reconciliation.mismatch.dismissed",
      {
        id: dismissed.id,
        customerId: dismissed.customerId ?? null,
        customerAccountId: dismissed.customerAccountId ?? null,
        transactionIntentId: dismissed.transactionIntentId ?? null,
        assetId: dismissed.assetId ?? null,
        reasonCode: dismissed.reasonCode,
        scope: dismissed.scope,
        recommendedAction: dismissed.recommendedAction
      },
      {
        note
      }
    );

    return {
      mismatch: this.mapMismatchProjection(dismissed)
    };
  }
}
