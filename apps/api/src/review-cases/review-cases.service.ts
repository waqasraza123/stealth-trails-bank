import {
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  BlockchainTransactionStatus,
  PolicyDecision,
  Prisma,
  ReviewCaseEventType,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AddReviewCaseNoteDto } from "./dto/add-review-case-note.dto";
import { ApplyManualResolutionDto } from "./dto/apply-manual-resolution.dto";
import { DismissReviewCaseDto } from "./dto/dismiss-review-case.dto";
import { GetReviewCaseWorkspaceDto } from "./dto/get-review-case-workspace.dto";
import { HandoffReviewCaseDto } from "./dto/handoff-review-case.dto";
import { ListReviewCasesDto } from "./dto/list-review-cases.dto";
import { OpenDeniedWithdrawalReviewCaseDto } from "./dto/open-denied-withdrawal-review-case.dto";
import { ResolveReviewCaseDto } from "./dto/resolve-review-case.dto";
import { StartReviewCaseDto } from "./dto/start-review-case.dto";

const transactionIntentInclude = {
  asset: {
    select: {
      id: true,
      symbol: true,
      displayName: true,
      decimals: true,
      chainId: true
    }
  },
  sourceWallet: {
    select: {
      id: true,
      address: true
    }
  },
  destinationWallet: {
    select: {
      id: true,
      address: true
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
      createdAt: true,
      updatedAt: true,
      confirmedAt: true
    }
  }
} satisfies Prisma.TransactionIntentInclude;

const reviewCaseInclude = {
  customer: {
    select: {
      id: true,
      supabaseUserId: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  customerAccount: {
    select: {
      id: true,
      customerId: true
    }
  },
  transactionIntent: {
    include: transactionIntentInclude
  }
} satisfies Prisma.ReviewCaseInclude;

type ReviewCaseMutationClient = Prisma.TransactionClient | PrismaService;

type ReviewCaseRecord = Prisma.ReviewCaseGetPayload<{
  include: typeof reviewCaseInclude;
}>;

type ReviewCaseEventRecord = Prisma.ReviewCaseEventGetPayload<{}>;

type TransactionIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: typeof transactionIntentInclude;
}>;

type LatestBlockchainTransactionProjection = {
  id: string;
  txHash: string | null;
  status: BlockchainTransactionStatus;
  fromAddress: string | null;
  toAddress: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
};

type TransactionIntentProjection = {
  id: string;
  intentType: TransactionIntentType;
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: string;
  settledAmount: string | null;
  failureCode: string | null;
  failureReason: string | null;
  manuallyResolvedAt: string | null;
  manualResolutionReasonCode: string | null;
  manualResolutionNote: string | null;
  sourceWalletId: string | null;
  sourceWalletAddress: string | null;
  destinationWalletId: string | null;
  destinationWalletAddress: string | null;
  externalAddress: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  latestBlockchainTransaction: LatestBlockchainTransactionProjection | null;
  createdAt: string;
  updatedAt: string;
};

type ReviewCaseProjection = {
  id: string;
  type: ReviewCaseType;
  status: ReviewCaseStatus;
  reasonCode: string | null;
  notes: string | null;
  assignedOperatorId: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    customerId: string | null;
    supabaseUserId: string | null;
    email: string | null;
    firstName: string;
    lastName: string;
  };
  customerAccountId: string | null;
  transactionIntent: TransactionIntentProjection | null;
};

type ReviewCaseEventProjection = {
  id: string;
  actorType: string;
  actorId: string | null;
  eventType: ReviewCaseEventType;
  note: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

type AuditTimelineProjection = {
  id: string;
  actorType: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

type CustomerBalanceProjection = {
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

type ManualResolutionRecommendedAction =
  | "apply_manual_resolution"
  | "use_runtime_flow"
  | "resolve_case_only"
  | "not_supported";

type ManualResolutionEligibilityProjection = {
  eligible: boolean;
  reasonCode: string;
  reason: string;
  currentIntentStatus: TransactionIntentStatus | null;
  currentReviewCaseStatus: ReviewCaseStatus;
  currentReviewCaseType: ReviewCaseType;
  recommendedAction: ManualResolutionRecommendedAction;
};

type OpenOrReuseReviewCaseParams = {
  customerId: string | null;
  customerAccountId: string | null;
  transactionIntentId: string | null;
  type: ReviewCaseType;
  reasonCode: string | null;
  notes: string | null;
  actorType: string;
  actorId: string | null;
  auditAction: string;
  auditMetadata: Record<string, unknown> | null;
};

type OpenReviewCaseResult = {
  reviewCase: ReviewCaseProjection;
  reviewCaseReused: boolean;
};

type ListReviewCasesResult = {
  reviewCases: ReviewCaseProjection[];
  limit: number;
};

type GetReviewCaseResult = {
  reviewCase: ReviewCaseProjection;
};

type ReviewCaseWorkspaceResult = {
  reviewCase: ReviewCaseProjection;
  manualResolutionEligibility: ManualResolutionEligibilityProjection;
  caseEvents: ReviewCaseEventProjection[];
  relatedTransactionAuditEvents: AuditTimelineProjection[];
  balances: CustomerBalanceProjection[];
  recentIntents: TransactionIntentProjection[];
  recentLimit: number;
};

type UpdateReviewCaseStateResult = {
  reviewCase: ReviewCaseProjection;
  stateReused: boolean;
};

type AddReviewCaseNoteResult = {
  reviewCase: ReviewCaseProjection;
  event: ReviewCaseEventProjection;
};

type ApplyManualResolutionResult = {
  reviewCase: ReviewCaseProjection;
  transactionIntent: TransactionIntentProjection;
  stateReused: boolean;
};

@Injectable()
export class ReviewCasesService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private mapLatestBlockchainTransaction(
    intent: TransactionIntentRecord
  ): LatestBlockchainTransactionProjection | null {
    const latestBlockchainTransaction = intent.blockchainTransactions[0];

    if (!latestBlockchainTransaction) {
      return null;
    }

    return {
      id: latestBlockchainTransaction.id,
      txHash: latestBlockchainTransaction.txHash,
      status: latestBlockchainTransaction.status,
      fromAddress: latestBlockchainTransaction.fromAddress,
      toAddress: latestBlockchainTransaction.toAddress,
      createdAt: latestBlockchainTransaction.createdAt.toISOString(),
      updatedAt: latestBlockchainTransaction.updatedAt.toISOString(),
      confirmedAt: latestBlockchainTransaction.confirmedAt?.toISOString() ?? null
    };
  }

  private mapTransactionIntentProjection(
    intent: TransactionIntentRecord
  ): TransactionIntentProjection {
    return {
      id: intent.id,
      intentType: intent.intentType,
      status: intent.status,
      policyDecision: intent.policyDecision,
      requestedAmount: intent.requestedAmount.toString(),
      settledAmount: intent.settledAmount?.toString() ?? null,
      failureCode: intent.failureCode,
      failureReason: intent.failureReason,
      manuallyResolvedAt: intent.manuallyResolvedAt?.toISOString() ?? null,
      manualResolutionReasonCode: intent.manualResolutionReasonCode,
      manualResolutionNote: intent.manualResolutionNote,
      sourceWalletId: intent.sourceWalletId,
      sourceWalletAddress: intent.sourceWallet?.address ?? null,
      destinationWalletId: intent.destinationWalletId,
      destinationWalletAddress: intent.destinationWallet?.address ?? null,
      externalAddress: intent.externalAddress ?? null,
      asset: {
        id: intent.asset.id,
        symbol: intent.asset.symbol,
        displayName: intent.asset.displayName,
        decimals: intent.asset.decimals,
        chainId: intent.asset.chainId
      },
      latestBlockchainTransaction: this.mapLatestBlockchainTransaction(intent),
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString()
    };
  }

  private mapReviewCaseProjection(record: ReviewCaseRecord): ReviewCaseProjection {
    return {
      id: record.id,
      type: record.type,
      status: record.status,
      reasonCode: record.reasonCode,
      notes: record.notes,
      assignedOperatorId: record.assignedOperatorId,
      startedAt: record.startedAt?.toISOString() ?? null,
      resolvedAt: record.resolvedAt?.toISOString() ?? null,
      dismissedAt: record.dismissedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      customer: {
        customerId: record.customer?.id ?? null,
        supabaseUserId: record.customer?.supabaseUserId ?? null,
        email: record.customer?.email ?? null,
        firstName: record.customer?.firstName ?? "",
        lastName: record.customer?.lastName ?? ""
      },
      customerAccountId: record.customerAccountId,
      transactionIntent: record.transactionIntent
        ? this.mapTransactionIntentProjection(record.transactionIntent)
        : null
    };
  }

  private mapReviewCaseEventProjection(
    event: ReviewCaseEventRecord
  ): ReviewCaseEventProjection {
    return {
      id: event.id,
      actorType: event.actorType,
      actorId: event.actorId,
      eventType: event.eventType,
      note: event.note,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString()
    };
  }

  private async findReviewCaseById(
    reviewCaseId: string
  ): Promise<ReviewCaseRecord | null> {
    return this.prismaService.reviewCase.findUnique({
      where: {
        id: reviewCaseId
      },
      include: reviewCaseInclude
    });
  }

  private ensureReviewCaseIsActionable(reviewCase: ReviewCaseRecord): void {
    if (reviewCase.status === ReviewCaseStatus.resolved) {
      throw new ConflictException("Review case is already resolved.");
    }

    if (reviewCase.status === ReviewCaseStatus.dismissed) {
      throw new ConflictException("Review case is already dismissed.");
    }
  }

  private ensureOperatorCanMutateReviewCase(
    reviewCase: ReviewCaseRecord,
    operatorId: string
  ): void {
    if (
      reviewCase.status === ReviewCaseStatus.in_progress &&
      reviewCase.assignedOperatorId &&
      reviewCase.assignedOperatorId !== operatorId
    ) {
      throw new ConflictException(
        "Review case is currently assigned to another operator."
      );
    }
  }

  private async appendReviewCaseEvent(
    client: ReviewCaseMutationClient,
    reviewCaseId: string,
    actorType: string,
    actorId: string | null,
    eventType: ReviewCaseEventType,
    note: string | null,
    metadata: Prisma.InputJsonValue | null
  ): Promise<ReviewCaseEventRecord> {
    return client.reviewCaseEvent.create({
      data: {
        reviewCaseId,
        actorType,
        actorId,
        eventType,
        note,
        metadata: metadata ?? Prisma.JsonNull
      }
    });
  }

  private buildManualResolutionEligibility(
    reviewCase: ReviewCaseRecord
  ): ManualResolutionEligibilityProjection {
    const intent = reviewCase.transactionIntent;

    if (!intent) {
      return {
        eligible: false,
        reasonCode: "no_linked_transaction_intent",
        reason: "Review case is not linked to a transaction intent.",
        currentIntentStatus: null,
        currentReviewCaseStatus: reviewCase.status,
        currentReviewCaseType: reviewCase.type,
        recommendedAction: "resolve_case_only"
      };
    }

    if (reviewCase.status === ReviewCaseStatus.dismissed) {
      return {
        eligible: false,
        reasonCode: "review_case_dismissed",
        reason: "Dismissed review cases do not support manual resolution.",
        currentIntentStatus: intent.status,
        currentReviewCaseStatus: reviewCase.status,
        currentReviewCaseType: reviewCase.type,
        recommendedAction: "resolve_case_only"
      };
    }

    if (reviewCase.status === ReviewCaseStatus.resolved) {
      return {
        eligible: false,
        reasonCode: "review_case_resolved",
        reason: "Resolved review cases do not support another manual intervention.",
        currentIntentStatus: intent.status,
        currentReviewCaseStatus: reviewCase.status,
        currentReviewCaseType: reviewCase.type,
        recommendedAction: "resolve_case_only"
      };
    }

    if (intent.status === TransactionIntentStatus.manually_resolved) {
      return {
        eligible: false,
        reasonCode: "intent_already_manually_resolved",
        reason: "The linked transaction intent is already manually resolved.",
        currentIntentStatus: intent.status,
        currentReviewCaseStatus: reviewCase.status,
        currentReviewCaseType: reviewCase.type,
        recommendedAction: "resolve_case_only"
      };
    }

    if (
      intent.status === TransactionIntentStatus.failed ||
      intent.status === TransactionIntentStatus.cancelled
    ) {
      return {
        eligible: true,
        reasonCode: "terminal_intent_safe_for_manual_resolution",
        reason:
          "The linked transaction intent is already in a terminal non-money-truth runtime state and can be manually resolved safely.",
        currentIntentStatus: intent.status,
        currentReviewCaseStatus: reviewCase.status,
        currentReviewCaseType: reviewCase.type,
        recommendedAction: "apply_manual_resolution"
      };
    }

    if (
      intent.status === TransactionIntentStatus.broadcast ||
      intent.status === TransactionIntentStatus.confirmed
    ) {
      return {
        eligible: false,
        reasonCode: "active_runtime_state_use_runtime_flow",
        reason:
          "The linked transaction intent is still in an active runtime state. Use replay or runtime recovery instead of manual resolution.",
        currentIntentStatus: intent.status,
        currentReviewCaseStatus: reviewCase.status,
        currentReviewCaseType: reviewCase.type,
        recommendedAction: "use_runtime_flow"
      };
    }

    if (
      intent.status === TransactionIntentStatus.requested ||
      intent.status === TransactionIntentStatus.review_required ||
      intent.status === TransactionIntentStatus.approved ||
      intent.status === TransactionIntentStatus.queued
    ) {
      return {
        eligible: false,
        reasonCode: "non_terminal_runtime_state_use_runtime_flow",
        reason:
          "The linked transaction intent is not terminal yet. Continue the normal runtime workflow instead of applying manual resolution.",
        currentIntentStatus: intent.status,
        currentReviewCaseStatus: reviewCase.status,
        currentReviewCaseType: reviewCase.type,
        recommendedAction: "use_runtime_flow"
      };
    }

    if (intent.status === TransactionIntentStatus.settled) {
      return {
        eligible: false,
        reasonCode: "settled_money_state_not_supported",
        reason:
          "Settled transaction intents are money-truth states and cannot be manually resolved in this slice.",
        currentIntentStatus: intent.status,
        currentReviewCaseStatus: reviewCase.status,
        currentReviewCaseType: reviewCase.type,
        recommendedAction: "not_supported"
      };
    }

    return {
      eligible: false,
      reasonCode: "unsupported_manual_resolution_state",
      reason:
        "The linked transaction intent is in a state that does not support manual resolution.",
      currentIntentStatus: intent.status,
      currentReviewCaseStatus: reviewCase.status,
      currentReviewCaseType: reviewCase.type,
      recommendedAction: "not_supported"
    };
  }

  async getManualResolutionEligibility(
    reviewCaseId: string
  ): Promise<ManualResolutionEligibilityProjection> {
    const reviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!reviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    return this.buildManualResolutionEligibility(reviewCase);
  }

  async openOrReuseReviewCase(
    client: ReviewCaseMutationClient,
    params: OpenOrReuseReviewCaseParams
  ): Promise<OpenReviewCaseResult> {
    const existingReviewCase = await client.reviewCase.findFirst({
      where: {
        customerAccountId: params.customerAccountId,
        transactionIntentId: params.transactionIntentId,
        type: params.type,
        reasonCode: params.reasonCode,
        status: {
          in: [ReviewCaseStatus.open, ReviewCaseStatus.in_progress]
        }
      },
      include: reviewCaseInclude
    });

    if (existingReviewCase) {
      return {
        reviewCase: this.mapReviewCaseProjection(existingReviewCase),
        reviewCaseReused: true
      };
    }

    const createdReviewCase = await client.reviewCase.create({
      data: {
        customerId: params.customerId,
        customerAccountId: params.customerAccountId,
        transactionIntentId: params.transactionIntentId,
        type: params.type,
        status: ReviewCaseStatus.open,
        reasonCode: params.reasonCode,
        notes: params.notes,
        assignedOperatorId: null,
        startedAt: null,
        resolvedAt: null,
        dismissedAt: null
      },
      include: reviewCaseInclude
    });

    await this.appendReviewCaseEvent(
      client,
      createdReviewCase.id,
      params.actorType,
      params.actorId,
      ReviewCaseEventType.opened,
      params.notes,
      {
        reasonCode: params.reasonCode,
        reviewCaseType: params.type,
        reviewCaseStatus: ReviewCaseStatus.open,
        context: params.auditMetadata ?? null
      } as Prisma.InputJsonValue
    );

    await client.auditEvent.create({
      data: {
        customerId: params.customerId,
        actorType: params.actorType,
        actorId: params.actorId,
        action: params.auditAction,
        targetType: "ReviewCase",
        targetId: createdReviewCase.id,
        metadata: {
          customerAccountId: params.customerAccountId,
          transactionIntentId: params.transactionIntentId,
          reviewCaseType: params.type,
          reviewCaseStatus: ReviewCaseStatus.open,
          reasonCode: params.reasonCode,
          notes: params.notes,
          context: params.auditMetadata ?? null
        } as Prisma.InputJsonValue
      }
    });

    return {
      reviewCase: this.mapReviewCaseProjection(createdReviewCase),
      reviewCaseReused: false
    };
  }

  async listReviewCases(query: ListReviewCasesDto): Promise<ListReviewCasesResult> {
    const limit = query.limit ?? 20;
    const where: Prisma.ReviewCaseWhereInput = {};

    if (query.status) {
      where.status = query.status as ReviewCaseStatus;
    }

    if (query.type) {
      where.type = query.type as ReviewCaseType;
    }

    if (query.customerAccountId?.trim()) {
      where.customerAccountId = query.customerAccountId.trim();
    }

    if (query.transactionIntentId?.trim()) {
      where.transactionIntentId = query.transactionIntentId.trim();
    }

    if (query.reasonCode?.trim()) {
      where.reasonCode = query.reasonCode.trim();
    }

    if (query.assignedOperatorId?.trim()) {
      where.assignedOperatorId = query.assignedOperatorId.trim();
    }

    if (query.email?.trim() || query.supabaseUserId?.trim()) {
      where.customer = {};
      if (query.email?.trim()) {
        where.customer.email = query.email.trim().toLowerCase();
      }
      if (query.supabaseUserId?.trim()) {
        where.customer.supabaseUserId = query.supabaseUserId.trim();
      }
    }

    const reviewCases = await this.prismaService.reviewCase.findMany({
      where,
      orderBy: {
        updatedAt: "desc"
      },
      take: limit,
      include: reviewCaseInclude
    });

    return {
      reviewCases: reviewCases.map((reviewCase) =>
        this.mapReviewCaseProjection(reviewCase)
      ),
      limit
    };
  }

  async getReviewCase(reviewCaseId: string): Promise<GetReviewCaseResult> {
    const reviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!reviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    return {
      reviewCase: this.mapReviewCaseProjection(reviewCase)
    };
  }

  async getReviewCaseWorkspace(
    reviewCaseId: string,
    query: GetReviewCaseWorkspaceDto
  ): Promise<ReviewCaseWorkspaceResult> {
    const recentLimit = query.recentLimit ?? 20;
    const reviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!reviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    const caseEvents = await this.prismaService.reviewCaseEvent.findMany({
      where: {
        reviewCaseId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const relatedTransactionAuditEvents = reviewCase.transactionIntentId
      ? await this.prismaService.auditEvent.findMany({
          where: {
            targetType: "TransactionIntent",
            targetId: reviewCase.transactionIntentId
          },
          orderBy: {
            createdAt: "asc"
          }
        })
      : [];

    const balances = reviewCase.customerAccountId
      ? await this.prismaService.customerAssetBalance.findMany({
          where: {
            customerAccountId: reviewCase.customerAccountId
          },
          orderBy: {
            asset: {
              symbol: "asc"
            }
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
            }
          }
        })
      : [];

    const recentIntents = reviewCase.customerAccountId
      ? await this.prismaService.transactionIntent.findMany({
          where: {
            customerAccountId: reviewCase.customerAccountId,
            chainId: this.productChainId
          },
          orderBy: {
            createdAt: "desc"
          },
          take: recentLimit,
          include: transactionIntentInclude
        })
      : [];

    return {
      reviewCase: this.mapReviewCaseProjection(reviewCase),
      manualResolutionEligibility:
        this.buildManualResolutionEligibility(reviewCase),
      caseEvents: caseEvents.map((event) =>
        this.mapReviewCaseEventProjection(event)
      ),
      relatedTransactionAuditEvents: relatedTransactionAuditEvents.map((event) => ({
        id: event.id,
        actorType: event.actorType,
        actorId: event.actorId,
        action: event.action,
        targetType: event.targetType,
        targetId: event.targetId,
        metadata: event.metadata,
        createdAt: event.createdAt.toISOString()
      })),
      balances: balances.map((balance) => ({
        asset: {
          id: balance.asset.id,
          symbol: balance.asset.symbol,
          displayName: balance.asset.displayName,
          decimals: balance.asset.decimals,
          chainId: balance.asset.chainId
        },
        availableBalance: balance.availableBalance.toString(),
        pendingBalance: balance.pendingBalance.toString(),
        updatedAt: balance.updatedAt.toISOString()
      })),
      recentIntents: recentIntents.map((intent) =>
        this.mapTransactionIntentProjection(intent)
      ),
      recentLimit
    };
  }

  async startReviewCase(
    reviewCaseId: string,
    operatorId: string,
    dto: StartReviewCaseDto
  ): Promise<UpdateReviewCaseStateResult> {
    const existingReviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!existingReviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    this.ensureReviewCaseIsActionable(existingReviewCase);
    this.ensureOperatorCanMutateReviewCase(existingReviewCase, operatorId);

    if (
      existingReviewCase.status === ReviewCaseStatus.in_progress &&
      existingReviewCase.assignedOperatorId === operatorId
    ) {
      return {
        reviewCase: this.mapReviewCaseProjection(existingReviewCase),
        stateReused: true
      };
    }

    const updatedReviewCase = await this.prismaService.$transaction(
      async (transaction) => {
        const reviewCase = await transaction.reviewCase.update({
          where: {
            id: existingReviewCase.id
          },
          data: {
            status: ReviewCaseStatus.in_progress,
            assignedOperatorId: operatorId,
            startedAt: existingReviewCase.startedAt ?? new Date(),
            notes: dto.note?.trim() ?? existingReviewCase.notes
          },
          include: reviewCaseInclude
        });

        await this.appendReviewCaseEvent(
          transaction,
          existingReviewCase.id,
          "operator",
          operatorId,
          ReviewCaseEventType.started,
          dto.note?.trim() ?? null,
          {
            previousStatus: existingReviewCase.status,
            newStatus: ReviewCaseStatus.in_progress,
            previousAssignedOperatorId: existingReviewCase.assignedOperatorId,
            newAssignedOperatorId: operatorId
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: existingReviewCase.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "review_case.started",
            targetType: "ReviewCase",
            targetId: existingReviewCase.id,
            metadata: {
              previousStatus: existingReviewCase.status,
              newStatus: ReviewCaseStatus.in_progress,
              previousAssignedOperatorId: existingReviewCase.assignedOperatorId,
              newAssignedOperatorId: operatorId,
              note: dto.note?.trim() ?? null,
              transactionIntentId: existingReviewCase.transactionIntentId,
              customerAccountId: existingReviewCase.customerAccountId
            } as Prisma.InputJsonValue
          }
        });

        return reviewCase;
      }
    );

    return {
      reviewCase: this.mapReviewCaseProjection(updatedReviewCase),
      stateReused: false
    };
  }

  async addReviewCaseNote(
    reviewCaseId: string,
    operatorId: string,
    dto: AddReviewCaseNoteDto
  ): Promise<AddReviewCaseNoteResult> {
    const existingReviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!existingReviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    this.ensureReviewCaseIsActionable(existingReviewCase);
    this.ensureOperatorCanMutateReviewCase(existingReviewCase, operatorId);

    const noteText = dto.note.trim();

    const result = await this.prismaService.$transaction(async (transaction) => {
      const reviewCase = await transaction.reviewCase.update({
        where: {
          id: existingReviewCase.id
        },
        data: {
          notes: noteText
        },
        include: reviewCaseInclude
      });

      const event = await this.appendReviewCaseEvent(
        transaction,
        existingReviewCase.id,
        "operator",
        operatorId,
        ReviewCaseEventType.note_added,
        noteText,
        {
          assignedOperatorId: existingReviewCase.assignedOperatorId,
          status: existingReviewCase.status
        } as Prisma.InputJsonValue
      );

      await transaction.auditEvent.create({
        data: {
          customerId: existingReviewCase.customerId,
          actorType: "operator",
          actorId: operatorId,
          action: "review_case.note_added",
          targetType: "ReviewCase",
          targetId: existingReviewCase.id,
          metadata: {
            note: noteText,
            assignedOperatorId: existingReviewCase.assignedOperatorId,
            status: existingReviewCase.status,
            transactionIntentId: existingReviewCase.transactionIntentId,
            customerAccountId: existingReviewCase.customerAccountId
          } as Prisma.InputJsonValue
        }
      });

      return {
        reviewCase,
        event
      };
    });

    return {
      reviewCase: this.mapReviewCaseProjection(result.reviewCase),
      event: this.mapReviewCaseEventProjection(result.event)
    };
  }

  async handoffReviewCase(
    reviewCaseId: string,
    operatorId: string,
    dto: HandoffReviewCaseDto
  ): Promise<UpdateReviewCaseStateResult> {
    const existingReviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!existingReviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    this.ensureReviewCaseIsActionable(existingReviewCase);
    this.ensureOperatorCanMutateReviewCase(existingReviewCase, operatorId);

    const nextOperatorId = dto.nextOperatorId.trim();

    if (
      existingReviewCase.status === ReviewCaseStatus.in_progress &&
      existingReviewCase.assignedOperatorId === nextOperatorId
    ) {
      return {
        reviewCase: this.mapReviewCaseProjection(existingReviewCase),
        stateReused: true
      };
    }

    const updatedReviewCase = await this.prismaService.$transaction(
      async (transaction) => {
        const reviewCase = await transaction.reviewCase.update({
          where: {
            id: existingReviewCase.id
          },
          data: {
            status: ReviewCaseStatus.in_progress,
            assignedOperatorId: nextOperatorId,
            startedAt: existingReviewCase.startedAt ?? new Date(),
            notes: dto.note?.trim() ?? existingReviewCase.notes
          },
          include: reviewCaseInclude
        });

        await this.appendReviewCaseEvent(
          transaction,
          existingReviewCase.id,
          "operator",
          operatorId,
          ReviewCaseEventType.handed_off,
          dto.note?.trim() ?? null,
          {
            previousAssignedOperatorId: existingReviewCase.assignedOperatorId,
            newAssignedOperatorId: nextOperatorId,
            previousStatus: existingReviewCase.status,
            newStatus: ReviewCaseStatus.in_progress
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: existingReviewCase.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "review_case.handed_off",
            targetType: "ReviewCase",
            targetId: existingReviewCase.id,
            metadata: {
              previousAssignedOperatorId: existingReviewCase.assignedOperatorId,
              newAssignedOperatorId: nextOperatorId,
              previousStatus: existingReviewCase.status,
              newStatus: ReviewCaseStatus.in_progress,
              note: dto.note?.trim() ?? null,
              transactionIntentId: existingReviewCase.transactionIntentId,
              customerAccountId: existingReviewCase.customerAccountId
            } as Prisma.InputJsonValue
          }
        });

        return reviewCase;
      }
    );

    return {
      reviewCase: this.mapReviewCaseProjection(updatedReviewCase),
      stateReused: false
    };
  }

  async resolveReviewCase(
    reviewCaseId: string,
    operatorId: string,
    dto: ResolveReviewCaseDto
  ): Promise<UpdateReviewCaseStateResult> {
    const existingReviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!existingReviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    if (existingReviewCase.status === ReviewCaseStatus.resolved) {
      return {
        reviewCase: this.mapReviewCaseProjection(existingReviewCase),
        stateReused: true
      };
    }

    if (existingReviewCase.status === ReviewCaseStatus.dismissed) {
      throw new ConflictException("Review case is already dismissed.");
    }

    this.ensureOperatorCanMutateReviewCase(existingReviewCase, operatorId);

    const updatedReviewCase = await this.prismaService.$transaction(
      async (transaction) => {
        const reviewCase = await transaction.reviewCase.update({
          where: {
            id: existingReviewCase.id
          },
          data: {
            status: ReviewCaseStatus.resolved,
            resolvedAt: new Date(),
            assignedOperatorId: existingReviewCase.assignedOperatorId ?? operatorId,
            notes: dto.note?.trim() ?? existingReviewCase.notes
          },
          include: reviewCaseInclude
        });

        await this.appendReviewCaseEvent(
          transaction,
          existingReviewCase.id,
          "operator",
          operatorId,
          ReviewCaseEventType.resolved,
          dto.note?.trim() ?? null,
          {
            previousStatus: existingReviewCase.status,
            newStatus: ReviewCaseStatus.resolved
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: existingReviewCase.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "review_case.resolved",
            targetType: "ReviewCase",
            targetId: existingReviewCase.id,
            metadata: {
              previousStatus: existingReviewCase.status,
              newStatus: ReviewCaseStatus.resolved,
              note: dto.note?.trim() ?? null,
              reviewCaseType: existingReviewCase.type,
              transactionIntentId: existingReviewCase.transactionIntentId,
              customerAccountId: existingReviewCase.customerAccountId
            } as Prisma.InputJsonValue
          }
        });

        return reviewCase;
      }
    );

    return {
      reviewCase: this.mapReviewCaseProjection(updatedReviewCase),
      stateReused: false
    };
  }

  async dismissReviewCase(
    reviewCaseId: string,
    operatorId: string,
    dto: DismissReviewCaseDto
  ): Promise<UpdateReviewCaseStateResult> {
    const existingReviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!existingReviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    if (existingReviewCase.status === ReviewCaseStatus.dismissed) {
      return {
        reviewCase: this.mapReviewCaseProjection(existingReviewCase),
        stateReused: true
      };
    }

    if (existingReviewCase.status === ReviewCaseStatus.resolved) {
      throw new ConflictException("Review case is already resolved.");
    }

    this.ensureOperatorCanMutateReviewCase(existingReviewCase, operatorId);

    const updatedReviewCase = await this.prismaService.$transaction(
      async (transaction) => {
        const reviewCase = await transaction.reviewCase.update({
          where: {
            id: existingReviewCase.id
          },
          data: {
            status: ReviewCaseStatus.dismissed,
            dismissedAt: new Date(),
            assignedOperatorId: existingReviewCase.assignedOperatorId ?? operatorId,
            notes: dto.note?.trim() ?? existingReviewCase.notes
          },
          include: reviewCaseInclude
        });

        await this.appendReviewCaseEvent(
          transaction,
          existingReviewCase.id,
          "operator",
          operatorId,
          ReviewCaseEventType.dismissed,
          dto.note?.trim() ?? null,
          {
            previousStatus: existingReviewCase.status,
            newStatus: ReviewCaseStatus.dismissed
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: existingReviewCase.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "review_case.dismissed",
            targetType: "ReviewCase",
            targetId: existingReviewCase.id,
            metadata: {
              previousStatus: existingReviewCase.status,
              newStatus: ReviewCaseStatus.dismissed,
              note: dto.note?.trim() ?? null,
              reviewCaseType: existingReviewCase.type,
              transactionIntentId: existingReviewCase.transactionIntentId,
              customerAccountId: existingReviewCase.customerAccountId
            } as Prisma.InputJsonValue
          }
        });

        return reviewCase;
      }
    );

    return {
      reviewCase: this.mapReviewCaseProjection(updatedReviewCase),
      stateReused: false
    };
  }

  async applyManualResolution(
    reviewCaseId: string,
    operatorId: string,
    dto: ApplyManualResolutionDto
  ): Promise<ApplyManualResolutionResult> {
    const existingReviewCase = await this.findReviewCaseById(reviewCaseId);

    if (!existingReviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    this.ensureOperatorCanMutateReviewCase(existingReviewCase, operatorId);

    if (
      existingReviewCase.status === ReviewCaseStatus.resolved &&
      existingReviewCase.transactionIntent?.status ===
        TransactionIntentStatus.manually_resolved
    ) {
      return {
        reviewCase: this.mapReviewCaseProjection(existingReviewCase),
        transactionIntent: this.mapTransactionIntentProjection(
          existingReviewCase.transactionIntent
        ),
        stateReused: true
      };
    }

    const eligibility = this.buildManualResolutionEligibility(existingReviewCase);

    if (!eligibility.eligible) {
      throw new ConflictException(eligibility.reason);
    }

    if (!existingReviewCase.transactionIntent) {
      throw new ConflictException(
        "Review case is not linked to a transaction intent."
      );
    }

    const manualResolutionReasonCode = dto.manualResolutionReasonCode.trim();
    const note = dto.note?.trim() ?? null;

    const result = await this.prismaService.$transaction(async (transaction) => {
      const updatedIntent = await transaction.transactionIntent.update({
        where: {
          id: existingReviewCase.transactionIntent!.id
        },
        data: {
          status: TransactionIntentStatus.manually_resolved,
          manuallyResolvedAt: new Date(),
          manualResolutionReasonCode,
          manualResolutionNote: note
        },
        include: transactionIntentInclude
      });

      const updatedReviewCase = await transaction.reviewCase.update({
        where: {
          id: existingReviewCase.id
        },
        data: {
          status: ReviewCaseStatus.resolved,
          assignedOperatorId: existingReviewCase.assignedOperatorId ?? operatorId,
          startedAt: existingReviewCase.startedAt ?? new Date(),
          resolvedAt: new Date(),
          notes: note ?? existingReviewCase.notes
        },
        include: reviewCaseInclude
      });

      await this.appendReviewCaseEvent(
        transaction,
        existingReviewCase.id,
        "operator",
        operatorId,
        ReviewCaseEventType.manual_resolution_applied,
        note,
        {
          previousIntentStatus: existingReviewCase.transactionIntent!.status,
          newIntentStatus: TransactionIntentStatus.manually_resolved,
          manualResolutionReasonCode
        } as Prisma.InputJsonValue
      );

      await this.appendReviewCaseEvent(
        transaction,
        existingReviewCase.id,
        "operator",
        operatorId,
        ReviewCaseEventType.resolved,
        note,
        {
          previousStatus: existingReviewCase.status,
          newStatus: ReviewCaseStatus.resolved,
          resolutionSource: "manual_intervention"
        } as Prisma.InputJsonValue
      );

      await transaction.auditEvent.create({
        data: {
          customerId: existingReviewCase.customerId,
          actorType: "operator",
          actorId: operatorId,
          action: "transaction_intent.manually_resolved",
          targetType: "TransactionIntent",
          targetId: existingReviewCase.transactionIntent!.id,
          metadata: {
            previousStatus: existingReviewCase.transactionIntent!.status,
            newStatus: TransactionIntentStatus.manually_resolved,
            manualResolutionReasonCode,
            manualResolutionNote: note,
            reviewCaseId: existingReviewCase.id,
            reviewCaseType: existingReviewCase.type,
            customerAccountId: existingReviewCase.customerAccountId
          } as Prisma.InputJsonValue
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: existingReviewCase.customerId,
          actorType: "operator",
          actorId: operatorId,
          action: "review_case.resolved",
          targetType: "ReviewCase",
          targetId: existingReviewCase.id,
          metadata: {
            previousStatus: existingReviewCase.status,
            newStatus: ReviewCaseStatus.resolved,
            resolutionSource: "manual_intervention",
            manualResolutionReasonCode,
            manualResolutionNote: note,
            transactionIntentId: existingReviewCase.transactionIntentId,
            customerAccountId: existingReviewCase.customerAccountId
          } as Prisma.InputJsonValue
        }
      });

      return {
        reviewCase: updatedReviewCase,
        transactionIntent: updatedIntent
      };
    });

    return {
      reviewCase: this.mapReviewCaseProjection(result.reviewCase),
      transactionIntent: this.mapTransactionIntentProjection(
        result.transactionIntent
      ),
      stateReused: false
    };
  }

  async openDeniedWithdrawalReviewCase(
    intentId: string,
    operatorId: string,
    dto: OpenDeniedWithdrawalReviewCaseDto
  ): Promise<OpenReviewCaseResult> {
    const transactionIntent = await this.prismaService.transactionIntent.findFirst({
      where: {
        id: intentId,
        intentType: TransactionIntentType.withdrawal,
        chainId: this.productChainId
      },
      include: {
        customerAccount: {
          select: {
            id: true,
            customerId: true,
            customer: {
              select: {
                id: true,
                supabaseUserId: true,
                email: true,
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

    if (!transactionIntent || !transactionIntent.customerAccount) {
      throw new NotFoundException("Withdrawal transaction intent not found.");
    }

    if (
      transactionIntent.status !== TransactionIntentStatus.failed ||
      transactionIntent.policyDecision !== PolicyDecision.denied
    ) {
      throw new ConflictException(
        "Withdrawal transaction intent is not in a denied state that supports review-case creation."
      );
    }

    return this.openOrReuseReviewCase(this.prismaService, {
      customerId: transactionIntent.customerAccount.customer.id,
      customerAccountId: transactionIntent.customerAccount.id,
      transactionIntentId: transactionIntent.id,
      type: ReviewCaseType.withdrawal_review,
      reasonCode:
        dto.reasonCode?.trim() ??
        transactionIntent.failureCode ??
        "policy_denied",
      notes: dto.note?.trim() ?? transactionIntent.failureReason ?? null,
      actorType: "operator",
      actorId: operatorId,
      auditAction: "review_case.withdrawal_review.opened",
      auditMetadata: {
        intentType: transactionIntent.intentType,
        transactionStatus: transactionIntent.status,
        policyDecision: transactionIntent.policyDecision,
        assetSymbol: transactionIntent.asset.symbol,
        requestedAmount: transactionIntent.requestedAmount.toString(),
        failureCode: transactionIntent.failureCode,
        failureReason: transactionIntent.failureReason,
        chainId: transactionIntent.chainId
      }
    });
  }
}
