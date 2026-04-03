import { Injectable } from "@nestjs/common";
import {
  BlockchainTransactionStatus,
  Prisma,
  TransactionIntentType
} from "@prisma/client";
import { CustomerAccountOperationsService } from "../customer-account-operations/customer-account-operations.service";
import { ListCustomerAccountTimelineDto } from "../customer-account-operations/dto/list-customer-account-timeline.dto";
import { PrismaService } from "../prisma/prisma.service";
import { GetCustomerAccountIncidentPackageDto } from "./dto/get-customer-account-incident-package.dto";

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

const restrictionInclude = {
  oversightIncident: {
    select: {
      id: true,
      incidentType: true,
      status: true,
      reasonCode: true,
      assignedOperatorId: true,
      openedAt: true
    }
  },
  releaseReviewCase: {
    select: {
      id: true,
      type: true,
      status: true,
      assignedOperatorId: true,
      startedAt: true,
      resolvedAt: true,
      dismissedAt: true
    }
  }
} satisfies Prisma.CustomerAccountRestrictionInclude;

const reviewCaseInclude = {
  transactionIntent: {
    include: transactionIntentInclude
  }
} satisfies Prisma.ReviewCaseInclude;

const oversightIncidentInclude = {
  subjectCustomer: {
    select: {
      id: true,
      supabaseUserId: true,
      email: true,
      firstName: true,
      lastName: true
    }
  },
  subjectCustomerAccount: {
    select: {
      id: true,
      status: true,
      restrictedAt: true,
      restrictedFromStatus: true,
      restrictionReasonCode: true,
      restrictedByOperatorId: true,
      restrictedByOversightIncidentId: true,
      restrictionReleasedAt: true,
      restrictionReleasedByOperatorId: true
    }
  }
} satisfies Prisma.OversightIncidentInclude;

type BalanceRecord = Prisma.CustomerAssetBalanceGetPayload<{
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
  };
}>;

type RestrictionRecord = Prisma.CustomerAccountRestrictionGetPayload<{
  include: typeof restrictionInclude;
}>;

type ReviewCaseRecord = Prisma.ReviewCaseGetPayload<{
  include: typeof reviewCaseInclude;
}>;

type OversightIncidentRecord = Prisma.OversightIncidentGetPayload<{
  include: typeof oversightIncidentInclude;
}>;

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

type BalanceProjection = {
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

type RestrictionProjection = {
  id: string;
  status: string;
  restrictionReasonCode: string;
  appliedByOperatorId: string;
  appliedByOperatorRole: string | null;
  appliedNote: string | null;
  previousStatus: string;
  appliedAt: string;
  releasedAt: string | null;
  releasedByOperatorId: string | null;
  releasedByOperatorRole: string | null;
  releaseNote: string | null;
  restoredStatus: string | null;
  releaseDecisionStatus: string;
  releaseRequestedAt: string | null;
  releaseRequestedByOperatorId: string | null;
  releaseRequestNote: string | null;
  releaseDecidedAt: string | null;
  releaseDecidedByOperatorId: string | null;
  releaseDecisionNote: string | null;
  releaseReviewCase: {
    id: string;
    type: string;
    status: string;
    assignedOperatorId: string | null;
    startedAt: string | null;
    resolvedAt: string | null;
    dismissedAt: string | null;
  } | null;
  oversightIncident: {
    id: string;
    incidentType: string;
    status: string;
    reasonCode: string | null;
    assignedOperatorId: string | null;
    openedAt: string;
  };
};

type TransactionIntentProjection = {
  id: string;
  intentType: TransactionIntentType;
  status: string;
  policyDecision: string;
  requestedAmount: string;
  settledAmount: string | null;
  failureCode: string | null;
  failureReason: string | null;
  manuallyResolvedAt: string | null;
  manualResolutionReasonCode: string | null;
  manualResolutionNote: string | null;
  manualResolvedByOperatorId: string | null;
  manualResolutionOperatorRole: string | null;
  manualResolutionReviewCaseId: string | null;
  sourceWalletAddress: string | null;
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
  type: string;
  status: string;
  reasonCode: string | null;
  notes: string | null;
  assignedOperatorId: string | null;
  startedAt: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
  transactionIntent: TransactionIntentProjection | null;
};

type OversightIncidentProjection = {
  id: string;
  incidentType: string;
  status: string;
  reasonCode: string | null;
  summaryNote: string | null;
  subjectOperatorId: string | null;
  subjectOperatorRole: string | null;
  assignedOperatorId: string | null;
  openedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TimelineEntryProjection = {
  id: string;
  eventType: string;
  occurredAt: string;
  actorType: string | null;
  actorId: string | null;
  customerAccountId: string;
  transactionIntentId: string | null;
  reviewCaseId: string | null;
  oversightIncidentId: string | null;
  accountRestrictionId: string | null;
  metadata: Prisma.JsonValue;
};

type IncidentPackageProjection = {
  generatedAt: string;
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  accountStatus: string;
  currentRestriction: {
    active: boolean;
    restrictedAt: string | null;
    restrictedFromStatus: string | null;
    restrictionReasonCode: string | null;
    restrictedByOperatorId: string | null;
    restrictedByOversightIncidentId: string | null;
    restrictionReleasedAt: string | null;
    restrictionReleasedByOperatorId: string | null;
  };
  counts: {
    totalTransactionIntents: number;
    manuallyResolvedTransactionIntents: number;
    openReviewCases: number;
    openOversightIncidents: number;
    activeAccountHolds: number;
  };
  balances: BalanceProjection[];
  activeHolds: RestrictionProjection[];
  holdHistory: RestrictionProjection[];
  reviewCases: ReviewCaseProjection[];
  oversightIncidents: OversightIncidentProjection[];
  recentTransactionIntents: TransactionIntentProjection[];
  timeline: TimelineEntryProjection[];
  limits: {
    recentLimit: number;
    timelineLimit: number;
  };
};

@Injectable()
export class CustomerAccountIncidentPackageService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly customerAccountOperationsService: CustomerAccountOperationsService
  ) {}

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

  private mapBalance(balance: BalanceRecord): BalanceProjection {
    return {
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
    };
  }

  private mapRestriction(restriction: RestrictionRecord): RestrictionProjection {
    return {
      id: restriction.id,
      status: restriction.status,
      restrictionReasonCode: restriction.restrictionReasonCode,
      appliedByOperatorId: restriction.appliedByOperatorId,
      appliedByOperatorRole: restriction.appliedByOperatorRole,
      appliedNote: restriction.appliedNote,
      previousStatus: restriction.previousStatus,
      appliedAt: restriction.appliedAt.toISOString(),
      releasedAt: restriction.releasedAt?.toISOString() ?? null,
      releasedByOperatorId: restriction.releasedByOperatorId,
      releasedByOperatorRole: restriction.releasedByOperatorRole,
      releaseNote: restriction.releaseNote,
      restoredStatus: restriction.restoredStatus ?? null,
      releaseDecisionStatus: restriction.releaseDecisionStatus,
      releaseRequestedAt: restriction.releaseRequestedAt?.toISOString() ?? null,
      releaseRequestedByOperatorId: restriction.releaseRequestedByOperatorId,
      releaseRequestNote: restriction.releaseRequestNote,
      releaseDecidedAt: restriction.releaseDecidedAt?.toISOString() ?? null,
      releaseDecidedByOperatorId: restriction.releaseDecidedByOperatorId,
      releaseDecisionNote: restriction.releaseDecisionNote,
      releaseReviewCase: restriction.releaseReviewCase
        ? {
            id: restriction.releaseReviewCase.id,
            type: restriction.releaseReviewCase.type,
            status: restriction.releaseReviewCase.status,
            assignedOperatorId: restriction.releaseReviewCase.assignedOperatorId,
            startedAt: restriction.releaseReviewCase.startedAt?.toISOString() ?? null,
            resolvedAt: restriction.releaseReviewCase.resolvedAt?.toISOString() ?? null,
            dismissedAt: restriction.releaseReviewCase.dismissedAt?.toISOString() ?? null
          }
        : null,
      oversightIncident: {
        id: restriction.oversightIncident.id,
        incidentType: restriction.oversightIncident.incidentType,
        status: restriction.oversightIncident.status,
        reasonCode: restriction.oversightIncident.reasonCode,
        assignedOperatorId: restriction.oversightIncident.assignedOperatorId,
        openedAt: restriction.oversightIncident.openedAt.toISOString()
      }
    };
  }

  private mapTransactionIntent(intent: TransactionIntentRecord): TransactionIntentProjection {
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
      manualResolvedByOperatorId: intent.manualResolvedByOperatorId,
      manualResolutionOperatorRole: intent.manualResolutionOperatorRole,
      manualResolutionReviewCaseId: intent.manualResolutionReviewCaseId,
      sourceWalletAddress: intent.sourceWallet?.address ?? null,
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

  private mapReviewCase(reviewCase: ReviewCaseRecord): ReviewCaseProjection {
    return {
      id: reviewCase.id,
      type: reviewCase.type,
      status: reviewCase.status,
      reasonCode: reviewCase.reasonCode,
      notes: reviewCase.notes,
      assignedOperatorId: reviewCase.assignedOperatorId,
      startedAt: reviewCase.startedAt?.toISOString() ?? null,
      resolvedAt: reviewCase.resolvedAt?.toISOString() ?? null,
      dismissedAt: reviewCase.dismissedAt?.toISOString() ?? null,
      createdAt: reviewCase.createdAt.toISOString(),
      updatedAt: reviewCase.updatedAt.toISOString(),
      transactionIntent: reviewCase.transactionIntent
        ? this.mapTransactionIntent(reviewCase.transactionIntent)
        : null
    };
  }

  private mapOversightIncident(
    incident: OversightIncidentRecord
  ): OversightIncidentProjection {
    return {
      id: incident.id,
      incidentType: incident.incidentType,
      status: incident.status,
      reasonCode: incident.reasonCode,
      summaryNote: incident.summaryNote,
      subjectOperatorId: incident.subjectOperatorId,
      subjectOperatorRole: incident.subjectOperatorRole,
      assignedOperatorId: incident.assignedOperatorId,
      openedAt: incident.openedAt.toISOString(),
      startedAt: incident.startedAt?.toISOString() ?? null,
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      dismissedAt: incident.dismissedAt?.toISOString() ?? null,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString()
    };
  }

  async buildIncidentPackage(
    query: GetCustomerAccountIncidentPackageDto
  ): Promise<IncidentPackageProjection> {
    const recentLimit = query.recentLimit ?? 20;
    const timelineLimit = query.timelineLimit ?? 100;

    const timelineQuery: ListCustomerAccountTimelineDto = {
      customerAccountId: query.customerAccountId,
      supabaseUserId: query.supabaseUserId,
      limit: timelineLimit,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo
    };

    const timelineResult =
      await this.customerAccountOperationsService.listCustomerAccountTimeline(
        timelineQuery
      );

    const customerAccountId = timelineResult.summary.customer.customerAccountId;

    const [
      balances,
      activeHolds,
      holdHistory,
      reviewCases,
      oversightIncidents,
      recentTransactionIntents
    ] = await Promise.all([
      this.prismaService.customerAssetBalance.findMany({
        where: {
          customerAccountId
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
      }),
      this.prismaService.customerAccountRestriction.findMany({
        where: {
          customerAccountId,
          status: "active"
        },
        orderBy: {
          appliedAt: "desc"
        },
        include: restrictionInclude
      }),
      this.prismaService.customerAccountRestriction.findMany({
        where: {
          customerAccountId
        },
        orderBy: {
          appliedAt: "desc"
        },
        take: recentLimit,
        include: restrictionInclude
      }),
      this.prismaService.reviewCase.findMany({
        where: {
          customerAccountId
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: recentLimit,
        include: reviewCaseInclude
      }),
      this.prismaService.oversightIncident.findMany({
        where: {
          subjectCustomerAccountId: customerAccountId
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: recentLimit,
        include: oversightIncidentInclude
      }),
      this.prismaService.transactionIntent.findMany({
        where: {
          customerAccountId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: recentLimit,
        include: transactionIntentInclude
      })
    ]);

    return {
      generatedAt: new Date().toISOString(),
      customer: timelineResult.summary.customer,
      accountStatus: timelineResult.summary.accountStatus,
      currentRestriction: timelineResult.summary.currentRestriction,
      counts: timelineResult.summary.counts,
      balances: balances.map((balance) => this.mapBalance(balance)),
      activeHolds: activeHolds.map((hold) => this.mapRestriction(hold)),
      holdHistory: holdHistory.map((hold) => this.mapRestriction(hold)),
      reviewCases: reviewCases.map((reviewCase) => this.mapReviewCase(reviewCase)),
      oversightIncidents: oversightIncidents.map((incident) =>
        this.mapOversightIncident(incident)
      ),
      recentTransactionIntents: recentTransactionIntents.map((intent) =>
        this.mapTransactionIntent(intent)
      ),
      timeline: timelineResult.timeline,
      limits: {
        recentLimit,
        timelineLimit
      }
    };
  }

  renderIncidentPackageMarkdown(pkg: IncidentPackageProjection): string {
    const lines: string[] = [];

    lines.push("# Customer Account Incident Package");
    lines.push("");
    lines.push("Generated at: " + pkg.generatedAt);
    lines.push("Customer account id: " + pkg.customer.customerAccountId);
    lines.push("Customer id: " + pkg.customer.customerId);
    lines.push("Customer email: " + pkg.customer.email);
    lines.push(
      "Customer name: " +
        (pkg.customer.firstName + " " + pkg.customer.lastName).trim()
    );
    lines.push("Account status: " + pkg.accountStatus);
    lines.push("");
    lines.push("## Current restriction");
    lines.push("Active: " + (pkg.currentRestriction.active ? "yes" : "no"));
    lines.push(
      "Reason code: " + (pkg.currentRestriction.restrictionReasonCode ?? "n/a")
    );
    lines.push(
      "Restricted at: " + (pkg.currentRestriction.restrictedAt ?? "n/a")
    );
    lines.push(
      "Restricted by operator: " +
        (pkg.currentRestriction.restrictedByOperatorId ?? "n/a")
    );
    lines.push(
      "Restricted by oversight incident: " +
        (pkg.currentRestriction.restrictedByOversightIncidentId ?? "n/a")
    );
    lines.push("");
    lines.push("## Operational counts");
    lines.push(
      "Total transaction intents: " + pkg.counts.totalTransactionIntents
    );
    lines.push(
      "Manually resolved transaction intents: " +
        pkg.counts.manuallyResolvedTransactionIntents
    );
    lines.push("Open review cases: " + pkg.counts.openReviewCases);
    lines.push("Open oversight incidents: " + pkg.counts.openOversightIncidents);
    lines.push("Active account holds: " + pkg.counts.activeAccountHolds);
    lines.push("");
    lines.push("## Balances");

    if (pkg.balances.length === 0) {
      lines.push("No balances found.");
    } else {
      for (const balance of pkg.balances) {
        lines.push(
          "- " +
            balance.asset.symbol +
            ": available=" +
            balance.availableBalance +
            ", pending=" +
            balance.pendingBalance +
            ", updatedAt=" +
            balance.updatedAt
        );
      }
    }

    lines.push("");
    lines.push("## Active holds");

    if (pkg.activeHolds.length === 0) {
      lines.push("No active holds.");
    } else {
      for (const hold of pkg.activeHolds) {
        lines.push(
          "- " +
            hold.id +
            ": reason=" +
            hold.restrictionReasonCode +
            ", appliedAt=" +
            hold.appliedAt +
            ", appliedBy=" +
            hold.appliedByOperatorId +
            ", incident=" +
            hold.oversightIncident.id
        );
      }
    }

    lines.push("");
    lines.push("## Hold history");

    if (pkg.holdHistory.length === 0) {
      lines.push("No hold history.");
    } else {
      for (const hold of pkg.holdHistory) {
        lines.push(
          "- " +
            hold.id +
            ": status=" +
            hold.status +
            ", reason=" +
            hold.restrictionReasonCode +
            ", appliedAt=" +
            hold.appliedAt +
            ", releasedAt=" +
            (hold.releasedAt ?? "n/a")
        );
      }
    }

    lines.push("");
    lines.push("## Review cases");

    if (pkg.reviewCases.length === 0) {
      lines.push("No review cases found.");
    } else {
      for (const reviewCase of pkg.reviewCases) {
        lines.push(
          "- " +
            reviewCase.id +
            ": type=" +
            reviewCase.type +
            ", status=" +
            reviewCase.status +
            ", reason=" +
            (reviewCase.reasonCode ?? "n/a") +
            ", assignedOperator=" +
            (reviewCase.assignedOperatorId ?? "n/a")
        );
      }
    }

    lines.push("");
    lines.push("## Oversight incidents");

    if (pkg.oversightIncidents.length === 0) {
      lines.push("No oversight incidents found.");
    } else {
      for (const incident of pkg.oversightIncidents) {
        lines.push(
          "- " +
            incident.id +
            ": type=" +
            incident.incidentType +
            ", status=" +
            incident.status +
            ", reason=" +
            (incident.reasonCode ?? "n/a") +
            ", assignedOperator=" +
            (incident.assignedOperatorId ?? "n/a")
        );
      }
    }

    lines.push("");
    lines.push("## Recent transaction intents");

    if (pkg.recentTransactionIntents.length === 0) {
      lines.push("No transaction intents found.");
    } else {
      for (const intent of pkg.recentTransactionIntents) {
        lines.push(
          "- " +
            intent.id +
            ": intentType=" +
            intent.intentType +
            ", status=" +
            intent.status +
            ", asset=" +
            intent.asset.symbol +
            ", requestedAmount=" +
            intent.requestedAmount +
            ", manuallyResolvedAt=" +
            (intent.manuallyResolvedAt ?? "n/a")
        );
      }
    }

    lines.push("");
    lines.push("## Timeline");

    if (pkg.timeline.length === 0) {
      lines.push("No timeline events found.");
    } else {
      for (const entry of pkg.timeline) {
        lines.push(
          "- " +
            entry.occurredAt +
            ": eventType=" +
            entry.eventType +
            ", actorId=" +
            (entry.actorId ?? "n/a") +
            ", reviewCaseId=" +
            (entry.reviewCaseId ?? "n/a") +
            ", oversightIncidentId=" +
            (entry.oversightIncidentId ?? "n/a") +
            ", transactionIntentId=" +
            (entry.transactionIntentId ?? "n/a")
        );
      }
    }

    return lines.join("\n");
  }
}
