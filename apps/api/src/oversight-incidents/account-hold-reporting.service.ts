import { Injectable } from "@nestjs/common";
import {
  AccountLifecycleStatus,
  CustomerAccountRestrictionReleaseDecisionStatus,
  CustomerAccountRestrictionStatus,
  OversightIncidentStatus,
  OversightIncidentType,
  Prisma,
  ReviewCaseStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GetAccountHoldSummaryDto } from "./dto/get-account-hold-summary.dto";
import { ListActiveAccountHoldsDto } from "./dto/list-active-account-holds.dto";
import { ListReleasedAccountHoldsDto } from "./dto/list-released-account-holds.dto";

const accountHoldInclude = {
  customerAccount: {
    select: {
      id: true,
      status: true,
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
  oversightIncident: {
    select: {
      id: true,
      incidentType: true,
      status: true,
      reasonCode: true,
      summaryNote: true,
      assignedOperatorId: true,
      openedAt: true,
      updatedAt: true
    }
  },
  releaseReviewCase: {
    select: {
      id: true,
      status: true,
      assignedOperatorId: true
    }
  }
} satisfies Prisma.CustomerAccountRestrictionInclude;

type AccountHoldRecord = Prisma.CustomerAccountRestrictionGetPayload<{
  include: typeof accountHoldInclude;
}>;

type AccountHoldProjection = {
  hold: {
    id: string;
    status: CustomerAccountRestrictionStatus;
    restrictionReasonCode: string;
    appliedByOperatorId: string;
    appliedByOperatorRole: string | null;
    appliedNote: string | null;
    previousStatus: AccountLifecycleStatus;
    appliedAt: string;
    releasedAt: string | null;
    releasedByOperatorId: string | null;
    releasedByOperatorRole: string | null;
    releaseNote: string | null;
    restoredStatus: AccountLifecycleStatus | null;
    holdDurationMs: number | null;
  };
  customer: {
    customerId: string;
    customerAccountId: string;
    status: AccountLifecycleStatus;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  oversightIncident: {
    id: string;
    incidentType: OversightIncidentType;
    status: OversightIncidentStatus;
    reasonCode: string | null;
    summaryNote: string | null;
    assignedOperatorId: string | null;
    openedAt: string;
    updatedAt: string;
  };
  releaseReview: {
    reviewCaseId: string | null;
    reviewCaseStatus: ReviewCaseStatus | null;
    reviewCaseAssignedOperatorId: string | null;
    decisionStatus: CustomerAccountRestrictionReleaseDecisionStatus;
    requestedAt: string | null;
    requestedByOperatorId: string | null;
    requestNote: string | null;
    decidedAt: string | null;
    decidedByOperatorId: string | null;
    decisionNote: string | null;
  };
};

type ListAccountHoldsResult = {
  holds: AccountHoldProjection[];
  limit: number;
};

type AccountHoldSummaryResult = {
  totalHolds: number;
  activeHolds: number;
  releasedHolds: number;
  byIncidentType: {
    incidentType: OversightIncidentType;
    count: number;
  }[];
  byReasonCode: {
    restrictionReasonCode: string;
    count: number;
  }[];
  byAppliedOperator: {
    appliedByOperatorId: string;
    appliedByOperatorRole: string | null;
    count: number;
  }[];
  byReleasedOperator: {
    releasedByOperatorId: string;
    releasedByOperatorRole: string | null;
    count: number;
  }[];
};

@Injectable()
export class AccountHoldReportingService {
  constructor(private readonly prismaService: PrismaService) {}

  private buildSinceDate(sinceDays: number): Date {
    const now = new Date();
    const sinceDate = new Date(now);
    sinceDate.setUTCDate(now.getUTCDate() - sinceDays);
    return sinceDate;
  }

  private mapAccountHoldProjection(
    restriction: AccountHoldRecord
  ): AccountHoldProjection {
    return {
      hold: {
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
        restoredStatus: restriction.restoredStatus,
        holdDurationMs: restriction.releasedAt
          ? restriction.releasedAt.getTime() - restriction.appliedAt.getTime()
          : null
      },
      customer: {
        customerId: restriction.customerAccount.customer.id,
        customerAccountId: restriction.customerAccount.id,
        status: restriction.customerAccount.status,
        supabaseUserId: restriction.customerAccount.customer.supabaseUserId,
        email: restriction.customerAccount.customer.email,
        firstName: restriction.customerAccount.customer.firstName ?? "",
        lastName: restriction.customerAccount.customer.lastName ?? ""
      },
      oversightIncident: {
        id: restriction.oversightIncident.id,
        incidentType: restriction.oversightIncident.incidentType,
        status: restriction.oversightIncident.status,
        reasonCode: restriction.oversightIncident.reasonCode,
        summaryNote: restriction.oversightIncident.summaryNote,
        assignedOperatorId: restriction.oversightIncident.assignedOperatorId,
        openedAt: restriction.oversightIncident.openedAt.toISOString(),
        updatedAt: restriction.oversightIncident.updatedAt.toISOString()
      },
      releaseReview: {
        reviewCaseId: restriction.releaseReviewCaseId,
        reviewCaseStatus: restriction.releaseReviewCase?.status ?? null,
        reviewCaseAssignedOperatorId:
          restriction.releaseReviewCase?.assignedOperatorId ?? null,
        decisionStatus: restriction.releaseDecisionStatus,
        requestedAt: restriction.releaseRequestedAt?.toISOString() ?? null,
        requestedByOperatorId: restriction.releaseRequestedByOperatorId,
        requestNote: restriction.releaseRequestNote,
        decidedAt: restriction.releaseDecidedAt?.toISOString() ?? null,
        decidedByOperatorId: restriction.releaseDecidedByOperatorId,
        decisionNote: restriction.releaseDecisionNote
      }
    };
  }

  private buildAccountHoldWhereInput(query: {
    status?: CustomerAccountRestrictionStatus;
    incidentType?:
      | "customer_manual_resolution_spike"
      | "operator_manual_resolution_spike";
    restrictionReasonCode?: string;
    appliedByOperatorId?: string;
    releasedByOperatorId?: string;
    releaseDecisionStatus?:
      | "not_requested"
      | "pending"
      | "approved"
      | "denied";
    email?: string;
    sinceDays?: number;
    sinceField?: "appliedAt" | "releasedAt";
  }): Prisma.CustomerAccountRestrictionWhereInput {
    const where: Prisma.CustomerAccountRestrictionWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.restrictionReasonCode?.trim()) {
      where.restrictionReasonCode = query.restrictionReasonCode.trim();
    }

    if (query.appliedByOperatorId?.trim()) {
      where.appliedByOperatorId = query.appliedByOperatorId.trim();
    }

    if (query.releasedByOperatorId?.trim()) {
      where.releasedByOperatorId = query.releasedByOperatorId.trim();
    }

    if (query.releaseDecisionStatus) {
      where.releaseDecisionStatus =
        query.releaseDecisionStatus as CustomerAccountRestrictionReleaseDecisionStatus;
    }

    if (query.incidentType) {
      where.oversightIncident = {
        is: {
          incidentType: query.incidentType as OversightIncidentType
        }
      };
    }

    if (query.email?.trim()) {
      where.customerAccount = {
        is: {
          customer: {
            is: {
              email: query.email.trim().toLowerCase()
            }
          }
        }
      };
    }

    if (query.sinceDays && query.sinceField) {
      where[query.sinceField] = {
        gte: this.buildSinceDate(query.sinceDays)
      };
    }

    return where;
  }

  private buildAccountHoldSummaryWhereInput(
    query: GetAccountHoldSummaryDto
  ): Prisma.CustomerAccountRestrictionWhereInput {
    const where = this.buildAccountHoldWhereInput({
      incidentType: query.incidentType,
      restrictionReasonCode: query.restrictionReasonCode,
      appliedByOperatorId: query.appliedByOperatorId,
      releasedByOperatorId: query.releasedByOperatorId,
      releaseDecisionStatus: query.releaseDecisionStatus
    });

    if (!query.sinceDays) {
      return where;
    }

    const sinceDate = this.buildSinceDate(query.sinceDays);

    return {
      AND: [
        where,
        {
          OR: [
            {
              appliedAt: {
                gte: sinceDate
              }
            },
            {
              releasedAt: {
                gte: sinceDate
              }
            }
          ]
        }
      ]
    };
  }

  async listActiveAccountHolds(
    query: ListActiveAccountHoldsDto
  ): Promise<ListAccountHoldsResult> {
    const limit = query.limit ?? 20;

    const holds = await this.prismaService.customerAccountRestriction.findMany({
      where: this.buildAccountHoldWhereInput({
        status: CustomerAccountRestrictionStatus.active,
        incidentType: query.incidentType,
        restrictionReasonCode: query.restrictionReasonCode,
        appliedByOperatorId: query.appliedByOperatorId,
        releaseDecisionStatus: query.releaseDecisionStatus,
        email: query.email
      }),
      orderBy: {
        appliedAt: "desc"
      },
      take: limit,
      include: accountHoldInclude
    });

    return {
      holds: holds.map((restriction) =>
        this.mapAccountHoldProjection(restriction)
      ),
      limit
    };
  }

  async listReleasedAccountHolds(
    query: ListReleasedAccountHoldsDto
  ): Promise<ListAccountHoldsResult> {
    const limit = query.limit ?? 20;

    const holds = await this.prismaService.customerAccountRestriction.findMany({
      where: this.buildAccountHoldWhereInput({
        status: CustomerAccountRestrictionStatus.released,
        incidentType: query.incidentType,
        restrictionReasonCode: query.restrictionReasonCode,
        appliedByOperatorId: query.appliedByOperatorId,
        releasedByOperatorId: query.releasedByOperatorId,
        releaseDecisionStatus: query.releaseDecisionStatus,
        email: query.email,
        sinceDays: query.sinceDays,
        sinceField: "releasedAt"
      }),
      orderBy: {
        releasedAt: "desc"
      },
      take: limit,
      include: accountHoldInclude
    });

    return {
      holds: holds.map((restriction) =>
        this.mapAccountHoldProjection(restriction)
      ),
      limit
    };
  }

  async getAccountHoldSummary(
    query: GetAccountHoldSummaryDto
  ): Promise<AccountHoldSummaryResult> {
    const holds = await this.prismaService.customerAccountRestriction.findMany({
      where: this.buildAccountHoldSummaryWhereInput(query),
      select: {
        status: true,
        restrictionReasonCode: true,
        appliedByOperatorId: true,
        appliedByOperatorRole: true,
        releasedByOperatorId: true,
        releasedByOperatorRole: true,
        oversightIncident: {
          select: {
            incidentType: true
          }
        }
      }
    });

    const byIncidentType = new Map<string, number>();
    const byReasonCode = new Map<string, number>();
    const byAppliedOperator = new Map<
      string,
      { appliedByOperatorRole: string | null; count: number }
    >();
    const byReleasedOperator = new Map<
      string,
      { releasedByOperatorRole: string | null; count: number }
    >();

    let activeHolds = 0;
    let releasedHolds = 0;

    for (const hold of holds) {
      if (hold.status === CustomerAccountRestrictionStatus.active) {
        activeHolds += 1;
      }

      if (hold.status === CustomerAccountRestrictionStatus.released) {
        releasedHolds += 1;
      }

      byIncidentType.set(
        hold.oversightIncident.incidentType,
        (byIncidentType.get(hold.oversightIncident.incidentType) ?? 0) + 1
      );

      byReasonCode.set(
        hold.restrictionReasonCode,
        (byReasonCode.get(hold.restrictionReasonCode) ?? 0) + 1
      );

      const appliedOperatorAggregate = byAppliedOperator.get(
        hold.appliedByOperatorId
      );
      byAppliedOperator.set(hold.appliedByOperatorId, {
        appliedByOperatorRole: hold.appliedByOperatorRole,
        count: (appliedOperatorAggregate?.count ?? 0) + 1
      });

      if (hold.releasedByOperatorId) {
        const releasedOperatorAggregate = byReleasedOperator.get(
          hold.releasedByOperatorId
        );
        byReleasedOperator.set(hold.releasedByOperatorId, {
          releasedByOperatorRole: hold.releasedByOperatorRole,
          count: (releasedOperatorAggregate?.count ?? 0) + 1
        });
      }
    }

    return {
      totalHolds: holds.length,
      activeHolds,
      releasedHolds,
      byIncidentType: Array.from(byIncidentType.entries())
        .map(([incidentType, count]) => ({
          incidentType: incidentType as OversightIncidentType,
          count
        }))
        .sort(
          (left, right) =>
            right.count - left.count ||
            left.incidentType.localeCompare(right.incidentType)
        ),
      byReasonCode: Array.from(byReasonCode.entries())
        .map(([restrictionReasonCode, count]) => ({
          restrictionReasonCode,
          count
        }))
        .sort(
          (left, right) =>
            right.count - left.count ||
            left.restrictionReasonCode.localeCompare(right.restrictionReasonCode)
        ),
      byAppliedOperator: Array.from(byAppliedOperator.entries())
        .map(([appliedByOperatorId, aggregate]) => ({
          appliedByOperatorId,
          appliedByOperatorRole: aggregate.appliedByOperatorRole,
          count: aggregate.count
        }))
        .sort(
          (left, right) =>
            right.count - left.count ||
            left.appliedByOperatorId.localeCompare(right.appliedByOperatorId)
        ),
      byReleasedOperator: Array.from(byReleasedOperator.entries())
        .map(([releasedByOperatorId, aggregate]) => ({
          releasedByOperatorId,
          releasedByOperatorRole: aggregate.releasedByOperatorRole,
          count: aggregate.count
        }))
        .sort(
          (left, right) =>
            right.count - left.count ||
            left.releasedByOperatorId.localeCompare(right.releasedByOperatorId)
        )
    };
  }
}
