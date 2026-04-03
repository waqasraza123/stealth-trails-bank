import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadAccountHoldPolicyRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  AccountLifecycleStatus,
  CustomerAccountRestrictionReleaseDecisionStatus,
  CustomerAccountRestrictionStatus,
  OversightIncidentEventType,
  OversightIncidentStatus,
  OversightIncidentType,
  Prisma,
  ReviewCaseEventType,
  ReviewCaseStatus,
  ReviewCaseType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DecideAccountReleaseDto } from "./dto/decide-account-release.dto";
import { ListPendingAccountReleaseReviewsDto } from "./dto/list-pending-account-release-reviews.dto";
import { RequestAccountReleaseDto } from "./dto/request-account-release.dto";

const reviewCaseSummarySelect = {
  id: true,
  customerId: true,
  customerAccountId: true,
  type: true,
  status: true,
  reasonCode: true,
  notes: true,
  assignedOperatorId: true,
  startedAt: true,
  resolvedAt: true,
  dismissedAt: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ReviewCaseSelect;

const linkedRestrictionInclude = {
  customerAccount: {
    select: {
      id: true,
      customerId: true,
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
    select: reviewCaseSummarySelect
  }
} satisfies Prisma.CustomerAccountRestrictionInclude;

type ReviewCaseSummaryRecord = Prisma.ReviewCaseGetPayload<{
  select: typeof reviewCaseSummarySelect;
}>;

type LinkedRestrictionRecord = Prisma.CustomerAccountRestrictionGetPayload<{
  include: typeof linkedRestrictionInclude;
}>;

type ReviewCaseSummaryProjection = {
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
};

type AccountRestrictionProjection = {
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
  releaseDecisionStatus: CustomerAccountRestrictionReleaseDecisionStatus;
  releaseRequestedAt: string | null;
  releaseRequestedByOperatorId: string | null;
  releaseRequestNote: string | null;
  releaseDecidedAt: string | null;
  releaseDecidedByOperatorId: string | null;
  releaseDecisionNote: string | null;
  releaseReviewCaseId: string | null;
};

type AccountReleaseReviewProjection = {
  reviewCase: ReviewCaseSummaryProjection;
  restriction: AccountRestrictionProjection;
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
};

type UpdateAccountReleaseReviewResult = {
  accountReleaseReview: AccountReleaseReviewProjection;
  stateReused: boolean;
};

type ListPendingAccountReleaseReviewsResult = {
  reviews: AccountReleaseReviewProjection[];
  limit: number;
};

@Injectable()
export class AccountRestrictionReleaseReviewService {
  private readonly accountHoldReleaseAllowedOperatorRoles: string[];

  constructor(private readonly prismaService: PrismaService) {
    this.accountHoldReleaseAllowedOperatorRoles = [
      ...loadAccountHoldPolicyRuntimeConfig()
        .accountHoldReleaseAllowedOperatorRoles
    ];
  }

  private normalizeOperatorRole(operatorRole?: string): string | null {
    const normalizedOperatorRole = operatorRole?.trim().toLowerCase() ?? null;
    return normalizedOperatorRole && normalizedOperatorRole.length > 0
      ? normalizedOperatorRole
      : null;
  }

  private assertCanDecideAccountRelease(operatorRole?: string): string | null {
    const normalizedOperatorRole = this.normalizeOperatorRole(operatorRole);

    if (
      !normalizedOperatorRole ||
      !this.accountHoldReleaseAllowedOperatorRoles.includes(normalizedOperatorRole)
    ) {
      throw new ForbiddenException(
        "Operator role is not authorized to decide account hold release reviews."
      );
    }

    return normalizedOperatorRole;
  }

  private async appendReviewCaseEvent(
    client: Prisma.TransactionClient,
    reviewCaseId: string,
    actorId: string,
    eventType: ReviewCaseEventType,
    note: string | null,
    metadata: Prisma.InputJsonValue | null
  ): Promise<void> {
    await client.reviewCaseEvent.create({
      data: {
        reviewCaseId,
        actorType: "operator",
        actorId,
        eventType,
        note,
        metadata: metadata ?? Prisma.JsonNull
      }
    });
  }

  private mapReviewCaseProjection(
    reviewCase: ReviewCaseSummaryRecord
  ): ReviewCaseSummaryProjection {
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
      updatedAt: reviewCase.updatedAt.toISOString()
    };
  }

  private mapRestrictionProjection(
    restriction: LinkedRestrictionRecord
  ): AccountRestrictionProjection {
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
      restoredStatus: restriction.restoredStatus,
      releaseDecisionStatus: restriction.releaseDecisionStatus,
      releaseRequestedAt: restriction.releaseRequestedAt?.toISOString() ?? null,
      releaseRequestedByOperatorId: restriction.releaseRequestedByOperatorId,
      releaseRequestNote: restriction.releaseRequestNote,
      releaseDecidedAt: restriction.releaseDecidedAt?.toISOString() ?? null,
      releaseDecidedByOperatorId: restriction.releaseDecidedByOperatorId,
      releaseDecisionNote: restriction.releaseDecisionNote,
      releaseReviewCaseId: restriction.releaseReviewCaseId
    };
  }

  private mapAccountReleaseReviewProjection(
    restriction: LinkedRestrictionRecord
  ): AccountReleaseReviewProjection {
    return {
      reviewCase: this.mapReviewCaseProjection(restriction.releaseReviewCase!),
      restriction: this.mapRestrictionProjection(restriction),
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
      }
    };
  }

  private ensureReviewCaseSupportsAccountRelease(
    reviewCase: ReviewCaseSummaryRecord
  ): void {
    if (reviewCase.type !== ReviewCaseType.account_review) {
      throw new ConflictException(
        "Review case does not support account release review."
      );
    }
  }

  private ensureReviewCaseIsActionable(
    reviewCase: ReviewCaseSummaryRecord
  ): void {
    if (reviewCase.status === ReviewCaseStatus.resolved) {
      throw new ConflictException("Review case is already resolved.");
    }

    if (reviewCase.status === ReviewCaseStatus.dismissed) {
      throw new ConflictException("Review case is already dismissed.");
    }
  }

  private async findReviewCaseById(
    reviewCaseId: string
  ): Promise<ReviewCaseSummaryRecord | null> {
    return this.prismaService.reviewCase.findUnique({
      where: {
        id: reviewCaseId
      },
      select: reviewCaseSummarySelect
    });
  }

  private async findLinkedRestrictionByReviewCaseId(
    reviewCaseId: string
  ): Promise<LinkedRestrictionRecord | null> {
    return this.prismaService.customerAccountRestriction.findFirst({
      where: {
        releaseReviewCaseId: reviewCaseId
      },
      orderBy: {
        appliedAt: "desc"
      },
      include: linkedRestrictionInclude
    });
  }

  private buildPendingReleaseReviewWhereInput(
    query: ListPendingAccountReleaseReviewsDto
  ): Prisma.CustomerAccountRestrictionWhereInput {
    const where: Prisma.CustomerAccountRestrictionWhereInput = {
      status: CustomerAccountRestrictionStatus.active,
      releaseDecisionStatus:
        CustomerAccountRestrictionReleaseDecisionStatus.pending,
      releaseReviewCase: {
        is: {
          type: ReviewCaseType.account_review,
          status: {
            in: [ReviewCaseStatus.open, ReviewCaseStatus.in_progress]
          }
        }
      }
    };

    if (query.incidentType) {
      where.oversightIncident = {
        is: {
          incidentType: query.incidentType as OversightIncidentType
        }
      };
    }

    if (query.restrictionReasonCode?.trim()) {
      where.restrictionReasonCode = query.restrictionReasonCode.trim();
    }

    if (query.requestedByOperatorId?.trim()) {
      where.releaseRequestedByOperatorId = query.requestedByOperatorId.trim();
    }

    if (query.assignedOperatorId?.trim()) {
      where.releaseReviewCase = {
        is: {
          type: ReviewCaseType.account_review,
          status: {
            in: [ReviewCaseStatus.open, ReviewCaseStatus.in_progress]
          },
          assignedOperatorId: query.assignedOperatorId.trim()
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

    return where;
  }

  private async getRequiredLinkedReleaseContext(
    reviewCaseId: string
  ): Promise<{
    reviewCase: ReviewCaseSummaryRecord;
    restriction: LinkedRestrictionRecord;
  }> {
    const [reviewCase, restriction] = await Promise.all([
      this.findReviewCaseById(reviewCaseId),
      this.findLinkedRestrictionByReviewCaseId(reviewCaseId)
    ]);

    if (!reviewCase) {
      throw new NotFoundException("Review case not found.");
    }

    this.ensureReviewCaseSupportsAccountRelease(reviewCase);

    if (!restriction || !restriction.releaseReviewCase) {
      throw new ConflictException(
        "Review case is not linked to an account restriction release record."
      );
    }

    return {
      reviewCase,
      restriction
    };
  }

  async requestAccountRelease(
    reviewCaseId: string,
    operatorId: string,
    dto: RequestAccountReleaseDto
  ): Promise<UpdateAccountReleaseReviewResult> {
    const { reviewCase, restriction } =
      await this.getRequiredLinkedReleaseContext(reviewCaseId);

    this.ensureReviewCaseIsActionable(reviewCase);

    if (restriction.status !== CustomerAccountRestrictionStatus.active) {
      throw new ConflictException(
        "Account restriction is not currently active."
      );
    }

    if (
      restriction.releaseDecisionStatus ===
      CustomerAccountRestrictionReleaseDecisionStatus.pending
    ) {
      return {
        accountReleaseReview:
          this.mapAccountReleaseReviewProjection(restriction),
        stateReused: true
      };
    }

    if (
      restriction.releaseDecisionStatus ===
      CustomerAccountRestrictionReleaseDecisionStatus.approved
    ) {
      throw new ConflictException(
        "Account restriction release has already been approved."
      );
    }

    const note = dto.note?.trim() ?? null;
    const releaseRequestedAt = new Date();

    const updatedRestriction = await this.prismaService.$transaction(
      async (transaction) => {
        const updateResult =
          await transaction.customerAccountRestriction.updateMany({
            where: {
              id: restriction.id,
              status: CustomerAccountRestrictionStatus.active
            },
            data: {
              releaseDecisionStatus:
                CustomerAccountRestrictionReleaseDecisionStatus.pending,
              releaseRequestedAt,
              releaseRequestedByOperatorId: operatorId,
              releaseRequestNote: note,
              releaseDecidedAt: null,
              releaseDecidedByOperatorId: null,
              releaseDecisionNote: null
            }
          });

        if (updateResult.count !== 1) {
          throw new ConflictException(
            "Account restriction is no longer active."
          );
        }

        await this.appendReviewCaseEvent(
          transaction,
          reviewCase.id,
          operatorId,
          ReviewCaseEventType.account_release_requested,
          note,
          {
            restrictionRecordId: restriction.id,
            restrictionStatus: restriction.status,
            releaseDecisionStatus:
              CustomerAccountRestrictionReleaseDecisionStatus.pending,
            releaseRequestedAt: releaseRequestedAt.toISOString(),
            releaseRequestedByOperatorId: operatorId
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: reviewCase.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "customer_account.release_review_requested",
            targetType: "CustomerAccount",
            targetId: restriction.customerAccount.id,
            metadata: {
              restrictionRecordId: restriction.id,
              reviewCaseId: reviewCase.id,
              oversightIncidentId: restriction.oversightIncident.id,
              releaseDecisionStatus:
                CustomerAccountRestrictionReleaseDecisionStatus.pending,
              note,
              releaseRequestedAt: releaseRequestedAt.toISOString(),
              releaseRequestedByOperatorId: operatorId
            } as Prisma.InputJsonValue
          }
        });

        return transaction.customerAccountRestriction.findUniqueOrThrow({
          where: {
            id: restriction.id
          },
          include: linkedRestrictionInclude
        });
      }
    );

    return {
      accountReleaseReview:
        this.mapAccountReleaseReviewProjection(updatedRestriction),
      stateReused: false
    };
  }

  async listPendingAccountReleaseReviews(
    query: ListPendingAccountReleaseReviewsDto
  ): Promise<ListPendingAccountReleaseReviewsResult> {
    const limit = query.limit ?? 20;
    const reviews = await this.prismaService.customerAccountRestriction.findMany({
      where: this.buildPendingReleaseReviewWhereInput(query),
      orderBy: {
        releaseRequestedAt: "desc"
      },
      take: limit,
      include: linkedRestrictionInclude
    });

    return {
      reviews: reviews.map((restriction) =>
        this.mapAccountReleaseReviewProjection(restriction)
      ),
      limit
    };
  }

  async decideAccountRelease(
    reviewCaseId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: DecideAccountReleaseDto
  ): Promise<UpdateAccountReleaseReviewResult> {
    const normalizedOperatorRole =
      this.assertCanDecideAccountRelease(operatorRole);
    const { reviewCase, restriction } =
      await this.getRequiredLinkedReleaseContext(reviewCaseId);

    if (
      dto.decision === "approved" &&
      restriction.status === CustomerAccountRestrictionStatus.released &&
      restriction.releaseDecisionStatus ===
        CustomerAccountRestrictionReleaseDecisionStatus.approved
    ) {
      return {
        accountReleaseReview:
          this.mapAccountReleaseReviewProjection(restriction),
        stateReused: true
      };
    }

    if (
      dto.decision === "denied" &&
      restriction.status === CustomerAccountRestrictionStatus.active &&
      restriction.releaseDecisionStatus ===
        CustomerAccountRestrictionReleaseDecisionStatus.denied
    ) {
      return {
        accountReleaseReview:
          this.mapAccountReleaseReviewProjection(restriction),
        stateReused: true
      };
    }

    this.ensureReviewCaseIsActionable(reviewCase);

    if (restriction.status !== CustomerAccountRestrictionStatus.active) {
      throw new ConflictException(
        "Account restriction is not currently active."
      );
    }

    if (
      restriction.releaseDecisionStatus !==
      CustomerAccountRestrictionReleaseDecisionStatus.pending
    ) {
      throw new ConflictException(
        "Account release review is not currently pending."
      );
    }

    const decisionNote = dto.note?.trim() ?? null;
    const releaseDecidedAt = new Date();

    if (dto.decision === "approved") {
      if (
        restriction.customerAccount.status !== AccountLifecycleStatus.restricted ||
        restriction.customerAccount.restrictedByOversightIncidentId !==
          restriction.oversightIncident.id
      ) {
        throw new ConflictException(
          "Customer account is not currently held by the linked oversight incident."
        );
      }

      const restoredStatus =
        restriction.previousStatus ?? AccountLifecycleStatus.registered;

      const updatedRestriction = await this.prismaService.$transaction(
        async (transaction) => {
          const restrictionUpdateResult =
            await transaction.customerAccountRestriction.updateMany({
              where: {
                id: restriction.id,
                status: CustomerAccountRestrictionStatus.active,
                releaseDecisionStatus:
                  CustomerAccountRestrictionReleaseDecisionStatus.pending
              },
              data: {
                status: CustomerAccountRestrictionStatus.released,
                releasedAt: releaseDecidedAt,
                releasedByOperatorId: operatorId,
                releasedByOperatorRole: normalizedOperatorRole,
                releaseNote: decisionNote,
                restoredStatus,
                releaseDecisionStatus:
                  CustomerAccountRestrictionReleaseDecisionStatus.approved,
                releaseDecidedAt,
                releaseDecidedByOperatorId: operatorId,
                releaseDecisionNote: decisionNote
              }
            });

          if (restrictionUpdateResult.count !== 1) {
            throw new ConflictException(
              "Account release review was already decided."
            );
          }

          const customerAccountUpdateResult =
            await transaction.customerAccount.updateMany({
              where: {
                id: restriction.customerAccount.id,
                status: AccountLifecycleStatus.restricted,
                restrictedByOversightIncidentId: restriction.oversightIncident.id
              },
              data: {
                status: restoredStatus,
                restrictionReleasedAt: releaseDecidedAt,
                restrictionReleasedByOperatorId: operatorId
              }
            });

          if (customerAccountUpdateResult.count !== 1) {
            throw new ConflictException(
              "Customer account hold is no longer active."
            );
          }

          await transaction.reviewCase.update({
            where: {
              id: reviewCase.id
            },
            data: {
              status: ReviewCaseStatus.resolved,
              resolvedAt: releaseDecidedAt,
              assignedOperatorId: reviewCase.assignedOperatorId ?? operatorId,
              notes: decisionNote ?? reviewCase.notes
            }
          });

          await this.appendReviewCaseEvent(
            transaction,
            reviewCase.id,
            operatorId,
            ReviewCaseEventType.account_release_approved,
            decisionNote,
            {
              restrictionRecordId: restriction.id,
              previousRestrictionStatus: restriction.status,
              newRestrictionStatus: CustomerAccountRestrictionStatus.released,
              restoredStatus,
              releaseDecisionStatus:
                CustomerAccountRestrictionReleaseDecisionStatus.approved,
              releaseDecidedAt: releaseDecidedAt.toISOString(),
              releaseDecidedByOperatorId: operatorId,
              releaseDecidedByOperatorRole: normalizedOperatorRole
            } as Prisma.InputJsonValue
          );

          await this.appendReviewCaseEvent(
            transaction,
            reviewCase.id,
            operatorId,
            ReviewCaseEventType.resolved,
            decisionNote,
            {
              previousStatus: reviewCase.status,
              newStatus: ReviewCaseStatus.resolved
            } as Prisma.InputJsonValue
          );

          await transaction.oversightIncidentEvent.create({
            data: {
              oversightIncidentId: restriction.oversightIncident.id,
              actorType: "operator",
              actorId: operatorId,
              eventType: OversightIncidentEventType.account_restriction_released,
              note: decisionNote,
              metadata: {
                restrictionRecordId: restriction.id,
                previousAccountStatus: restriction.customerAccount.status,
                newAccountStatus: restoredStatus,
                restrictionReasonCode: restriction.restrictionReasonCode,
                releasedByOperatorId: operatorId,
                releasedByOperatorRole: normalizedOperatorRole,
                releasedAt: releaseDecidedAt.toISOString(),
                restoredStatus,
                reviewCaseId: reviewCase.id
              } as Prisma.InputJsonValue
            }
          });

          await transaction.auditEvent.create({
            data: {
              customerId: reviewCase.customerId,
              actorType: "operator",
              actorId: operatorId,
              action: "customer_account.restriction_released",
              targetType: "CustomerAccount",
              targetId: restriction.customerAccount.id,
              metadata: {
                restrictionRecordId: restriction.id,
                reviewCaseId: reviewCase.id,
                oversightIncidentId: restriction.oversightIncident.id,
                previousStatus: restriction.customerAccount.status,
                newStatus: restoredStatus,
                restrictionReasonCode: restriction.restrictionReasonCode,
                note: decisionNote,
                releasedByOperatorId: operatorId,
                releasedByOperatorRole: normalizedOperatorRole,
                releasedAt: releaseDecidedAt.toISOString(),
                restoredStatus
              } as Prisma.InputJsonValue
            }
          });

          await transaction.auditEvent.create({
            data: {
              customerId: reviewCase.customerId,
              actorType: "operator",
              actorId: operatorId,
              action: "review_case.resolved",
              targetType: "ReviewCase",
              targetId: reviewCase.id,
              metadata: {
                previousStatus: reviewCase.status,
                newStatus: ReviewCaseStatus.resolved,
                note: decisionNote,
                reviewCaseType: reviewCase.type,
                customerAccountId: reviewCase.customerAccountId
              } as Prisma.InputJsonValue
            }
          });

          return transaction.customerAccountRestriction.findUniqueOrThrow({
            where: {
              id: restriction.id
            },
            include: linkedRestrictionInclude
          });
        }
      );

      return {
        accountReleaseReview:
          this.mapAccountReleaseReviewProjection(updatedRestriction),
        stateReused: false
      };
    }

    const updatedRestriction = await this.prismaService.$transaction(
      async (transaction) => {
        const restrictionUpdateResult =
          await transaction.customerAccountRestriction.updateMany({
            where: {
              id: restriction.id,
              status: CustomerAccountRestrictionStatus.active,
              releaseDecisionStatus:
                CustomerAccountRestrictionReleaseDecisionStatus.pending
            },
            data: {
              releaseDecisionStatus:
                CustomerAccountRestrictionReleaseDecisionStatus.denied,
              releaseDecidedAt,
              releaseDecidedByOperatorId: operatorId,
              releaseDecisionNote: decisionNote
            }
          });

        if (restrictionUpdateResult.count !== 1) {
          throw new ConflictException(
            "Account release review was already decided."
          );
        }

        if (reviewCase.status === ReviewCaseStatus.open) {
          await transaction.reviewCase.update({
            where: {
              id: reviewCase.id
            },
            data: {
              status: ReviewCaseStatus.in_progress,
              startedAt: reviewCase.startedAt ?? releaseDecidedAt,
              notes: decisionNote ?? reviewCase.notes
            }
          });
        }

        await this.appendReviewCaseEvent(
          transaction,
          reviewCase.id,
          operatorId,
          ReviewCaseEventType.account_release_denied,
          decisionNote,
          {
            restrictionRecordId: restriction.id,
            restrictionStatus: restriction.status,
            releaseDecisionStatus:
              CustomerAccountRestrictionReleaseDecisionStatus.denied,
            releaseDecidedAt: releaseDecidedAt.toISOString(),
            releaseDecidedByOperatorId: operatorId,
            releaseDecidedByOperatorRole: normalizedOperatorRole
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: reviewCase.customerId,
            actorType: "operator",
            actorId: operatorId,
            action: "customer_account.release_review_denied",
            targetType: "CustomerAccount",
            targetId: restriction.customerAccount.id,
            metadata: {
              restrictionRecordId: restriction.id,
              reviewCaseId: reviewCase.id,
              oversightIncidentId: restriction.oversightIncident.id,
              note: decisionNote,
              releaseDecidedAt: releaseDecidedAt.toISOString(),
              releaseDecidedByOperatorId: operatorId,
              releaseDecidedByOperatorRole: normalizedOperatorRole
            } as Prisma.InputJsonValue
          }
        });

        return transaction.customerAccountRestriction.findUniqueOrThrow({
          where: {
            id: restriction.id
          },
          include: linkedRestrictionInclude
        });
      }
    );

    return {
      accountReleaseReview:
        this.mapAccountReleaseReviewProjection(updatedRestriction),
      stateReused: false
    };
  }
}
