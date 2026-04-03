import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadProductChainRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  AccountLifecycleStatus,
  BlockchainTransactionStatus,
  CustomerAccountRestrictionStatus,
  OversightIncidentStatus,
  Prisma,
  ReviewCaseStatus,
  TransactionIntentStatus,
  TransactionIntentType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ListCustomerAccountTimelineDto } from "./dto/list-customer-account-timeline.dto";

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

type CustomerAccountSummaryRecord = Prisma.CustomerAccountGetPayload<{
  select: {
    id: true;
    status: true;
    restrictedAt: true;
    restrictedFromStatus: true;
    restrictionReasonCode: true;
    restrictedByOperatorId: true;
    restrictedByOversightIncidentId: true;
    restrictionReleasedAt: true;
    restrictionReleasedByOperatorId: true;
    customer: {
      select: {
        id: true;
        supabaseUserId: true;
        email: true;
        firstName: true;
        lastName: true;
      };
    };
  };
}>;

type TransactionIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: typeof transactionIntentInclude;
}>;

type ReviewCaseEventRecord = Prisma.ReviewCaseEventGetPayload<{
  include: {
    reviewCase: {
      select: {
        id: true;
        type: true;
        status: true;
        reasonCode: true;
        transactionIntentId: true;
        assignedOperatorId: true;
      };
    };
  };
}>;

type OversightIncidentEventRecord = Prisma.OversightIncidentEventGetPayload<{
  include: {
    oversightIncident: {
      select: {
        id: true;
        incidentType: true;
        status: true;
        reasonCode: true;
        assignedOperatorId: true;
        subjectOperatorId: true;
      };
    };
  };
}>;

type RestrictionRecord = Prisma.CustomerAccountRestrictionGetPayload<{
  include: {
    oversightIncident: {
      select: {
        id: true;
        incidentType: true;
        status: true;
        reasonCode: true;
      };
    };
    releaseReviewCase: {
      select: {
        id: true;
        status: true;
        type: true;
      };
    };
  };
}>;

type CurrentRestrictionProjection = {
  active: boolean;
  restrictedAt: string | null;
  restrictedFromStatus: AccountLifecycleStatus | null;
  restrictionReasonCode: string | null;
  restrictedByOperatorId: string | null;
  restrictedByOversightIncidentId: string | null;
  restrictionReleasedAt: string | null;
  restrictionReleasedByOperatorId: string | null;
};

type CustomerAccountOperationsSummaryProjection = {
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  accountStatus: AccountLifecycleStatus;
  currentRestriction: CurrentRestrictionProjection;
  counts: {
    totalTransactionIntents: number;
    manuallyResolvedTransactionIntents: number;
    openReviewCases: number;
    openOversightIncidents: number;
    activeAccountHolds: number;
  };
};

type CustomerAccountTimelineEntryProjection = {
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

type ListCustomerAccountTimelineResult = {
  summary: CustomerAccountOperationsSummaryProjection;
  timeline: CustomerAccountTimelineEntryProjection[];
  limit: number;
  filters: {
    eventType: string | null;
    actorId: string | null;
    dateFrom: string | null;
    dateTo: string | null;
  };
};

@Injectable()
export class CustomerAccountOperationsService {
  private readonly productChainId: number;

  constructor(private readonly prismaService: PrismaService) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
  }

  private calculateSourceFetchLimit(limit: number): number {
    return Math.max(limit * 4, 50);
  }

  private parseOptionalDate(value?: string): Date | null {
    if (!value) {
      return null;
    }

    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException("Invalid timeline date filter.");
    }

    return parsedDate;
  }

  private assertTimelineRange(dateFrom: Date | null, dateTo: Date | null): void {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new BadRequestException("dateFrom must be before or equal to dateTo.");
    }
  }

  private isWithinRange(
    occurredAt: Date,
    dateFrom: Date | null,
    dateTo: Date | null
  ): boolean {
    if (dateFrom && occurredAt < dateFrom) {
      return false;
    }

    if (dateTo && occurredAt > dateTo) {
      return false;
    }

    return true;
  }

  private async resolveCustomerAccount(
    query: ListCustomerAccountTimelineDto
  ): Promise<CustomerAccountSummaryRecord> {
    if (!query.customerAccountId?.trim() && !query.supabaseUserId?.trim()) {
      throw new BadRequestException(
        "customerAccountId or supabaseUserId is required."
      );
    }

    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: query.customerAccountId?.trim()
        ? {
            id: query.customerAccountId.trim()
          }
        : {
            customer: {
              supabaseUserId: query.supabaseUserId!.trim()
            }
          },
      select: {
        id: true,
        status: true,
        restrictedAt: true,
        restrictedFromStatus: true,
        restrictionReasonCode: true,
        restrictedByOperatorId: true,
        restrictedByOversightIncidentId: true,
        restrictionReleasedAt: true,
        restrictionReleasedByOperatorId: true,
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
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account not found.");
    }

    return customerAccount;
  }

  private mapCurrentRestriction(
    customerAccount: CustomerAccountSummaryRecord
  ): CurrentRestrictionProjection {
    return {
      active: customerAccount.status === AccountLifecycleStatus.restricted,
      restrictedAt: customerAccount.restrictedAt?.toISOString() ?? null,
      restrictedFromStatus: customerAccount.restrictedFromStatus ?? null,
      restrictionReasonCode: customerAccount.restrictionReasonCode ?? null,
      restrictedByOperatorId: customerAccount.restrictedByOperatorId ?? null,
      restrictedByOversightIncidentId:
        customerAccount.restrictedByOversightIncidentId ?? null,
      restrictionReleasedAt:
        customerAccount.restrictionReleasedAt?.toISOString() ?? null,
      restrictionReleasedByOperatorId:
        customerAccount.restrictionReleasedByOperatorId ?? null
    };
  }

  private buildTransactionIntentCreatedEntry(
    customerAccountId: string,
    intent: TransactionIntentRecord
  ): CustomerAccountTimelineEntryProjection {
    return {
      id: "transaction_intent_created:" + intent.id,
      eventType: "transaction_intent.created",
      occurredAt: intent.createdAt.toISOString(),
      actorType: "system",
      actorId: null,
      customerAccountId,
      transactionIntentId: intent.id,
      reviewCaseId: null,
      oversightIncidentId: null,
      accountRestrictionId: null,
      metadata: {
        intentType: intent.intentType,
        status: intent.status,
        policyDecision: intent.policyDecision,
        requestedAmount: intent.requestedAmount.toString(),
        settledAmount: intent.settledAmount?.toString() ?? null,
        assetSymbol: intent.asset.symbol,
        assetDisplayName: intent.asset.displayName,
        sourceWalletAddress: intent.sourceWallet?.address ?? null,
        destinationWalletAddress: intent.destinationWallet?.address ?? null,
        externalAddress: intent.externalAddress ?? null,
        latestBlockchainTransaction: intent.blockchainTransactions[0]
          ? {
              txHash: intent.blockchainTransactions[0].txHash,
              status: intent.blockchainTransactions[0].status
            }
          : null
      }
    };
  }

  private buildTransactionIntentManualResolutionEntry(
    customerAccountId: string,
    intent: TransactionIntentRecord
  ): CustomerAccountTimelineEntryProjection | null {
    if (!intent.manuallyResolvedAt) {
      return null;
    }

    return {
      id: "transaction_intent_manually_resolved:" + intent.id,
      eventType: "transaction_intent.manually_resolved",
      occurredAt: intent.manuallyResolvedAt.toISOString(),
      actorType: "operator",
      actorId: intent.manualResolvedByOperatorId ?? null,
      customerAccountId,
      transactionIntentId: intent.id,
      reviewCaseId: intent.manualResolutionReviewCaseId ?? null,
      oversightIncidentId: null,
      accountRestrictionId: null,
      metadata: {
        intentType: intent.intentType,
        status: intent.status,
        manualResolutionReasonCode: intent.manualResolutionReasonCode,
        manualResolutionNote: intent.manualResolutionNote,
        manualResolutionOperatorRole: intent.manualResolutionOperatorRole,
        assetSymbol: intent.asset.symbol,
        requestedAmount: intent.requestedAmount.toString()
      }
    };
  }

  private buildReviewCaseEventEntry(
    customerAccountId: string,
    event: ReviewCaseEventRecord
  ): CustomerAccountTimelineEntryProjection {
    return {
      id: "review_case_event:" + event.id,
      eventType: "review_case." + event.eventType,
      occurredAt: event.createdAt.toISOString(),
      actorType: event.actorType,
      actorId: event.actorId ?? null,
      customerAccountId,
      transactionIntentId: event.reviewCase.transactionIntentId ?? null,
      reviewCaseId: event.reviewCase.id,
      oversightIncidentId: null,
      accountRestrictionId: null,
      metadata: {
        reviewCaseType: event.reviewCase.type,
        reviewCaseStatus: event.reviewCase.status,
        reviewCaseReasonCode: event.reviewCase.reasonCode,
        assignedOperatorId: event.reviewCase.assignedOperatorId,
        note: event.note,
        eventMetadata: event.metadata
      }
    };
  }

  private buildOversightIncidentEventEntry(
    customerAccountId: string,
    event: OversightIncidentEventRecord
  ): CustomerAccountTimelineEntryProjection {
    return {
      id: "oversight_incident_event:" + event.id,
      eventType: "oversight_incident." + event.eventType,
      occurredAt: event.createdAt.toISOString(),
      actorType: event.actorType,
      actorId: event.actorId ?? null,
      customerAccountId,
      transactionIntentId: null,
      reviewCaseId: null,
      oversightIncidentId: event.oversightIncident.id,
      accountRestrictionId: null,
      metadata: {
        incidentType: event.oversightIncident.incidentType,
        incidentStatus: event.oversightIncident.status,
        incidentReasonCode: event.oversightIncident.reasonCode,
        assignedOperatorId: event.oversightIncident.assignedOperatorId,
        subjectOperatorId: event.oversightIncident.subjectOperatorId,
        note: event.note,
        eventMetadata: event.metadata
      }
    };
  }

  private buildAccountHoldAppliedEntry(
    customerAccountId: string,
    restriction: RestrictionRecord
  ): CustomerAccountTimelineEntryProjection {
    return {
      id: "account_hold_applied:" + restriction.id,
      eventType: "account_hold.applied",
      occurredAt: restriction.appliedAt.toISOString(),
      actorType: "operator",
      actorId: restriction.appliedByOperatorId,
      customerAccountId,
      transactionIntentId: null,
      reviewCaseId: restriction.releaseReviewCaseId ?? null,
      oversightIncidentId: restriction.oversightIncidentId,
      accountRestrictionId: restriction.id,
      metadata: {
        restrictionReasonCode: restriction.restrictionReasonCode,
        appliedByOperatorRole: restriction.appliedByOperatorRole,
        previousStatus: restriction.previousStatus,
        appliedNote: restriction.appliedNote,
        releaseDecisionStatus: restriction.releaseDecisionStatus,
        oversightIncidentType: restriction.oversightIncident.incidentType
      }
    };
  }

  private buildAccountHoldReleasedEntry(
    customerAccountId: string,
    restriction: RestrictionRecord
  ): CustomerAccountTimelineEntryProjection | null {
    if (!restriction.releasedAt) {
      return null;
    }

    return {
      id: "account_hold_released:" + restriction.id,
      eventType: "account_hold.released",
      occurredAt: restriction.releasedAt.toISOString(),
      actorType: "operator",
      actorId: restriction.releasedByOperatorId ?? null,
      customerAccountId,
      transactionIntentId: null,
      reviewCaseId: restriction.releaseReviewCaseId ?? null,
      oversightIncidentId: restriction.oversightIncidentId,
      accountRestrictionId: restriction.id,
      metadata: {
        restrictionReasonCode: restriction.restrictionReasonCode,
        releasedByOperatorRole: restriction.releasedByOperatorRole,
        releaseDecisionStatus: restriction.releaseDecisionStatus,
        releaseNote: restriction.releaseNote,
        restoredStatus: restriction.restoredStatus,
        oversightIncidentType: restriction.oversightIncident.incidentType
      }
    };
  }

  async listCustomerAccountTimeline(
    query: ListCustomerAccountTimelineDto
  ): Promise<ListCustomerAccountTimelineResult> {
    const limit = query.limit ?? 50;
    const sourceFetchLimit = this.calculateSourceFetchLimit(limit);
    const dateFrom = this.parseOptionalDate(query.dateFrom);
    const dateTo = this.parseOptionalDate(query.dateTo);
    const normalizedEventType = query.eventType?.trim() ?? null;
    const normalizedActorId = query.actorId?.trim() ?? null;

    this.assertTimelineRange(dateFrom, dateTo);

    const customerAccount = await this.resolveCustomerAccount(query);

    const [
      transactionIntents,
      reviewCaseEvents,
      oversightIncidentEvents,
      restrictions,
      totalTransactionIntents,
      manuallyResolvedTransactionIntents,
      openReviewCases,
      openOversightIncidents,
      activeAccountHolds
    ] = await Promise.all([
      this.prismaService.transactionIntent.findMany({
        where: {
          customerAccountId: customerAccount.id,
          chainId: this.productChainId
        },
        orderBy: {
          createdAt: "desc"
        },
        take: sourceFetchLimit,
        include: transactionIntentInclude
      }),
      this.prismaService.reviewCaseEvent.findMany({
        where: {
          reviewCase: {
            customerAccountId: customerAccount.id
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: sourceFetchLimit,
        include: {
          reviewCase: {
            select: {
              id: true,
              type: true,
              status: true,
              reasonCode: true,
              transactionIntentId: true,
              assignedOperatorId: true
            }
          }
        }
      }),
      this.prismaService.oversightIncidentEvent.findMany({
        where: {
          oversightIncident: {
            subjectCustomerAccountId: customerAccount.id
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: sourceFetchLimit,
        include: {
          oversightIncident: {
            select: {
              id: true,
              incidentType: true,
              status: true,
              reasonCode: true,
              assignedOperatorId: true,
              subjectOperatorId: true
            }
          }
        }
      }),
      this.prismaService.customerAccountRestriction.findMany({
        where: {
          customerAccountId: customerAccount.id
        },
        orderBy: {
          appliedAt: "desc"
        },
        take: sourceFetchLimit,
        include: {
          oversightIncident: {
            select: {
              id: true,
              incidentType: true,
              status: true,
              reasonCode: true
            }
          },
          releaseReviewCase: {
            select: {
              id: true,
              status: true,
              type: true
            }
          }
        }
      }),
      this.prismaService.transactionIntent.count({
        where: {
          customerAccountId: customerAccount.id,
          chainId: this.productChainId
        }
      }),
      this.prismaService.transactionIntent.count({
        where: {
          customerAccountId: customerAccount.id,
          chainId: this.productChainId,
          status: TransactionIntentStatus.manually_resolved
        }
      }),
      this.prismaService.reviewCase.count({
        where: {
          customerAccountId: customerAccount.id,
          status: {
            in: [ReviewCaseStatus.open, ReviewCaseStatus.in_progress]
          }
        }
      }),
      this.prismaService.oversightIncident.count({
        where: {
          subjectCustomerAccountId: customerAccount.id,
          status: {
            in: [OversightIncidentStatus.open, OversightIncidentStatus.in_progress]
          }
        }
      }),
      this.prismaService.customerAccountRestriction.count({
        where: {
          customerAccountId: customerAccount.id,
          status: CustomerAccountRestrictionStatus.active
        }
      })
    ]);

    const timelineEntries: CustomerAccountTimelineEntryProjection[] = [];

    for (const intent of transactionIntents) {
      timelineEntries.push(
        this.buildTransactionIntentCreatedEntry(customerAccount.id, intent)
      );

      const manualResolutionEntry =
        this.buildTransactionIntentManualResolutionEntry(
          customerAccount.id,
          intent
        );

      if (manualResolutionEntry) {
        timelineEntries.push(manualResolutionEntry);
      }
    }

    for (const event of reviewCaseEvents) {
      timelineEntries.push(
        this.buildReviewCaseEventEntry(customerAccount.id, event)
      );
    }

    for (const event of oversightIncidentEvents) {
      timelineEntries.push(
        this.buildOversightIncidentEventEntry(customerAccount.id, event)
      );
    }

    for (const restriction of restrictions) {
      timelineEntries.push(
        this.buildAccountHoldAppliedEntry(customerAccount.id, restriction)
      );

      const releasedEntry =
        this.buildAccountHoldReleasedEntry(customerAccount.id, restriction);

      if (releasedEntry) {
        timelineEntries.push(releasedEntry);
      }
    }

    const filteredTimeline = timelineEntries
      .filter((entry) => {
        const occurredAt = new Date(entry.occurredAt);

        if (!this.isWithinRange(occurredAt, dateFrom, dateTo)) {
          return false;
        }

        if (normalizedEventType && entry.eventType !== normalizedEventType) {
          return false;
        }

        if (normalizedActorId && entry.actorId !== normalizedActorId) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const timeDelta =
          new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();

        if (timeDelta !== 0) {
          return timeDelta;
        }

        return left.id.localeCompare(right.id);
      })
      .slice(0, limit);

    return {
      summary: {
        customer: {
          customerId: customerAccount.customer.id,
          customerAccountId: customerAccount.id,
          supabaseUserId: customerAccount.customer.supabaseUserId,
          email: customerAccount.customer.email,
          firstName: customerAccount.customer.firstName ?? "",
          lastName: customerAccount.customer.lastName ?? ""
        },
        accountStatus: customerAccount.status,
        currentRestriction: this.mapCurrentRestriction(customerAccount),
        counts: {
          totalTransactionIntents,
          manuallyResolvedTransactionIntents,
          openReviewCases,
          openOversightIncidents,
          activeAccountHolds
        }
      },
      timeline: filteredTimeline,
      limit,
      filters: {
        eventType: normalizedEventType,
        actorId: normalizedActorId,
        dateFrom: dateFrom?.toISOString() ?? null,
        dateTo: dateTo?.toISOString() ?? null
      }
    };
  }
}
