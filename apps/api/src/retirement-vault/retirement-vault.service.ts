import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  loadAccountHoldPolicyRuntimeConfig,
  loadProductChainRuntimeConfig,
} from "@stealth-trails-bank/config/api";
import {
  AccountLifecycleStatus,
  AssetStatus,
  OversightIncidentStatus,
  PolicyDecision,
  Prisma,
  RetirementVaultEventType,
  RetirementVaultReleaseRequestKind,
  RetirementVaultReleaseRequestStatus,
  RetirementVaultRuleChangeRequestStatus,
  RetirementVaultStatus,
  ReviewCaseEventType,
  ReviewCaseStatus,
  ReviewCaseType,
  TransactionIntentStatus,
  TransactionIntentType,
} from "@prisma/client";
import {
  assertOperatorRoleAuthorized,
  normalizeOperatorRole,
} from "../auth/internal-operator-role-policy";
import { CustomerAccountOperationsService } from "../customer-account-operations/customer-account-operations.service";
import { LedgerService } from "../ledger/ledger.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { CreateRetirementVaultDto } from "./dto/create-retirement-vault.dto";
import { FundRetirementVaultDto } from "./dto/fund-retirement-vault.dto";
import { GetInternalRetirementVaultWorkspaceDto } from "./dto/get-internal-retirement-vault-workspace.dto";
import { ListInternalRetirementVaultReleaseRequestsDto } from "./dto/list-internal-retirement-vault-release-requests.dto";
import { ListInternalRetirementVaultsDto } from "./dto/list-internal-retirement-vaults.dto";
import { RequestRetirementVaultRuleChangeDto } from "./dto/request-retirement-vault-rule-change.dto";
import { ReleaseRetirementVaultRestrictionDto } from "./dto/release-retirement-vault-restriction.dto";
import { RequestRetirementVaultReleaseDto } from "./dto/request-retirement-vault-release.dto";
import { RestrictRetirementVaultDto } from "./dto/restrict-retirement-vault.dto";

const OPERATOR_RELEASE_APPROVER_ROLES = ["risk_manager", "operations_admin"] as const;
const RESTRICTED_VAULT_OPERATOR_ROLES = ["risk_manager", "operations_admin", "compliance_admin"] as const;
const ACTIVE_RELEASE_REQUEST_STATUSES: RetirementVaultReleaseRequestStatus[] = [
  RetirementVaultReleaseRequestStatus.requested,
  RetirementVaultReleaseRequestStatus.review_required,
  RetirementVaultReleaseRequestStatus.approved,
  RetirementVaultReleaseRequestStatus.cooldown_active,
  RetirementVaultReleaseRequestStatus.ready_for_release,
  RetirementVaultReleaseRequestStatus.executing,
];
const ACTIVE_RULE_CHANGE_REQUEST_STATUSES: RetirementVaultRuleChangeRequestStatus[] = [
  RetirementVaultRuleChangeRequestStatus.review_required,
  RetirementVaultRuleChangeRequestStatus.cooldown_active,
  RetirementVaultRuleChangeRequestStatus.ready_to_apply,
  RetirementVaultRuleChangeRequestStatus.applying,
];
const RETIREMENT_VAULT_REVIEW_STALE_SECONDS = 24 * 60 * 60;
const RETIREMENT_VAULT_RELEASE_STALE_GRACE_SECONDS = 30 * 60;
const RETIREMENT_VAULT_EXECUTING_STALE_SECONDS = 15 * 60;

const retirementVaultAssetSelect = {
  id: true,
  symbol: true,
  displayName: true,
  decimals: true,
  chainId: true,
} satisfies Prisma.AssetSelect;

const releaseRequestIntentSelect = {
  id: true,
  intentType: true,
  status: true,
  policyDecision: true,
  requestedAmount: true,
  settledAmount: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TransactionIntentSelect;

const releaseRequestReviewCaseSelect = {
  id: true,
  type: true,
  status: true,
  reasonCode: true,
  assignedOperatorId: true,
  updatedAt: true,
} satisfies Prisma.ReviewCaseSelect;

const retirementVaultEventOrder = {
  createdAt: "desc",
} satisfies Prisma.RetirementVaultEventOrderByWithRelationInput;

const retirementVaultReleaseRequestInclude = {
  reviewCase: {
    select: releaseRequestReviewCaseSelect,
  },
  transactionIntent: {
    select: releaseRequestIntentSelect,
  },
} satisfies Prisma.RetirementVaultReleaseRequestInclude;

const retirementVaultRuleChangeRequestInclude = {
  reviewCase: {
    select: releaseRequestReviewCaseSelect,
  },
} satisfies Prisma.RetirementVaultRuleChangeRequestInclude;

const internalVaultInclude = {
  asset: {
    select: retirementVaultAssetSelect,
  },
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
          lastName: true,
        },
      },
    },
  },
  releaseRequests: {
    orderBy: {
      requestedAt: "desc",
    },
    include: retirementVaultReleaseRequestInclude,
    take: 12,
  },
  ruleChangeRequests: {
    orderBy: {
      requestedAt: "desc",
    },
    include: retirementVaultRuleChangeRequestInclude,
    take: 12,
  },
  events: {
    orderBy: retirementVaultEventOrder,
    take: 12,
  },
} satisfies Prisma.RetirementVaultInclude;

const retirementVaultInclude = {
  asset: {
    select: retirementVaultAssetSelect,
  },
  releaseRequests: {
    orderBy: {
      requestedAt: "desc",
    },
    include: retirementVaultReleaseRequestInclude,
    take: 10,
  },
  ruleChangeRequests: {
    orderBy: {
      requestedAt: "desc",
    },
    include: retirementVaultRuleChangeRequestInclude,
    take: 10,
  },
  events: {
    orderBy: retirementVaultEventOrder,
    take: 10,
  },
} satisfies Prisma.RetirementVaultInclude;

const internalReleaseRequestInclude = {
  reviewCase: {
    select: releaseRequestReviewCaseSelect,
  },
  transactionIntent: {
    select: releaseRequestIntentSelect,
  },
  retirementVault: {
    include: {
      asset: {
        select: retirementVaultAssetSelect,
      },
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
              lastName: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RetirementVaultReleaseRequestInclude;

const internalRuleChangeRequestInclude = {
  reviewCase: {
    select: releaseRequestReviewCaseSelect,
  },
  retirementVault: {
    include: {
      asset: {
        select: retirementVaultAssetSelect,
      },
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
              lastName: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.RetirementVaultRuleChangeRequestInclude;

type RetirementVaultRecord = Prisma.RetirementVaultGetPayload<{
  include: typeof retirementVaultInclude;
}>;

type RetirementVaultFundingIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: {
    asset: {
      select: typeof retirementVaultAssetSelect;
    };
    retirementVault: {
      select: {
        id: true;
      };
    };
  };
}>;

type InternalReleaseRequestRecord = Prisma.RetirementVaultReleaseRequestGetPayload<{
  include: typeof internalReleaseRequestInclude;
}>;

type InternalRetirementVaultRecord = Prisma.RetirementVaultGetPayload<{
  include: typeof internalVaultInclude;
}>;

type RetirementVaultRuleChangeRequestRecord = Prisma.RetirementVaultRuleChangeRequestGetPayload<{
  include: typeof retirementVaultRuleChangeRequestInclude;
}>;

type InternalRetirementVaultRuleChangeRequestRecord =
  Prisma.RetirementVaultRuleChangeRequestGetPayload<{
    include: typeof internalRuleChangeRequestInclude;
  }>;

type CustomerAssetContext = {
  customerId: string;
  customerAccountId: string;
  assetId: string;
  assetSymbol: string;
  accountStatus: AccountLifecycleStatus;
};

type RetirementVaultReviewCaseSummary = {
  id: string;
  type: ReviewCaseType;
  status: ReviewCaseStatus;
  reasonCode: string | null;
  assignedOperatorId: string | null;
  updatedAt: string;
};

type RetirementVaultReleaseIntentSummary = {
  id: string;
  intentType: TransactionIntentType;
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: string;
  settledAmount: string | null;
  createdAt: string;
  updatedAt: string;
};

type RetirementVaultReleaseRequestProjection = {
  id: string;
  retirementVaultId: string;
  requestKind: RetirementVaultReleaseRequestKind;
  requestedAmount: string;
  status: RetirementVaultReleaseRequestStatus;
  reasonCode: string | null;
  reasonNote: string | null;
  evidence: Prisma.JsonValue | null;
  requestedByActorType: string;
  requestedByActorId: string | null;
  reviewRequiredAt: string | null;
  reviewDecidedAt: string | null;
  cooldownEndsAt: string | null;
  requestedAt: string;
  cooldownStartedAt: string | null;
  readyForReleaseAt: string | null;
  approvedAt: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedAt: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  cancelledAt: string | null;
  cancelledByActorType: string | null;
  cancelledByActorId: string | null;
  executionStartedAt: string | null;
  executedByWorkerId: string | null;
  executionFailureCode: string | null;
  executionFailureReason: string | null;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewCase: RetirementVaultReviewCaseSummary | null;
  transactionIntent: RetirementVaultReleaseIntentSummary | null;
};

type RetirementVaultEventProjection = {
  id: string;
  eventType: RetirementVaultEventType;
  actorType: string;
  actorId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

type RetirementVaultRuleChangeRequestProjection = {
  id: string;
  retirementVaultId: string;
  status: RetirementVaultRuleChangeRequestStatus;
  requestedByActorType: string;
  requestedByActorId: string | null;
  currentUnlockAt: string;
  requestedUnlockAt: string;
  currentStrictMode: boolean;
  requestedStrictMode: boolean;
  weakensProtection: boolean;
  reasonCode: string | null;
  reasonNote: string | null;
  reviewRequiredAt: string | null;
  reviewDecidedAt: string | null;
  requestedAt: string;
  cooldownStartedAt: string | null;
  cooldownEndsAt: string | null;
  approvedAt: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedAt: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  cancelledAt: string | null;
  cancelledByActorType: string | null;
  cancelledByActorId: string | null;
  applyStartedAt: string | null;
  appliedAt: string | null;
  appliedByWorkerId: string | null;
  applyFailureCode: string | null;
  applyFailureReason: string | null;
  createdAt: string;
  updatedAt: string;
  reviewCase: RetirementVaultReviewCaseSummary | null;
};

export type RetirementVaultProjection = {
  id: string;
  customerAccountId: string;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  status: RetirementVaultStatus;
  strictMode: boolean;
  unlockAt: string;
  lockedBalance: string;
  fundedAt: string | null;
  lastFundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  releaseRequests: RetirementVaultReleaseRequestProjection[];
  ruleChangeRequests: RetirementVaultRuleChangeRequestProjection[];
  events: RetirementVaultEventProjection[];
};

type RetirementVaultRestrictionProjection = {
  restrictedAt: string | null;
  restrictionReasonCode: string | null;
  restrictedByOperatorId: string | null;
  restrictedByOperatorRole: string | null;
  restrictedByOversightIncidentId: string | null;
  restrictionNote: string | null;
  restrictionReleasedAt: string | null;
  restrictionReleasedByOperatorId: string | null;
  restrictionReleasedByOperatorRole: string | null;
  restrictionReleaseNote: string | null;
};

type RetirementVaultFundingIntentProjection = {
  id: string;
  retirementVaultId: string | null;
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  intentType: TransactionIntentType;
  status: TransactionIntentStatus;
  policyDecision: PolicyDecision;
  requestedAmount: string;
  settledAmount: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

type InternalRetirementVaultReleaseRequestProjection = RetirementVaultReleaseRequestProjection & {
  retirementVault: {
    id: string;
    status: RetirementVaultStatus;
    strictMode: boolean;
    unlockAt: string;
    lockedBalance: string;
    asset: {
      id: string;
      symbol: string;
      displayName: string;
      decimals: number;
      chainId: number;
    };
    customerAccount: {
      id: string;
      status: AccountLifecycleStatus;
      customer: {
        id: string;
        supabaseUserId: string;
        email: string;
        firstName: string;
        lastName: string;
      };
    };
  };
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

type LinkedOversightIncidentProjection = {
  id: string;
  incidentType: string;
  status: OversightIncidentStatus;
  reasonCode: string | null;
  summaryNote: string | null;
  assignedOperatorId: string | null;
  openedAt: string;
  updatedAt: string;
} | null;

type ListMyRetirementVaultsResult = {
  customerAccountId: string;
  vaults: RetirementVaultProjection[];
};

type CreateMyRetirementVaultResult = {
  vault: RetirementVaultProjection;
  created: boolean;
};

type FundMyRetirementVaultResult = {
  vault: RetirementVaultProjection;
  intent: RetirementVaultFundingIntentProjection;
  idempotencyReused: boolean;
};

type RequestMyRetirementVaultReleaseResult = {
  vault: RetirementVaultProjection;
  releaseRequest: RetirementVaultReleaseRequestProjection;
  reviewCaseReused: boolean;
};

type CancelMyRetirementVaultReleaseResult = {
  vault: RetirementVaultProjection;
  releaseRequest: RetirementVaultReleaseRequestProjection;
};

type RequestMyRetirementVaultRuleChangeResult = {
  vault: RetirementVaultProjection;
  ruleChangeRequest: RetirementVaultRuleChangeRequestProjection;
  reviewCaseReused: boolean;
  appliedImmediately: boolean;
};

type CancelMyRetirementVaultRuleChangeResult = {
  vault: RetirementVaultProjection;
  ruleChangeRequest: RetirementVaultRuleChangeRequestProjection;
};

type ListInternalRetirementVaultReleaseRequestsResult = {
  releaseRequests: InternalRetirementVaultReleaseRequestProjection[];
  limit: number;
};

type GetInternalRetirementVaultReleaseRequestWorkspaceResult = {
  releaseRequest: InternalRetirementVaultReleaseRequestProjection;
  vaultEvents: RetirementVaultEventProjection[];
  relatedAuditEvents: AuditTimelineProjection[];
};

type DecideInternalRetirementVaultReleaseRequestResult = {
  releaseRequest: InternalRetirementVaultReleaseRequestProjection;
  stateReused: boolean;
};

type SweepRetirementVaultReleaseRequestsResult = {
  limit: number;
  readyForReleaseCount: number;
  releasedCount: number;
  failedCount: number;
  blockedReleaseCount: number;
  staleReviewRequiredCount: number;
  staleCooldownCount: number;
  staleReadyForReleaseCount: number;
  staleExecutingCount: number;
  processedReleaseRequestIds: string[];
};

type InternalRetirementVaultProjection = RetirementVaultProjection & {
  restriction: RetirementVaultRestrictionProjection;
  customerAccount: {
    id: string;
    status: AccountLifecycleStatus;
    customer: {
      id: string;
      supabaseUserId: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  };
};

type ListInternalRetirementVaultsResult = {
  vaults: InternalRetirementVaultProjection[];
  limit: number;
};

type GetInternalRetirementVaultWorkspaceResult = {
  vault: InternalRetirementVaultProjection;
  linkedOversightIncident: LinkedOversightIncidentProjection;
  vaultEvents: RetirementVaultEventProjection[];
  relatedAuditEvents: AuditTimelineProjection[];
  customerAccountTimeline: Awaited<
    ReturnType<CustomerAccountOperationsService["listCustomerAccountTimeline"]>
  >;
  recentLimit: number;
};

type UpdateInternalRetirementVaultRestrictionResult = {
  vault: InternalRetirementVaultProjection;
  stateReused: boolean;
};

type DecideInternalRetirementVaultRuleChangeRequestResult = {
  ruleChangeRequest: RetirementVaultRuleChangeRequestProjection;
  stateReused: boolean;
};

type SweepRetirementVaultRuleChangeRequestsResult = {
  limit: number;
  readyToApplyCount: number;
  appliedCount: number;
  failedCount: number;
  blockedRuleChangeCount: number;
  staleReviewRequiredCount: number;
  staleCooldownCount: number;
  staleReadyToApplyCount: number;
  staleApplyingCount: number;
  processedRuleChangeRequestIds: string[];
};

@Injectable()
export class RetirementVaultService {
  private readonly productChainId: number;
  private readonly vaultRestrictionApplyAllowedOperatorRoles: string[];
  private readonly vaultRestrictionReleaseAllowedOperatorRoles: string[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly reviewCasesService: ReviewCasesService,
    private readonly customerAccountOperationsService: CustomerAccountOperationsService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
    const accountHoldPolicy = loadAccountHoldPolicyRuntimeConfig();
    this.vaultRestrictionApplyAllowedOperatorRoles = [
      ...new Set([
        ...accountHoldPolicy.accountHoldApplyAllowedOperatorRoles,
        ...RESTRICTED_VAULT_OPERATOR_ROLES,
      ]),
    ];
    this.vaultRestrictionReleaseAllowedOperatorRoles = [
      ...new Set([
        ...accountHoldPolicy.accountHoldReleaseAllowedOperatorRoles,
        ...RESTRICTED_VAULT_OPERATOR_ROLES,
      ]),
    ];
  }

  private normalizeAssetSymbol(assetSymbol: string): string {
    const normalizedAssetSymbol = assetSymbol.trim().toUpperCase();

    if (!normalizedAssetSymbol) {
      throw new NotFoundException("Asset symbol is required.");
    }

    return normalizedAssetSymbol;
  }

  private normalizeOptionalString(value?: string | null): string | null {
    const normalizedValue = value?.trim() ?? "";
    return normalizedValue.length > 0 ? normalizedValue : null;
  }

  private parseRequestedAmount(amount: string): Prisma.Decimal {
    const requestedAmount = new Prisma.Decimal(amount);

    if (requestedAmount.lte(0)) {
      throw new BadRequestException(
        "Requested amount must be greater than zero."
      );
    }

    return requestedAmount;
  }

  private parseUnlockAt(unlockAt: string): Date {
    const parsedUnlockAt = new Date(unlockAt);

    if (Number.isNaN(parsedUnlockAt.getTime())) {
      throw new BadRequestException("unlockAt must be a valid ISO-8601 date.");
    }

    if (parsedUnlockAt <= new Date()) {
      throw new BadRequestException(
        "Retirement vault unlockAt must be in the future."
      );
    }

    return parsedUnlockAt;
  }

  private parseOptionalUnlockAt(unlockAt?: string): Date | null {
    if (!unlockAt?.trim()) {
      return null;
    }

    return this.parseUnlockAt(unlockAt);
  }

  private assertSensitiveVaultRequestAllowed(
    accountStatus: AccountLifecycleStatus
  ): void {
    if (accountStatus === AccountLifecycleStatus.restricted) {
      throw new ConflictException(
        "Customer account is currently under a risk hold and cannot create retirement vault requests."
      );
    }

    if (
      accountStatus === AccountLifecycleStatus.frozen ||
      accountStatus === AccountLifecycleStatus.closed
    ) {
      throw new ConflictException(
        "Customer account is not eligible for retirement vault requests in its current lifecycle state."
      );
    }
  }

  private async resolveCustomerAssetContext(
    supabaseUserId: string,
    assetSymbol: string
  ): Promise<CustomerAssetContext> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId,
        },
      },
      select: {
        id: true,
        status: true,
        customer: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    this.assertSensitiveVaultRequestAllowed(customerAccount.status);

    const asset = await this.prismaService.asset.findUnique({
      where: {
        chainId_symbol: {
          chainId: this.productChainId,
          symbol: assetSymbol,
        },
      },
      select: {
        id: true,
        symbol: true,
        status: true,
      },
    });

    if (!asset || asset.status !== AssetStatus.active) {
      throw new NotFoundException("Active asset not found for the product chain.");
    }

    return {
      customerId: customerAccount.customer.id,
      customerAccountId: customerAccount.id,
      assetId: asset.id,
      assetSymbol: asset.symbol,
      accountStatus: customerAccount.status,
    };
  }

  private async requireCustomerAccountId(supabaseUserId: string): Promise<string> {
    const customerAccount = await this.prismaService.customerAccount.findFirst({
      where: {
        customer: {
          supabaseUserId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account projection not found.");
    }

    return customerAccount.id;
  }

  private mapReviewCaseSummary(
    reviewCase:
      | {
          id: string;
          type: ReviewCaseType;
          status: ReviewCaseStatus;
          reasonCode: string | null;
          assignedOperatorId: string | null;
          updatedAt: Date;
        }
      | null
      | undefined
  ): RetirementVaultReviewCaseSummary | null {
    if (!reviewCase) {
      return null;
    }

    return {
      id: reviewCase.id,
      type: reviewCase.type,
      status: reviewCase.status,
      reasonCode: reviewCase.reasonCode,
      assignedOperatorId: reviewCase.assignedOperatorId,
      updatedAt: reviewCase.updatedAt.toISOString(),
    };
  }

  private mapReleaseIntentSummary(
    intent:
      | {
          id: string;
          intentType: TransactionIntentType;
          status: TransactionIntentStatus;
          policyDecision: PolicyDecision;
          requestedAmount: Prisma.Decimal;
          settledAmount: Prisma.Decimal | null;
          createdAt: Date;
          updatedAt: Date;
        }
      | null
      | undefined
  ): RetirementVaultReleaseIntentSummary | null {
    if (!intent) {
      return null;
    }

    return {
      id: intent.id,
      intentType: intent.intentType,
      status: intent.status,
      policyDecision: intent.policyDecision,
      requestedAmount: intent.requestedAmount.toString(),
      settledAmount: intent.settledAmount?.toString() ?? null,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
    };
  }

  private mapReleaseRequestProjection(
    request:
      | (Prisma.RetirementVaultReleaseRequestGetPayload<{
          include: typeof retirementVaultReleaseRequestInclude;
        }>)
      | InternalReleaseRequestRecord
  ): RetirementVaultReleaseRequestProjection {
    return {
      id: request.id,
      retirementVaultId: request.retirementVaultId,
      requestKind: request.requestKind,
      requestedAmount: request.requestedAmount.toString(),
      status: request.status,
      reasonCode: request.reasonCode,
      reasonNote: request.reasonNote,
      evidence: request.evidence,
      requestedByActorType: request.requestedByActorType,
      requestedByActorId: request.requestedByActorId,
      reviewRequiredAt: request.reviewRequiredAt?.toISOString() ?? null,
      reviewDecidedAt: request.reviewDecidedAt?.toISOString() ?? null,
      cooldownEndsAt: request.cooldownEndsAt?.toISOString() ?? null,
      requestedAt: request.requestedAt.toISOString(),
      cooldownStartedAt: request.cooldownStartedAt?.toISOString() ?? null,
      readyForReleaseAt: request.readyForReleaseAt?.toISOString() ?? null,
      approvedAt: request.approvedAt?.toISOString() ?? null,
      approvedByOperatorId: request.approvedByOperatorId,
      approvedByOperatorRole: request.approvedByOperatorRole,
      rejectedAt: request.rejectedAt?.toISOString() ?? null,
      rejectedByOperatorId: request.rejectedByOperatorId,
      rejectedByOperatorRole: request.rejectedByOperatorRole,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      cancelledByActorType: request.cancelledByActorType,
      cancelledByActorId: request.cancelledByActorId,
      executionStartedAt: request.executionStartedAt?.toISOString() ?? null,
      executedByWorkerId: request.executedByWorkerId,
      executionFailureCode: request.executionFailureCode,
      executionFailureReason: request.executionFailureReason,
      releasedAt: request.releasedAt?.toISOString() ?? null,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      reviewCase: this.mapReviewCaseSummary(request.reviewCase),
      transactionIntent: this.mapReleaseIntentSummary(request.transactionIntent),
    };
  }

  private mapRetirementVaultEventProjection(
    event: {
      id: string;
      eventType: RetirementVaultEventType;
      actorType: string;
      actorId: string | null;
      metadata: Prisma.JsonValue | null;
      createdAt: Date;
    }
  ): RetirementVaultEventProjection {
    return {
      id: event.id,
      eventType: event.eventType,
      actorType: event.actorType,
      actorId: event.actorId,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    };
  }

  private mapRuleChangeRequestProjection(
    request: RetirementVaultRuleChangeRequestRecord,
  ): RetirementVaultRuleChangeRequestProjection {
    return {
      id: request.id,
      retirementVaultId: request.retirementVaultId,
      status: request.status,
      requestedByActorType: request.requestedByActorType,
      requestedByActorId: request.requestedByActorId,
      currentUnlockAt: request.currentUnlockAt.toISOString(),
      requestedUnlockAt: request.requestedUnlockAt.toISOString(),
      currentStrictMode: request.currentStrictMode,
      requestedStrictMode: request.requestedStrictMode,
      weakensProtection: request.weakensProtection,
      reasonCode: request.reasonCode,
      reasonNote: request.reasonNote,
      reviewRequiredAt: request.reviewRequiredAt?.toISOString() ?? null,
      reviewDecidedAt: request.reviewDecidedAt?.toISOString() ?? null,
      requestedAt: request.requestedAt.toISOString(),
      cooldownStartedAt: request.cooldownStartedAt?.toISOString() ?? null,
      cooldownEndsAt: request.cooldownEndsAt?.toISOString() ?? null,
      approvedAt: request.approvedAt?.toISOString() ?? null,
      approvedByOperatorId: request.approvedByOperatorId,
      approvedByOperatorRole: request.approvedByOperatorRole,
      rejectedAt: request.rejectedAt?.toISOString() ?? null,
      rejectedByOperatorId: request.rejectedByOperatorId,
      rejectedByOperatorRole: request.rejectedByOperatorRole,
      cancelledAt: request.cancelledAt?.toISOString() ?? null,
      cancelledByActorType: request.cancelledByActorType,
      cancelledByActorId: request.cancelledByActorId,
      applyStartedAt: request.applyStartedAt?.toISOString() ?? null,
      appliedAt: request.appliedAt?.toISOString() ?? null,
      appliedByWorkerId: request.appliedByWorkerId,
      applyFailureCode: request.applyFailureCode,
      applyFailureReason: request.applyFailureReason,
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      reviewCase: this.mapReviewCaseSummary(request.reviewCase),
    };
  }

  private mapRetirementVaultProjection(
    vault: RetirementVaultRecord
  ): RetirementVaultProjection {
    return {
      id: vault.id,
      customerAccountId: vault.customerAccountId,
      asset: {
        id: vault.asset.id,
        symbol: vault.asset.symbol,
        displayName: vault.asset.displayName,
        decimals: vault.asset.decimals,
        chainId: vault.asset.chainId,
      },
      status: vault.status,
      strictMode: vault.strictMode,
      unlockAt: vault.unlockAt.toISOString(),
      lockedBalance: vault.lockedBalance.toString(),
      fundedAt: vault.fundedAt?.toISOString() ?? null,
      lastFundedAt: vault.lastFundedAt?.toISOString() ?? null,
      createdAt: vault.createdAt.toISOString(),
      updatedAt: vault.updatedAt.toISOString(),
      releaseRequests: vault.releaseRequests.map((request) =>
        this.mapReleaseRequestProjection(request)
      ),
      ruleChangeRequests: vault.ruleChangeRequests.map((request) =>
        this.mapRuleChangeRequestProjection(request)
      ),
      events: vault.events.map((event) =>
        this.mapRetirementVaultEventProjection(event)
      ),
    };
  }

  private mapRetirementVaultRestrictionProjection(vault: {
    restrictedAt: Date | null;
    restrictionReasonCode: string | null;
    restrictedByOperatorId: string | null;
    restrictedByOperatorRole: string | null;
    restrictedByOversightIncidentId: string | null;
    restrictionNote: string | null;
    restrictionReleasedAt: Date | null;
    restrictionReleasedByOperatorId: string | null;
    restrictionReleasedByOperatorRole: string | null;
    restrictionReleaseNote: string | null;
  }): RetirementVaultRestrictionProjection {
    return {
      restrictedAt: vault.restrictedAt?.toISOString() ?? null,
      restrictionReasonCode: vault.restrictionReasonCode,
      restrictedByOperatorId: vault.restrictedByOperatorId,
      restrictedByOperatorRole: vault.restrictedByOperatorRole,
      restrictedByOversightIncidentId: vault.restrictedByOversightIncidentId,
      restrictionNote: vault.restrictionNote,
      restrictionReleasedAt: vault.restrictionReleasedAt?.toISOString() ?? null,
      restrictionReleasedByOperatorId: vault.restrictionReleasedByOperatorId,
      restrictionReleasedByOperatorRole: vault.restrictionReleasedByOperatorRole,
      restrictionReleaseNote: vault.restrictionReleaseNote,
    };
  }

  private mapFundingIntentProjection(
    intent: RetirementVaultFundingIntentRecord
  ): RetirementVaultFundingIntentProjection {
    return {
      id: intent.id,
      retirementVaultId: intent.retirementVaultId,
      asset: {
        id: intent.asset.id,
        symbol: intent.asset.symbol,
        displayName: intent.asset.displayName,
        decimals: intent.asset.decimals,
        chainId: intent.asset.chainId,
      },
      intentType: intent.intentType,
      status: intent.status,
      policyDecision: intent.policyDecision,
      requestedAmount: intent.requestedAmount.toString(),
      settledAmount: intent.settledAmount?.toString() ?? null,
      idempotencyKey: intent.idempotencyKey,
      createdAt: intent.createdAt.toISOString(),
      updatedAt: intent.updatedAt.toISOString(),
    };
  }

  private mapInternalReleaseRequestProjection(
    request: InternalReleaseRequestRecord
  ): InternalRetirementVaultReleaseRequestProjection {
    return {
      ...this.mapReleaseRequestProjection(request),
      retirementVault: {
        id: request.retirementVault.id,
        status: request.retirementVault.status,
        strictMode: request.retirementVault.strictMode,
        unlockAt: request.retirementVault.unlockAt.toISOString(),
        lockedBalance: request.retirementVault.lockedBalance.toString(),
        asset: {
          id: request.retirementVault.asset.id,
          symbol: request.retirementVault.asset.symbol,
          displayName: request.retirementVault.asset.displayName,
          decimals: request.retirementVault.asset.decimals,
          chainId: request.retirementVault.asset.chainId,
        },
        customerAccount: {
          id: request.retirementVault.customerAccount.id,
          status: request.retirementVault.customerAccount.status,
          customer: {
            id: request.retirementVault.customerAccount.customer.id,
            supabaseUserId:
              request.retirementVault.customerAccount.customer.supabaseUserId,
            email: request.retirementVault.customerAccount.customer.email,
            firstName:
              request.retirementVault.customerAccount.customer.firstName ?? "",
            lastName:
              request.retirementVault.customerAccount.customer.lastName ?? "",
          },
        },
      },
    };
  }

  private mapInternalRetirementVaultProjection(
    vault: InternalRetirementVaultRecord
  ): InternalRetirementVaultProjection {
    return {
      ...this.mapRetirementVaultProjection(vault),
      restriction: this.mapRetirementVaultRestrictionProjection(vault),
      customerAccount: {
        id: vault.customerAccount.id,
        status: vault.customerAccount.status,
        customer: {
          id: vault.customerAccount.customer.id,
          supabaseUserId: vault.customerAccount.customer.supabaseUserId,
          email: vault.customerAccount.customer.email,
          firstName: vault.customerAccount.customer.firstName ?? "",
          lastName: vault.customerAccount.customer.lastName ?? "",
        },
      },
    };
  }

  private mapLinkedOversightIncidentProjection(
    incident:
      | {
          id: string;
          incidentType: string;
          status: OversightIncidentStatus;
          reasonCode: string | null;
          summaryNote: string | null;
          assignedOperatorId: string | null;
          openedAt: Date;
          updatedAt: Date;
        }
      | null
      | undefined
  ): LinkedOversightIncidentProjection {
    if (!incident) {
      return null;
    }

    return {
      id: incident.id,
      incidentType: incident.incidentType,
      status: incident.status,
      reasonCode: incident.reasonCode,
      summaryNote: incident.summaryNote,
      assignedOperatorId: incident.assignedOperatorId,
      openedAt: incident.openedAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
    };
  }

  private mapAuditTimelineProjection(entry: {
    id: string;
    actorType: string;
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }): AuditTimelineProjection {
    return {
      id: entry.id,
      actorType: entry.actorType,
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      metadata: entry.metadata,
      createdAt: entry.createdAt.toISOString(),
    };
  }

  private async findFundingIntentByIdempotencyKey(
    idempotencyKey: string
  ): Promise<RetirementVaultFundingIntentRecord | null> {
    return this.prismaService.transactionIntent.findUnique({
      where: {
        idempotencyKey,
      },
      include: {
        asset: {
          select: retirementVaultAssetSelect,
        },
        retirementVault: {
          select: {
            id: true,
          },
        },
      },
    });
  }

  private assertReusableFundingIntent(
    existingIntent: RetirementVaultFundingIntentRecord,
    context: CustomerAssetContext,
    retirementVaultId: string,
    requestedAmount: Prisma.Decimal
  ): void {
    const matches =
      existingIntent.customerAccountId === context.customerAccountId &&
      existingIntent.intentType === TransactionIntentType.vault_subscription &&
      existingIntent.chainId === this.productChainId &&
      existingIntent.asset.symbol === context.assetSymbol &&
      existingIntent.retirementVaultId === retirementVaultId &&
      existingIntent.requestedAmount.equals(requestedAmount);

    if (!matches) {
      throw new ConflictException(
        "Idempotency key already exists for a different retirement vault funding request."
      );
    }
  }

  private buildReleaseEvidence(dto: RequestRetirementVaultReleaseDto): Prisma.InputJsonValue | null {
    if (!dto.evidenceNote?.trim()) {
      return null;
    }

    return {
      note: dto.evidenceNote.trim(),
    };
  }

  private deriveReleaseKind(vault: RetirementVaultRecord): RetirementVaultReleaseRequestKind {
    return vault.unlockAt <= new Date()
      ? RetirementVaultReleaseRequestKind.scheduled_unlock
      : RetirementVaultReleaseRequestKind.early_unlock;
  }

  private buildCooldownEndsAt(
    requestedAt: Date,
    strictMode: boolean,
    requestKind: RetirementVaultReleaseRequestKind
  ): Date {
    const cooldownDays =
      requestKind === RetirementVaultReleaseRequestKind.scheduled_unlock
        ? strictMode
          ? 3
          : 1
        : strictMode
          ? 14
          : 7;
    const cooldownEndsAt = new Date(requestedAt);
    cooldownEndsAt.setUTCDate(cooldownEndsAt.getUTCDate() + cooldownDays);
    return cooldownEndsAt;
  }

  private buildRuleChangeCooldownEndsAt(
    requestedAt: Date,
    currentStrictMode: boolean,
  ): Date {
    const cooldownDays = currentStrictMode ? 14 : 7;
    const cooldownEndsAt = new Date(requestedAt);
    cooldownEndsAt.setUTCDate(cooldownEndsAt.getUTCDate() + cooldownDays);
    return cooldownEndsAt;
  }

  private assertNoActiveRuleChangeRequest(vault: RetirementVaultRecord): void {
    const activeRuleChangeRequest = vault.ruleChangeRequests.find((request) =>
      ACTIVE_RULE_CHANGE_REQUEST_STATUSES.includes(request.status),
    );

    if (activeRuleChangeRequest) {
      throw new ConflictException(
        "A retirement vault rule change request is already active for this asset.",
      );
    }
  }

  private deriveRuleChangeTargets(
    vault: RetirementVaultRecord,
    dto: RequestRetirementVaultRuleChangeDto,
  ): {
    requestedUnlockAt: Date;
    requestedStrictMode: boolean;
    weakensProtection: boolean;
    strengthensProtection: boolean;
  } {
    const requestedUnlockAt =
      this.parseOptionalUnlockAt(dto.unlockAt) ?? vault.unlockAt;
    const requestedStrictMode = dto.strictMode ?? vault.strictMode;

    if (
      requestedUnlockAt.getTime() === vault.unlockAt.getTime() &&
      requestedStrictMode === vault.strictMode
    ) {
      throw new BadRequestException(
        "Retirement vault rule change must modify unlockAt or strictMode.",
      );
    }

    const weakensProtection =
      requestedUnlockAt.getTime() < vault.unlockAt.getTime() ||
      (vault.strictMode && !requestedStrictMode);
    const strengthensProtection =
      requestedUnlockAt.getTime() > vault.unlockAt.getTime() ||
      (!vault.strictMode && requestedStrictMode);

    return {
      requestedUnlockAt,
      requestedStrictMode,
      weakensProtection,
      strengthensProtection,
    };
  }

  private async loadVaultByCustomerAsset(
    customerAccountId: string,
    assetId: string
  ): Promise<RetirementVaultRecord> {
    const vault = await this.prismaService.retirementVault.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId,
          assetId,
        },
      },
      include: retirementVaultInclude,
    });

    if (!vault) {
      throw new NotFoundException(
        "Retirement vault not found for the requested asset."
      );
    }

    return vault;
  }

  private async loadInternalVaultById(
    vaultId: string
  ): Promise<InternalRetirementVaultRecord> {
    const vault = await this.prismaService.retirementVault.findUnique({
      where: {
        id: vaultId,
      },
      include: internalVaultInclude,
    });

    if (!vault) {
      throw new NotFoundException("Retirement vault not found.");
    }

    return vault;
  }

  private assertVaultSupportsFunding(vault: RetirementVaultRecord): void {
    if (vault.status !== RetirementVaultStatus.active) {
      throw new ConflictException(
        "Retirement vault is not eligible for new funding in its current state."
      );
    }
  }

  private assertNoActiveReleaseRequest(vault: RetirementVaultRecord): void {
    const activeReleaseRequest = vault.releaseRequests.find((request) =>
      ACTIVE_RELEASE_REQUEST_STATUSES.includes(request.status)
    );

    if (activeReleaseRequest) {
      throw new ConflictException(
        "A retirement vault unlock request is already active for this asset."
      );
    }
  }

  private assertReleaseRequestActionable(
    request: InternalReleaseRequestRecord,
    allowedStatuses: RetirementVaultReleaseRequestStatus[]
  ): void {
    if (!allowedStatuses.includes(request.status)) {
      throw new ConflictException(
        "Retirement vault release request is not actionable in its current state."
      );
    }
  }

  private assertRuleChangeRequestActionable(
    request: RetirementVaultRuleChangeRequestRecord,
    allowedStatuses: RetirementVaultRuleChangeRequestStatus[],
  ): void {
    if (!allowedStatuses.includes(request.status)) {
      throw new ConflictException(
        "Retirement vault rule change request is not actionable in its current state.",
      );
    }
  }

  private assertCanDecideRelease(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      OPERATOR_RELEASE_APPROVER_ROLES,
      "Operator role is not authorized to decide retirement vault release requests."
    );
  }

  private assertCanApplyVaultRestriction(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.vaultRestrictionApplyAllowedOperatorRoles,
      "Operator role is not authorized to restrict retirement vaults."
    );
  }

  private assertCanReleaseVaultRestriction(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.vaultRestrictionReleaseAllowedOperatorRoles,
      "Operator role is not authorized to release retirement vault restrictions."
    );
  }

  private async resolveLinkedOversightIncident(
    oversightIncidentId: string | null | undefined,
    customerAccountId: string
  ): Promise<LinkedOversightIncidentProjection> {
    if (!oversightIncidentId) {
      return null;
    }

    const oversightIncident = await this.prismaService.oversightIncident.findUnique({
      where: {
        id: oversightIncidentId,
      },
      select: {
        id: true,
        incidentType: true,
        status: true,
        reasonCode: true,
        summaryNote: true,
        assignedOperatorId: true,
        openedAt: true,
        updatedAt: true,
        subjectCustomerAccountId: true,
      },
    });

    if (
      !oversightIncident ||
      oversightIncident.subjectCustomerAccountId !== customerAccountId
    ) {
      return null;
    }

    return this.mapLinkedOversightIncidentProjection(oversightIncident);
  }

  private async assertOversightIncidentMatchesVault(
    oversightIncidentId: string | null,
    customerAccountId: string
  ): Promise<string | null> {
    if (!oversightIncidentId) {
      return null;
    }

    const oversightIncident = await this.prismaService.oversightIncident.findUnique({
      where: {
        id: oversightIncidentId,
      },
      select: {
        id: true,
        status: true,
        subjectCustomerAccountId: true,
      },
    });

    if (!oversightIncident) {
      throw new NotFoundException("Oversight incident not found for vault restriction.");
    }

    if (oversightIncident.subjectCustomerAccountId !== customerAccountId) {
      throw new ConflictException(
        "Oversight incident does not belong to the retirement vault customer account."
      );
    }

    const actionableOversightStatuses: OversightIncidentStatus[] = [
      OversightIncidentStatus.open,
      OversightIncidentStatus.in_progress,
    ];

    if (!actionableOversightStatuses.includes(oversightIncident.status)) {
      throw new ConflictException(
        "Oversight incident is not active enough to be linked to a vault restriction."
      );
    }

    return oversightIncident.id;
  }

  private async closeLinkedReviewCase(params: {
    transaction: Prisma.TransactionClient;
    reviewCaseId: string | null;
    actorType: string;
    actorId: string | null;
    note: string | null;
    disposition: "resolved" | "dismissed";
    customerId: string | null;
    releaseRequestId: string;
  }): Promise<void> {
    if (!params.reviewCaseId) {
      return;
    }

    const existingReviewCase = await params.transaction.reviewCase.findUnique({
      where: {
        id: params.reviewCaseId,
      },
      select: {
        id: true,
        type: true,
        status: true,
        customerAccountId: true,
        transactionIntentId: true,
      },
    });

    if (
      !existingReviewCase ||
      existingReviewCase.status === ReviewCaseStatus.resolved ||
      existingReviewCase.status === ReviewCaseStatus.dismissed
    ) {
      return;
    }

    const nextStatus =
      params.disposition === "resolved"
        ? ReviewCaseStatus.resolved
        : ReviewCaseStatus.dismissed;
    const eventType =
      params.disposition === "resolved"
        ? ReviewCaseEventType.resolved
        : ReviewCaseEventType.dismissed;
    const occurredAt = new Date();

    await params.transaction.reviewCase.update({
      where: {
        id: existingReviewCase.id,
      },
      data: {
        status: nextStatus,
        assignedOperatorId:
          params.actorType === "operator" ? params.actorId : null,
        resolvedAt: params.disposition === "resolved" ? occurredAt : undefined,
        dismissedAt:
          params.disposition === "dismissed" ? occurredAt : undefined,
        notes: params.note ?? undefined,
      },
    });

    await params.transaction.reviewCaseEvent.create({
      data: {
        reviewCaseId: existingReviewCase.id,
        actorType: params.actorType,
        actorId: params.actorId,
        eventType,
        note: params.note,
        metadata: {
          releaseRequestId: params.releaseRequestId,
          previousStatus: existingReviewCase.status,
          newStatus: nextStatus,
        },
      },
    });

    await params.transaction.auditEvent.create({
      data: {
        customerId: params.customerId,
        actorType: params.actorType,
        actorId: params.actorId,
        action:
          params.disposition === "resolved"
            ? "review_case.resolved"
            : "review_case.dismissed",
        targetType: "ReviewCase",
        targetId: existingReviewCase.id,
        metadata: {
          releaseRequestId: params.releaseRequestId,
          previousStatus: existingReviewCase.status,
          newStatus: nextStatus,
          note: params.note,
          reviewCaseType: existingReviewCase.type,
          transactionIntentId: existingReviewCase.transactionIntentId,
          customerAccountId: existingReviewCase.customerAccountId,
        },
      },
    });
  }

  private async closeLinkedRuleChangeReviewCase(params: {
    transaction: Prisma.TransactionClient;
    reviewCaseId: string | null;
    actorType: string;
    actorId: string | null;
    note: string | null;
    disposition: "resolved" | "dismissed";
    customerId: string | null;
    ruleChangeRequestId: string;
  }): Promise<void> {
    if (!params.reviewCaseId) {
      return;
    }

    const existingReviewCase = await params.transaction.reviewCase.findUnique({
      where: {
        id: params.reviewCaseId,
      },
      select: {
        id: true,
        type: true,
        status: true,
        customerAccountId: true,
        transactionIntentId: true,
      },
    });

    if (
      !existingReviewCase ||
      existingReviewCase.status === ReviewCaseStatus.resolved ||
      existingReviewCase.status === ReviewCaseStatus.dismissed
    ) {
      return;
    }

    const nextStatus =
      params.disposition === "resolved"
        ? ReviewCaseStatus.resolved
        : ReviewCaseStatus.dismissed;
    const eventType =
      params.disposition === "resolved"
        ? ReviewCaseEventType.resolved
        : ReviewCaseEventType.dismissed;
    const occurredAt = new Date();

    await params.transaction.reviewCase.update({
      where: {
        id: existingReviewCase.id,
      },
      data: {
        status: nextStatus,
        assignedOperatorId:
          params.actorType === "operator" ? params.actorId : null,
        resolvedAt: params.disposition === "resolved" ? occurredAt : undefined,
        dismissedAt:
          params.disposition === "dismissed" ? occurredAt : undefined,
        notes: params.note ?? undefined,
      },
    });

    await params.transaction.reviewCaseEvent.create({
      data: {
        reviewCaseId: existingReviewCase.id,
        actorType: params.actorType,
        actorId: params.actorId,
        eventType,
        note: params.note,
        metadata: {
          ruleChangeRequestId: params.ruleChangeRequestId,
          previousStatus: existingReviewCase.status,
          newStatus: nextStatus,
        },
      },
    });

    await params.transaction.auditEvent.create({
      data: {
        customerId: params.customerId,
        actorType: params.actorType,
        actorId: params.actorId,
        action:
          params.disposition === "resolved"
            ? "review_case.resolved"
            : "review_case.dismissed",
        targetType: "ReviewCase",
        targetId: existingReviewCase.id,
        metadata: {
          ruleChangeRequestId: params.ruleChangeRequestId,
          previousStatus: existingReviewCase.status,
          newStatus: nextStatus,
          note: params.note,
          reviewCaseType: existingReviewCase.type,
          transactionIntentId: existingReviewCase.transactionIntentId,
          customerAccountId: existingReviewCase.customerAccountId,
        },
      },
    });
  }

  async listMyRetirementVaults(
    supabaseUserId: string
  ): Promise<ListMyRetirementVaultsResult> {
    const customerAccountId = await this.requireCustomerAccountId(supabaseUserId);

    const vaults = await this.prismaService.retirementVault.findMany({
      where: {
        customerAccountId,
      },
      include: retirementVaultInclude,
      orderBy: [
        {
          asset: {
            symbol: "asc",
          },
        },
        {
          createdAt: "asc",
        },
      ],
    });

    return {
      customerAccountId,
      vaults: vaults.map((vault) => this.mapRetirementVaultProjection(vault)),
    };
  }

  async createMyRetirementVault(
    supabaseUserId: string,
    dto: CreateRetirementVaultDto
  ): Promise<CreateMyRetirementVaultResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const unlockAt = this.parseUnlockAt(dto.unlockAt);
    const strictMode = dto.strictMode ?? false;
    const context = await this.resolveCustomerAssetContext(
      supabaseUserId,
      normalizedAssetSymbol
    );

    const existingVault = await this.prismaService.retirementVault.findUnique({
      where: {
        customerAccountId_assetId: {
          customerAccountId: context.customerAccountId,
          assetId: context.assetId,
        },
      },
      include: retirementVaultInclude,
    });

    if (existingVault) {
      if (
        existingVault.strictMode !== strictMode ||
        existingVault.unlockAt.getTime() !== unlockAt.getTime()
      ) {
        throw new ConflictException(
          "Retirement vault already exists for this asset with different lock rules."
        );
      }

      return {
        vault: this.mapRetirementVaultProjection(existingVault),
        created: false,
      };
    }

    const createdVault = await this.prismaService.$transaction(async (transaction) => {
      const vault = await transaction.retirementVault.create({
        data: {
          customerAccountId: context.customerAccountId,
          assetId: context.assetId,
          unlockAt,
          strictMode,
        },
        include: retirementVaultInclude,
      });

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: vault.id,
          eventType: RetirementVaultEventType.created,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            customerAccountId: context.customerAccountId,
            assetId: context.assetId,
            assetSymbol: context.assetSymbol,
            strictMode,
            unlockAt: unlockAt.toISOString(),
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId: context.customerId,
          actorType: "customer",
          actorId: supabaseUserId,
          action: "retirement_vault.created",
          targetType: "RetirementVault",
          targetId: vault.id,
          metadata: {
            customerAccountId: context.customerAccountId,
            assetId: context.assetId,
            assetSymbol: context.assetSymbol,
            strictMode,
            unlockAt: unlockAt.toISOString(),
          },
        },
      });

      return vault;
    });

    return {
      vault: this.mapRetirementVaultProjection(createdVault),
      created: true,
    };
  }

  async fundMyRetirementVault(
    supabaseUserId: string,
    dto: FundRetirementVaultDto
  ): Promise<FundMyRetirementVaultResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const requestedAmount = this.parseRequestedAmount(dto.amount);
    const context = await this.resolveCustomerAssetContext(
      supabaseUserId,
      normalizedAssetSymbol
    );

    const vault = await this.loadVaultByCustomerAsset(
      context.customerAccountId,
      context.assetId
    );
    this.assertVaultSupportsFunding(vault);

    const existingIntent = await this.findFundingIntentByIdempotencyKey(
      dto.idempotencyKey
    );

    if (existingIntent) {
      this.assertReusableFundingIntent(
        existingIntent,
        context,
        vault.id,
        requestedAmount
      );

      const latestVault = await this.prismaService.retirementVault.findUnique({
        where: {
          id: vault.id,
        },
        include: retirementVaultInclude,
      });

      if (!latestVault) {
        throw new NotFoundException("Retirement vault not found.");
      }

      return {
        vault: this.mapRetirementVaultProjection(latestVault),
        intent: this.mapFundingIntentProjection(existingIntent),
        idempotencyReused: true,
      };
    }

    const result = await this.prismaService.$transaction(async (transaction) => {
      const intent = await transaction.transactionIntent.create({
        data: {
          customerAccountId: context.customerAccountId,
          retirementVaultId: vault.id,
          assetId: context.assetId,
          chainId: this.productChainId,
          intentType: TransactionIntentType.vault_subscription,
          status: TransactionIntentStatus.settled,
          policyDecision: PolicyDecision.approved,
          requestedAmount,
          settledAmount: requestedAmount,
          idempotencyKey: dto.idempotencyKey,
        },
        include: {
          asset: {
            select: retirementVaultAssetSelect,
          },
          retirementVault: {
            select: {
              id: true,
            },
          },
        },
      });

      const ledgerResult = await this.ledgerService.fundRetirementVaultBalance(
        transaction,
        {
          transactionIntentId: intent.id,
          retirementVaultId: vault.id,
          customerAccountId: context.customerAccountId,
          assetId: context.assetId,
          chainId: this.productChainId,
          amount: requestedAmount,
        }
      );

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: vault.id,
          eventType: RetirementVaultEventType.funded,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            transactionIntentId: intent.id,
            requestedAmount: requestedAmount.toString(),
            ledgerJournalId: ledgerResult.ledgerJournalId,
            availableBalanceAfter: ledgerResult.availableBalance,
            lockedBalanceAfter: ledgerResult.lockedBalance,
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId: context.customerId,
          actorType: "customer",
          actorId: supabaseUserId,
          action: "retirement_vault.funded",
          targetType: "RetirementVault",
          targetId: vault.id,
          metadata: {
            customerAccountId: context.customerAccountId,
            assetId: context.assetId,
            assetSymbol: context.assetSymbol,
            transactionIntentId: intent.id,
            requestedAmount: requestedAmount.toString(),
            settledAmount: requestedAmount.toString(),
            ledgerJournalId: ledgerResult.ledgerJournalId,
            availableBalanceAfter: ledgerResult.availableBalance,
            lockedBalanceAfter: ledgerResult.lockedBalance,
            strictMode: vault.strictMode,
            unlockAt: vault.unlockAt.toISOString(),
          },
        },
      });

      const updatedVault = await transaction.retirementVault.findUnique({
        where: {
          id: vault.id,
        },
        include: retirementVaultInclude,
      });

      if (!updatedVault) {
        throw new NotFoundException("Retirement vault not found.");
      }

      return {
        updatedVault,
        intent,
      };
    });

    return {
      vault: this.mapRetirementVaultProjection(result.updatedVault),
      intent: this.mapFundingIntentProjection(result.intent),
      idempotencyReused: false,
    };
  }

  async requestMyRetirementVaultRelease(
    supabaseUserId: string,
    dto: RequestRetirementVaultReleaseDto
  ): Promise<RequestMyRetirementVaultReleaseResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const requestedAmount = this.parseRequestedAmount(dto.amount);
    const context = await this.resolveCustomerAssetContext(
      supabaseUserId,
      normalizedAssetSymbol
    );
    const reasonCode = this.normalizeOptionalString(dto.reasonCode);
    const reasonNote = this.normalizeOptionalString(dto.reasonNote);
    const evidence = this.buildReleaseEvidence(dto);

    const vault = await this.loadVaultByCustomerAsset(
      context.customerAccountId,
      context.assetId
    );

    if (vault.status !== RetirementVaultStatus.active) {
      throw new ConflictException(
        "Retirement vault is not eligible for unlock requests in its current state."
      );
    }

    if (vault.lockedBalance.lt(requestedAmount)) {
      throw new ConflictException(
        "Requested amount exceeds the locked balance for this retirement vault."
      );
    }

    this.assertNoActiveReleaseRequest(vault);
    this.assertNoActiveRuleChangeRequest(vault);

    const requestKind = this.deriveReleaseKind(vault);

    if (
      requestKind === RetirementVaultReleaseRequestKind.early_unlock &&
      !reasonCode
    ) {
      throw new BadRequestException(
        "Early unlock requests require a reason code."
      );
    }

    const requestedAt = new Date();
    const requiresReview =
      requestKind === RetirementVaultReleaseRequestKind.early_unlock;
    const initialStatus = requiresReview
      ? RetirementVaultReleaseRequestStatus.review_required
      : RetirementVaultReleaseRequestStatus.cooldown_active;
    let reviewCaseReused = false;

    const result = await this.prismaService.$transaction(async (transaction) => {
      let releaseRequest = await transaction.retirementVaultReleaseRequest.create({
        data: {
          retirementVaultId: vault.id,
          requestKind,
          requestedAmount,
          status: initialStatus,
          reasonCode:
            reasonCode ??
            (requestKind === RetirementVaultReleaseRequestKind.scheduled_unlock
              ? "scheduled_unlock"
              : null),
          reasonNote,
          evidence: evidence ?? undefined,
          requestedByActorType: "customer",
          requestedByActorId: supabaseUserId,
          reviewRequiredAt: requiresReview ? requestedAt : null,
          requestedAt,
          cooldownStartedAt: requiresReview ? null : requestedAt,
          cooldownEndsAt: requiresReview
            ? null
            : this.buildCooldownEndsAt(requestedAt, vault.strictMode, requestKind),
          approvedAt: requiresReview ? null : requestedAt,
        },
        include: retirementVaultReleaseRequestInclude,
      });

      if (requiresReview) {
        const reviewCaseResult = await this.reviewCasesService.openOrReuseReviewCase(
          transaction,
          {
            customerId: context.customerId,
            customerAccountId: context.customerAccountId,
            transactionIntentId: null,
            type: ReviewCaseType.manual_intervention,
            reasonCode: "retirement_vault_early_release",
            notes:
              reasonNote ??
              `Early retirement vault unlock requested for ${context.assetSymbol}.`,
            actorType: "customer",
            actorId: supabaseUserId,
            auditAction: "retirement_vault.release_review_case_opened",
            auditMetadata: {
              retirementVaultId: vault.id,
              releaseRequestId: releaseRequest.id,
              assetSymbol: context.assetSymbol,
              requestedAmount: requestedAmount.toString(),
              strictMode: vault.strictMode,
              unlockAt: vault.unlockAt.toISOString(),
              reasonCode,
              evidence,
            },
          }
        );
        reviewCaseReused = reviewCaseResult.reviewCaseReused;
        releaseRequest = await transaction.retirementVaultReleaseRequest.update({
          where: {
            id: releaseRequest.id,
          },
          data: {
            reviewCaseId: reviewCaseResult.reviewCase.id,
          },
          include: retirementVaultReleaseRequestInclude,
        });
      }

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: vault.id,
          eventType: RetirementVaultEventType.release_requested,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            releaseRequestId: releaseRequest.id,
            requestKind,
            requestedAmount: requestedAmount.toString(),
            reasonCode: releaseRequest.reasonCode,
            reasonNote,
          },
        },
      });

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: vault.id,
          eventType: requiresReview
            ? RetirementVaultEventType.release_review_required
            : RetirementVaultEventType.cooldown_started,
          actorType: requiresReview ? "system" : "customer",
          actorId: requiresReview ? null : supabaseUserId,
          metadata: requiresReview
            ? {
                releaseRequestId: releaseRequest.id,
                reviewCaseId: releaseRequest.reviewCaseId,
                status: releaseRequest.status,
              }
            : {
                releaseRequestId: releaseRequest.id,
                cooldownEndsAt: releaseRequest.cooldownEndsAt?.toISOString() ?? null,
                approvedAt: releaseRequest.approvedAt?.toISOString() ?? null,
              },
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId: context.customerId,
          actorType: "customer",
          actorId: supabaseUserId,
          action: "retirement_vault.release_requested",
          targetType: "RetirementVaultReleaseRequest",
          targetId: releaseRequest.id,
          metadata: {
            customerAccountId: context.customerAccountId,
            retirementVaultId: vault.id,
            requestKind,
            requestedAmount: requestedAmount.toString(),
            strictMode: vault.strictMode,
            unlockAt: vault.unlockAt.toISOString(),
            status: releaseRequest.status,
            reviewCaseId: releaseRequest.reviewCaseId,
            cooldownEndsAt: releaseRequest.cooldownEndsAt?.toISOString() ?? null,
            reasonCode: releaseRequest.reasonCode,
            reasonNote,
            evidence,
          },
        },
      });

      const updatedVault = await transaction.retirementVault.findUnique({
        where: {
          id: vault.id,
        },
        include: retirementVaultInclude,
      });

      if (!updatedVault) {
        throw new NotFoundException("Retirement vault not found.");
      }

      return {
        releaseRequest,
        updatedVault,
      };
    });

    return {
      vault: this.mapRetirementVaultProjection(result.updatedVault),
      releaseRequest: this.mapReleaseRequestProjection(result.releaseRequest),
      reviewCaseReused,
    };
  }

  async cancelMyRetirementVaultRelease(
    supabaseUserId: string,
    releaseRequestId: string
  ): Promise<CancelMyRetirementVaultReleaseResult> {
    const releaseRequest = await this.prismaService.retirementVaultReleaseRequest.findFirst({
      where: {
        id: releaseRequestId,
        retirementVault: {
          customerAccount: {
            customer: {
              supabaseUserId,
            },
          },
        },
      },
      include: internalReleaseRequestInclude,
    });

    if (!releaseRequest) {
      throw new NotFoundException("Retirement vault release request not found.");
    }

    const cancellableStatuses: RetirementVaultReleaseRequestStatus[] = [
      RetirementVaultReleaseRequestStatus.requested,
      RetirementVaultReleaseRequestStatus.review_required,
      RetirementVaultReleaseRequestStatus.approved,
      RetirementVaultReleaseRequestStatus.cooldown_active,
    ];

    if (!cancellableStatuses.includes(releaseRequest.status)) {
      throw new ConflictException(
        "Retirement vault release request can no longer be cancelled."
      );
    }

    const result = await this.prismaService.$transaction(async (transaction) => {
      const cancelledRequest = await transaction.retirementVaultReleaseRequest.update({
        where: {
          id: releaseRequest.id,
        },
        data: {
          status: RetirementVaultReleaseRequestStatus.cancelled,
          cancelledAt: new Date(),
          cancelledByActorType: "customer",
          cancelledByActorId: supabaseUserId,
        },
        include: internalReleaseRequestInclude,
      });

      await this.closeLinkedReviewCase({
        transaction,
        reviewCaseId: cancelledRequest.reviewCaseId,
        actorType: "customer",
        actorId: supabaseUserId,
        note: "Customer cancelled the retirement vault unlock request.",
        disposition: "dismissed",
        customerId:
          cancelledRequest.retirementVault.customerAccount.customer.id ?? null,
        releaseRequestId: cancelledRequest.id,
      });

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: cancelledRequest.retirementVaultId,
          eventType: RetirementVaultEventType.release_cancelled,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            releaseRequestId: cancelledRequest.id,
            previousStatus: releaseRequest.status,
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId:
            cancelledRequest.retirementVault.customerAccount.customer.id ?? null,
          actorType: "customer",
          actorId: supabaseUserId,
          action: "retirement_vault.release_cancelled",
          targetType: "RetirementVaultReleaseRequest",
          targetId: cancelledRequest.id,
          metadata: {
            retirementVaultId: cancelledRequest.retirementVaultId,
            previousStatus: releaseRequest.status,
            status: cancelledRequest.status,
            reviewCaseId: cancelledRequest.reviewCaseId,
          },
        },
      });

      const updatedVault = await transaction.retirementVault.findUnique({
        where: {
          id: cancelledRequest.retirementVaultId,
        },
        include: retirementVaultInclude,
      });

      if (!updatedVault) {
        throw new NotFoundException("Retirement vault not found.");
      }

      return {
        cancelledRequest,
        updatedVault,
      };
    });

    return {
      vault: this.mapRetirementVaultProjection(result.updatedVault),
      releaseRequest: this.mapReleaseRequestProjection(result.cancelledRequest),
    };
  }

  async requestMyRetirementVaultRuleChange(
    supabaseUserId: string,
    dto: RequestRetirementVaultRuleChangeDto,
  ): Promise<RequestMyRetirementVaultRuleChangeResult> {
    const normalizedAssetSymbol = this.normalizeAssetSymbol(dto.assetSymbol);
    const context = await this.resolveCustomerAssetContext(
      supabaseUserId,
      normalizedAssetSymbol,
    );
    const reasonCode = this.normalizeOptionalString(dto.reasonCode);
    const reasonNote = this.normalizeOptionalString(dto.reasonNote);

    const vault = await this.loadVaultByCustomerAsset(
      context.customerAccountId,
      context.assetId,
    );

    if (vault.status !== RetirementVaultStatus.active) {
      throw new ConflictException(
        "Retirement vault rules can only be changed while the vault is active.",
      );
    }

    this.assertNoActiveReleaseRequest(vault);
    this.assertNoActiveRuleChangeRequest(vault);

    const {
      requestedUnlockAt,
      requestedStrictMode,
      weakensProtection,
      strengthensProtection,
    } = this.deriveRuleChangeTargets(vault, dto);

    if (weakensProtection && !reasonCode) {
      throw new BadRequestException(
        "Protection-weakening vault rule changes require a reason code.",
      );
    }

    if (!weakensProtection && !strengthensProtection) {
      throw new BadRequestException(
        "Retirement vault rule change must strengthen or weaken the current lock posture.",
      );
    }

    const requestedAt = new Date();
    const appliedImmediately = !weakensProtection;
    let reviewCaseReused = false;

    const result = await this.prismaService.$transaction(async (transaction) => {
      let ruleChangeRequest =
        await transaction.retirementVaultRuleChangeRequest.create({
          data: {
            retirementVaultId: vault.id,
            status: appliedImmediately
              ? RetirementVaultRuleChangeRequestStatus.applied
              : RetirementVaultRuleChangeRequestStatus.review_required,
            requestedByActorType: "customer",
            requestedByActorId: supabaseUserId,
            currentUnlockAt: vault.unlockAt,
            requestedUnlockAt,
            currentStrictMode: vault.strictMode,
            requestedStrictMode,
            weakensProtection,
            reasonCode,
            reasonNote,
            reviewRequiredAt: appliedImmediately ? null : requestedAt,
            requestedAt,
            appliedAt: appliedImmediately ? requestedAt : null,
          },
          include: retirementVaultRuleChangeRequestInclude,
        });

      if (appliedImmediately) {
        await transaction.retirementVault.update({
          where: {
            id: vault.id,
          },
          data: {
            unlockAt: requestedUnlockAt,
            strictMode: requestedStrictMode,
          },
        });
      } else {
        const reviewCaseResult = await this.reviewCasesService.openOrReuseReviewCase(
          transaction,
          {
            customerId: context.customerId,
            customerAccountId: context.customerAccountId,
            transactionIntentId: null,
            type: ReviewCaseType.manual_intervention,
            reasonCode: "retirement_vault_rule_change_weakening",
            notes:
              reasonNote ??
              `Protection-weakening retirement vault rule change requested for ${context.assetSymbol}.`,
            actorType: "customer",
            actorId: supabaseUserId,
            auditAction: "retirement_vault.rule_change_review_case_opened",
            auditMetadata: {
              retirementVaultId: vault.id,
              ruleChangeRequestId: ruleChangeRequest.id,
              assetSymbol: context.assetSymbol,
              currentUnlockAt: vault.unlockAt.toISOString(),
              requestedUnlockAt: requestedUnlockAt.toISOString(),
              currentStrictMode: vault.strictMode,
              requestedStrictMode,
              weakensProtection,
              reasonCode,
              reasonNote,
            },
          },
        );
        reviewCaseReused = reviewCaseResult.reviewCaseReused;
        ruleChangeRequest = await transaction.retirementVaultRuleChangeRequest.update({
          where: {
            id: ruleChangeRequest.id,
          },
          data: {
            reviewCaseId: reviewCaseResult.reviewCase.id,
          },
          include: retirementVaultRuleChangeRequestInclude,
        });
      }

      const eventData: Prisma.RetirementVaultEventCreateManyInput[] = [
        {
          retirementVaultId: vault.id,
          eventType: RetirementVaultEventType.rule_change_requested,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            ruleChangeRequestId: ruleChangeRequest.id,
            currentUnlockAt: vault.unlockAt.toISOString(),
            requestedUnlockAt: requestedUnlockAt.toISOString(),
            currentStrictMode: vault.strictMode,
            requestedStrictMode,
            weakensProtection,
            reasonCode,
            reasonNote,
          },
        },
      ];

      if (appliedImmediately) {
        eventData.push({
          retirementVaultId: vault.id,
          eventType: RetirementVaultEventType.rule_change_applied,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            ruleChangeRequestId: ruleChangeRequest.id,
            currentUnlockAt: vault.unlockAt.toISOString(),
            requestedUnlockAt: requestedUnlockAt.toISOString(),
            currentStrictMode: vault.strictMode,
            requestedStrictMode,
            appliedImmediately: true,
          },
        });
      } else {
        eventData.push({
          retirementVaultId: vault.id,
          eventType: RetirementVaultEventType.rule_change_review_required,
          actorType: "system",
          actorId: null,
          metadata: {
            ruleChangeRequestId: ruleChangeRequest.id,
            reviewCaseId: ruleChangeRequest.reviewCaseId,
            weakensProtection: true,
          },
        });
      }

      await transaction.retirementVaultEvent.createMany({
        data: eventData,
      });

      await transaction.auditEvent.create({
        data: {
          customerId: context.customerId,
          actorType: "customer",
          actorId: supabaseUserId,
          action: appliedImmediately
            ? "retirement_vault.rule_change_applied"
            : "retirement_vault.rule_change_requested",
          targetType: "RetirementVaultRuleChangeRequest",
          targetId: ruleChangeRequest.id,
          metadata: {
            customerAccountId: context.customerAccountId,
            retirementVaultId: vault.id,
            currentUnlockAt: vault.unlockAt.toISOString(),
            requestedUnlockAt: requestedUnlockAt.toISOString(),
            currentStrictMode: vault.strictMode,
            requestedStrictMode,
            weakensProtection,
            reviewCaseId: ruleChangeRequest.reviewCaseId,
            reasonCode,
            reasonNote,
          },
        },
      });

      const updatedVault = await transaction.retirementVault.findUnique({
        where: {
          id: vault.id,
        },
        include: retirementVaultInclude,
      });

      if (!updatedVault) {
        throw new NotFoundException("Retirement vault not found.");
      }

      return {
        ruleChangeRequest,
        updatedVault,
      };
    });

    return {
      vault: this.mapRetirementVaultProjection(result.updatedVault),
      ruleChangeRequest: this.mapRuleChangeRequestProjection(
        result.ruleChangeRequest,
      ),
      reviewCaseReused,
      appliedImmediately,
    };
  }

  async cancelMyRetirementVaultRuleChange(
    supabaseUserId: string,
    ruleChangeRequestId: string,
  ): Promise<CancelMyRetirementVaultRuleChangeResult> {
    const ruleChangeRequest =
      await this.prismaService.retirementVaultRuleChangeRequest.findFirst({
        where: {
          id: ruleChangeRequestId,
          retirementVault: {
            customerAccount: {
              customer: {
                supabaseUserId,
              },
            },
          },
        },
        include: retirementVaultRuleChangeRequestInclude,
      });

    if (!ruleChangeRequest) {
      throw new NotFoundException(
        "Retirement vault rule change request not found.",
      );
    }

    const cancellableStatuses: RetirementVaultRuleChangeRequestStatus[] = [
      RetirementVaultRuleChangeRequestStatus.review_required,
      RetirementVaultRuleChangeRequestStatus.cooldown_active,
    ];

    if (!cancellableStatuses.includes(ruleChangeRequest.status)) {
      throw new ConflictException(
        "Retirement vault rule change request can no longer be cancelled.",
      );
    }

    const result = await this.prismaService.$transaction(async (transaction) => {
      const cancelledRequest =
        await transaction.retirementVaultRuleChangeRequest.update({
          where: {
            id: ruleChangeRequest.id,
          },
          data: {
            status: RetirementVaultRuleChangeRequestStatus.cancelled,
            cancelledAt: new Date(),
            cancelledByActorType: "customer",
            cancelledByActorId: supabaseUserId,
          },
          include: retirementVaultRuleChangeRequestInclude,
        });

      const customer = await transaction.retirementVault.findUnique({
        where: {
          id: cancelledRequest.retirementVaultId,
        },
        select: {
          customerAccount: {
            select: {
              customer: {
                select: {
                  id: true,
                },
              },
            },
          },
        },
      });

      await this.closeLinkedRuleChangeReviewCase({
        transaction,
        reviewCaseId: cancelledRequest.reviewCaseId,
        actorType: "customer",
        actorId: supabaseUserId,
        note: "Customer cancelled the retirement vault rule change request.",
        disposition: "dismissed",
        customerId: customer?.customerAccount.customer.id ?? null,
        ruleChangeRequestId: cancelledRequest.id,
      });

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: cancelledRequest.retirementVaultId,
          eventType: RetirementVaultEventType.rule_change_cancelled,
          actorType: "customer",
          actorId: supabaseUserId,
          metadata: {
            ruleChangeRequestId: cancelledRequest.id,
            previousStatus: ruleChangeRequest.status,
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId: customer?.customerAccount.customer.id ?? null,
          actorType: "customer",
          actorId: supabaseUserId,
          action: "retirement_vault.rule_change_cancelled",
          targetType: "RetirementVaultRuleChangeRequest",
          targetId: cancelledRequest.id,
          metadata: {
            retirementVaultId: cancelledRequest.retirementVaultId,
            previousStatus: ruleChangeRequest.status,
            status: cancelledRequest.status,
            reviewCaseId: cancelledRequest.reviewCaseId,
          },
        },
      });

      const updatedVault = await transaction.retirementVault.findUnique({
        where: {
          id: cancelledRequest.retirementVaultId,
        },
        include: retirementVaultInclude,
      });

      if (!updatedVault) {
        throw new NotFoundException("Retirement vault not found.");
      }

      return {
        cancelledRequest,
        updatedVault,
      };
    });

    return {
      vault: this.mapRetirementVaultProjection(result.updatedVault),
      ruleChangeRequest: this.mapRuleChangeRequestProjection(
        result.cancelledRequest,
      ),
    };
  }

  async listInternalVaults(
    query: ListInternalRetirementVaultsDto
  ): Promise<ListInternalRetirementVaultsResult> {
    const limit = query.limit ?? 25;
    const where: Prisma.RetirementVaultWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.releaseRequestStatus) {
      where.releaseRequests = {
        some: {
          status: query.releaseRequestStatus,
        },
      };
    }

    if (query.ruleChangeRequestStatus) {
      where.ruleChangeRequests = {
        some: {
          status: query.ruleChangeRequestStatus,
        },
      };
    }

    const vaults = await this.prismaService.retirementVault.findMany({
      where,
      include: internalVaultInclude,
      orderBy: [
        {
          updatedAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: limit,
    });

    return {
      vaults: vaults.map((vault) => this.mapInternalRetirementVaultProjection(vault)),
      limit,
    };
  }

  async getInternalVaultWorkspace(
    vaultId: string,
    query: GetInternalRetirementVaultWorkspaceDto
  ): Promise<GetInternalRetirementVaultWorkspaceResult> {
    const recentLimit = query.recentLimit ?? 12;
    const vault = await this.loadInternalVaultById(vaultId);
    const linkedOversightIncident = await this.resolveLinkedOversightIncident(
      vault.restrictedByOversightIncidentId,
      vault.customerAccount.id
    );
    const releaseRequestIds = vault.releaseRequests.map((request) => request.id);
    const ruleChangeRequestIds = vault.ruleChangeRequests.map((request) => request.id);
    const reviewCaseIds = vault.releaseRequests
      .map((request) => request.reviewCaseId)
      .concat(vault.ruleChangeRequests.map((request) => request.reviewCaseId))
      .filter((value): value is string => Boolean(value));
    const transactionIntentIds = vault.releaseRequests
      .map((request) => request.transactionIntentId)
      .filter((value): value is string => Boolean(value));
    const relatedAuditWhereOr: Prisma.AuditEventWhereInput[] = [
      {
        targetType: "RetirementVault",
        targetId: vault.id,
      },
      ...releaseRequestIds.map((releaseRequestId) => ({
        targetType: "RetirementVaultReleaseRequest",
        targetId: releaseRequestId,
      })),
      ...ruleChangeRequestIds.map((ruleChangeRequestId) => ({
        targetType: "RetirementVaultRuleChangeRequest",
        targetId: ruleChangeRequestId,
      })),
      ...reviewCaseIds.map((reviewCaseId) => ({
        targetType: "ReviewCase",
        targetId: reviewCaseId,
      })),
      ...transactionIntentIds.map((transactionIntentId) => ({
        targetType: "TransactionIntent",
        targetId: transactionIntentId,
      })),
    ];

    const [vaultEvents, relatedAuditEvents, customerAccountTimeline] = await Promise.all([
      this.prismaService.retirementVaultEvent.findMany({
        where: {
          retirementVaultId: vault.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: recentLimit,
      }),
      this.prismaService.auditEvent.findMany({
        where: {
          OR: relatedAuditWhereOr,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: Math.max(recentLimit * 2, 20),
      }),
      this.customerAccountOperationsService.listCustomerAccountTimeline({
        customerAccountId: vault.customerAccount.id,
        limit: recentLimit,
      }),
    ]);

    return {
      vault: this.mapInternalRetirementVaultProjection(vault),
      linkedOversightIncident,
      vaultEvents: vaultEvents.map((event) =>
        this.mapRetirementVaultEventProjection(event)
      ),
      relatedAuditEvents: relatedAuditEvents.map((event) =>
        this.mapAuditTimelineProjection(event)
      ),
      customerAccountTimeline,
      recentLimit,
    };
  }

  async restrictInternalVault(
    vaultId: string,
    operatorId: string,
    operatorRole?: string | null,
    dto?: RestrictRetirementVaultDto
  ): Promise<UpdateInternalRetirementVaultRestrictionResult> {
    const normalizedOperatorRole = this.assertCanApplyVaultRestriction(operatorRole);
    const existingVault = await this.loadInternalVaultById(vaultId);

    if (existingVault.status === RetirementVaultStatus.released) {
      throw new ConflictException(
        "Released retirement vaults cannot be restricted."
      );
    }

    if (existingVault.status === RetirementVaultStatus.restricted) {
      return {
        vault: this.mapInternalRetirementVaultProjection(existingVault),
        stateReused: true,
      };
    }

    const reasonCode = this.normalizeOptionalString(dto?.reasonCode);

    if (!reasonCode) {
      throw new BadRequestException(
        "Vault restriction reason code is required."
      );
    }

    const note = this.normalizeOptionalString(dto?.note);
    const linkedOversightIncidentId = await this.assertOversightIncidentMatchesVault(
      this.normalizeOptionalString(dto?.oversightIncidentId),
      existingVault.customerAccount.id
    );
    const occurredAt = new Date();

    const updatedVault = await this.prismaService.$transaction(async (transaction) => {
      const restrictedVault = await transaction.retirementVault.update({
        where: {
          id: existingVault.id,
        },
        data: {
          status: RetirementVaultStatus.restricted,
          restrictedAt: occurredAt,
          restrictionReasonCode: reasonCode,
          restrictedByOperatorId: operatorId,
          restrictedByOperatorRole: normalizedOperatorRole,
          restrictedByOversightIncidentId: linkedOversightIncidentId,
          restrictionNote: note,
          restrictionReleasedAt: null,
          restrictionReleasedByOperatorId: null,
          restrictionReleasedByOperatorRole: null,
          restrictionReleaseNote: null,
        },
        include: internalVaultInclude,
      });

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: restrictedVault.id,
          eventType: RetirementVaultEventType.restricted,
          actorType: "operator",
          actorId: operatorId,
          metadata: {
            reasonCode,
            note,
            operatorRole: normalizedOperatorRole,
            oversightIncidentId: linkedOversightIncidentId,
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId: restrictedVault.customerAccount.customer.id,
          actorType: "operator",
          actorId: operatorId,
          action: "retirement_vault.restricted",
          targetType: "RetirementVault",
          targetId: restrictedVault.id,
          metadata: {
            customerAccountId: restrictedVault.customerAccount.id,
            reasonCode,
            note,
            operatorRole: normalizedOperatorRole,
            oversightIncidentId: linkedOversightIncidentId,
          },
        },
      });

      return restrictedVault;
    });

    return {
      vault: this.mapInternalRetirementVaultProjection(updatedVault),
      stateReused: false,
    };
  }

  async releaseInternalVaultRestriction(
    vaultId: string,
    operatorId: string,
    operatorRole?: string | null,
    dto?: ReleaseRetirementVaultRestrictionDto
  ): Promise<UpdateInternalRetirementVaultRestrictionResult> {
    const normalizedOperatorRole = this.assertCanReleaseVaultRestriction(operatorRole);
    const existingVault = await this.loadInternalVaultById(vaultId);

    if (existingVault.status !== RetirementVaultStatus.restricted) {
      return {
        vault: this.mapInternalRetirementVaultProjection(existingVault),
        stateReused: true,
      };
    }

    const note = this.normalizeOptionalString(dto?.note);
    const occurredAt = new Date();

    const updatedVault = await this.prismaService.$transaction(async (transaction) => {
      const unrestrictedVault = await transaction.retirementVault.update({
        where: {
          id: existingVault.id,
        },
        data: {
          status: RetirementVaultStatus.active,
          restrictionReleasedAt: occurredAt,
          restrictionReleasedByOperatorId: operatorId,
          restrictionReleasedByOperatorRole: normalizedOperatorRole,
          restrictionReleaseNote: note,
        },
        include: internalVaultInclude,
      });

      await transaction.retirementVaultEvent.create({
        data: {
          retirementVaultId: unrestrictedVault.id,
          eventType: RetirementVaultEventType.restriction_released,
          actorType: "operator",
          actorId: operatorId,
          metadata: {
            operatorRole: normalizedOperatorRole,
            note,
            restrictedByOversightIncidentId:
              unrestrictedVault.restrictedByOversightIncidentId,
          },
        },
      });

      await transaction.auditEvent.create({
        data: {
          customerId: unrestrictedVault.customerAccount.customer.id,
          actorType: "operator",
          actorId: operatorId,
          action: "retirement_vault.restriction_released",
          targetType: "RetirementVault",
          targetId: unrestrictedVault.id,
          metadata: {
            customerAccountId: unrestrictedVault.customerAccount.id,
            operatorRole: normalizedOperatorRole,
            note,
            restrictedByOversightIncidentId:
              unrestrictedVault.restrictedByOversightIncidentId,
          },
        },
      });

      return unrestrictedVault;
    });

    return {
      vault: this.mapInternalRetirementVaultProjection(updatedVault),
      stateReused: false,
    };
  }

  async listInternalReleaseRequests(
    query: ListInternalRetirementVaultReleaseRequestsDto
  ): Promise<ListInternalRetirementVaultReleaseRequestsResult> {
    const limit = query.limit ?? 25;
    const where: Prisma.RetirementVaultReleaseRequestWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    const releaseRequests =
      await this.prismaService.retirementVaultReleaseRequest.findMany({
        where,
        include: internalReleaseRequestInclude,
        orderBy: {
          updatedAt: "desc",
        },
        take: limit,
      });

    return {
      releaseRequests: releaseRequests.map((request) =>
        this.mapInternalReleaseRequestProjection(request)
      ),
      limit,
    };
  }

  async getInternalReleaseRequestWorkspace(
    releaseRequestId: string
  ): Promise<GetInternalRetirementVaultReleaseRequestWorkspaceResult> {
    const releaseRequest =
      await this.prismaService.retirementVaultReleaseRequest.findUnique({
        where: {
          id: releaseRequestId,
        },
        include: internalReleaseRequestInclude,
      });

    if (!releaseRequest) {
      throw new NotFoundException("Retirement vault release request not found.");
    }

    const [vaultEvents, relatedAuditEvents] = await Promise.all([
      this.prismaService.retirementVaultEvent.findMany({
        where: {
          retirementVaultId: releaseRequest.retirementVaultId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
      this.prismaService.auditEvent.findMany({
        where: {
          OR: [
            {
              targetType: "RetirementVaultReleaseRequest",
              targetId: releaseRequest.id,
            },
            {
              targetType: "RetirementVault",
              targetId: releaseRequest.retirementVaultId,
            },
            releaseRequest.reviewCaseId
              ? {
                  targetType: "ReviewCase",
                  targetId: releaseRequest.reviewCaseId,
                }
              : undefined,
            releaseRequest.transactionIntentId
              ? {
                  targetType: "TransactionIntent",
                  targetId: releaseRequest.transactionIntentId,
                }
              : undefined,
          ].filter(Boolean) as Prisma.AuditEventWhereInput[],
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 30,
      }),
    ]);

    return {
      releaseRequest: this.mapInternalReleaseRequestProjection(releaseRequest),
      vaultEvents: vaultEvents.map((event) =>
        this.mapRetirementVaultEventProjection(event)
      ),
      relatedAuditEvents: relatedAuditEvents.map((event) =>
        this.mapAuditTimelineProjection(event)
      ),
    };
  }

  async approveInternalReleaseRequest(
    releaseRequestId: string,
    operatorId: string,
    operatorRole?: string | null,
    note?: string
  ): Promise<DecideInternalRetirementVaultReleaseRequestResult> {
    const normalizedOperatorRole = this.assertCanDecideRelease(operatorRole);
    const normalizedNote = this.normalizeOptionalString(note);
    const existingRequest =
      await this.prismaService.retirementVaultReleaseRequest.findUnique({
        where: {
          id: releaseRequestId,
        },
        include: internalReleaseRequestInclude,
      });

    if (!existingRequest) {
      throw new NotFoundException("Retirement vault release request not found.");
    }

    if (
      existingRequest.status === RetirementVaultReleaseRequestStatus.cooldown_active ||
      existingRequest.status === RetirementVaultReleaseRequestStatus.ready_for_release ||
      existingRequest.status === RetirementVaultReleaseRequestStatus.executing ||
      existingRequest.status === RetirementVaultReleaseRequestStatus.released
    ) {
      return {
        releaseRequest: this.mapInternalReleaseRequestProjection(existingRequest),
        stateReused: true,
      };
    }

    this.assertReleaseRequestActionable(existingRequest, [
      RetirementVaultReleaseRequestStatus.review_required,
    ]);

    const occurredAt = new Date();
    const cooldownEndsAt = this.buildCooldownEndsAt(
      occurredAt,
      existingRequest.retirementVault.strictMode,
      existingRequest.requestKind
    );

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const approvedRequest = await transaction.retirementVaultReleaseRequest.update({
          where: {
            id: existingRequest.id,
          },
          data: {
            status: RetirementVaultReleaseRequestStatus.cooldown_active,
            reviewDecidedAt: occurredAt,
            approvedAt: occurredAt,
            approvedByOperatorId: operatorId,
            approvedByOperatorRole: normalizedOperatorRole,
            cooldownStartedAt: occurredAt,
            cooldownEndsAt,
            executionFailureCode: null,
            executionFailureReason: null,
          },
          include: internalReleaseRequestInclude,
        });

        await this.closeLinkedReviewCase({
          transaction,
          reviewCaseId: approvedRequest.reviewCaseId,
          actorType: "operator",
          actorId: operatorId,
          note:
            normalizedNote ??
            "Retirement vault early unlock approved and moved into cooldown.",
          disposition: "resolved",
          customerId:
            approvedRequest.retirementVault.customerAccount.customer.id ?? null,
          releaseRequestId: approvedRequest.id,
        });

        await transaction.retirementVaultEvent.createMany({
          data: [
            {
              retirementVaultId: approvedRequest.retirementVaultId,
              eventType: RetirementVaultEventType.release_approved,
              actorType: "operator",
              actorId: operatorId,
              metadata: {
                releaseRequestId: approvedRequest.id,
                operatorRole: normalizedOperatorRole,
                note: normalizedNote,
              },
            },
            {
              retirementVaultId: approvedRequest.retirementVaultId,
              eventType: RetirementVaultEventType.cooldown_started,
              actorType: "operator",
              actorId: operatorId,
              metadata: {
                releaseRequestId: approvedRequest.id,
                operatorRole: normalizedOperatorRole,
                cooldownEndsAt: cooldownEndsAt.toISOString(),
              },
            },
          ],
        });

        await transaction.auditEvent.create({
          data: {
            customerId:
              approvedRequest.retirementVault.customerAccount.customer.id ?? null,
            actorType: "operator",
            actorId: operatorId,
            action: "retirement_vault.release_approved",
            targetType: "RetirementVaultReleaseRequest",
            targetId: approvedRequest.id,
            metadata: {
              retirementVaultId: approvedRequest.retirementVaultId,
              status: approvedRequest.status,
              operatorRole: normalizedOperatorRole,
              cooldownEndsAt: cooldownEndsAt.toISOString(),
              reviewCaseId: approvedRequest.reviewCaseId,
              note: normalizedNote,
            },
          },
        });

        return approvedRequest;
      }
    );

    return {
      releaseRequest: this.mapInternalReleaseRequestProjection(updatedRequest),
      stateReused: false,
    };
  }

  async rejectInternalReleaseRequest(
    releaseRequestId: string,
    operatorId: string,
    operatorRole?: string | null,
    note?: string
  ): Promise<DecideInternalRetirementVaultReleaseRequestResult> {
    const normalizedOperatorRole = this.assertCanDecideRelease(operatorRole);
    const normalizedNote = this.normalizeOptionalString(note);
    const existingRequest =
      await this.prismaService.retirementVaultReleaseRequest.findUnique({
        where: {
          id: releaseRequestId,
        },
        include: internalReleaseRequestInclude,
      });

    if (!existingRequest) {
      throw new NotFoundException("Retirement vault release request not found.");
    }

    if (existingRequest.status === RetirementVaultReleaseRequestStatus.rejected) {
      return {
        releaseRequest: this.mapInternalReleaseRequestProjection(existingRequest),
        stateReused: true,
      };
    }

    this.assertReleaseRequestActionable(existingRequest, [
      RetirementVaultReleaseRequestStatus.review_required,
    ]);

    const occurredAt = new Date();

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const rejectedRequest = await transaction.retirementVaultReleaseRequest.update({
          where: {
            id: existingRequest.id,
          },
          data: {
            status: RetirementVaultReleaseRequestStatus.rejected,
            reviewDecidedAt: occurredAt,
            rejectedAt: occurredAt,
            rejectedByOperatorId: operatorId,
            rejectedByOperatorRole: normalizedOperatorRole,
          },
          include: internalReleaseRequestInclude,
        });

        await this.closeLinkedReviewCase({
          transaction,
          reviewCaseId: rejectedRequest.reviewCaseId,
          actorType: "operator",
          actorId: operatorId,
          note:
            normalizedNote ??
            "Retirement vault early unlock rejected after operator review.",
          disposition: "resolved",
          customerId:
            rejectedRequest.retirementVault.customerAccount.customer.id ?? null,
          releaseRequestId: rejectedRequest.id,
        });

        await transaction.retirementVaultEvent.create({
          data: {
            retirementVaultId: rejectedRequest.retirementVaultId,
            eventType: RetirementVaultEventType.release_rejected,
            actorType: "operator",
            actorId: operatorId,
            metadata: {
              releaseRequestId: rejectedRequest.id,
              operatorRole: normalizedOperatorRole,
              note: normalizedNote,
            },
          },
        });

        await transaction.auditEvent.create({
          data: {
            customerId:
              rejectedRequest.retirementVault.customerAccount.customer.id ?? null,
            actorType: "operator",
            actorId: operatorId,
            action: "retirement_vault.release_rejected",
            targetType: "RetirementVaultReleaseRequest",
            targetId: rejectedRequest.id,
            metadata: {
              retirementVaultId: rejectedRequest.retirementVaultId,
              status: rejectedRequest.status,
              operatorRole: normalizedOperatorRole,
              reviewCaseId: rejectedRequest.reviewCaseId,
              note: normalizedNote,
            },
          },
        });

        return rejectedRequest;
      }
    );

    return {
      releaseRequest: this.mapInternalReleaseRequestProjection(updatedRequest),
      stateReused: false,
    };
  }

  async approveInternalRuleChangeRequest(
    ruleChangeRequestId: string,
    operatorId: string,
    operatorRole?: string | null,
    note?: string,
  ): Promise<DecideInternalRetirementVaultRuleChangeRequestResult> {
    const normalizedOperatorRole = this.assertCanDecideRelease(operatorRole);
    const normalizedNote = this.normalizeOptionalString(note);
    const existingRequest =
      await this.prismaService.retirementVaultRuleChangeRequest.findUnique({
        where: {
          id: ruleChangeRequestId,
        },
        include: internalRuleChangeRequestInclude,
      });

    if (!existingRequest) {
      throw new NotFoundException(
        "Retirement vault rule change request not found.",
      );
    }

    if (
      existingRequest.status ===
        RetirementVaultRuleChangeRequestStatus.cooldown_active ||
      existingRequest.status ===
        RetirementVaultRuleChangeRequestStatus.ready_to_apply ||
      existingRequest.status === RetirementVaultRuleChangeRequestStatus.applying ||
      existingRequest.status === RetirementVaultRuleChangeRequestStatus.applied
    ) {
      return {
        ruleChangeRequest: this.mapRuleChangeRequestProjection(existingRequest),
        stateReused: true,
      };
    }

    this.assertRuleChangeRequestActionable(existingRequest, [
      RetirementVaultRuleChangeRequestStatus.review_required,
    ]);

    const occurredAt = new Date();
    const cooldownEndsAt = this.buildRuleChangeCooldownEndsAt(
      occurredAt,
      existingRequest.currentStrictMode,
    );

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const approvedRequest =
          await transaction.retirementVaultRuleChangeRequest.update({
            where: {
              id: existingRequest.id,
            },
            data: {
              status: RetirementVaultRuleChangeRequestStatus.cooldown_active,
              reviewDecidedAt: occurredAt,
              approvedAt: occurredAt,
              approvedByOperatorId: operatorId,
              approvedByOperatorRole: normalizedOperatorRole,
              cooldownStartedAt: occurredAt,
              cooldownEndsAt,
              applyFailureCode: null,
              applyFailureReason: null,
            },
            include: retirementVaultRuleChangeRequestInclude,
          });

        await this.closeLinkedRuleChangeReviewCase({
          transaction,
          reviewCaseId: approvedRequest.reviewCaseId,
          actorType: "operator",
          actorId: operatorId,
          note:
            normalizedNote ??
            "Retirement vault rule weakening approved and moved into cooldown.",
          disposition: "resolved",
          customerId: existingRequest.retirementVault.customerAccount.customer.id,
          ruleChangeRequestId: approvedRequest.id,
        });

        await transaction.retirementVaultEvent.createMany({
          data: [
            {
              retirementVaultId: approvedRequest.retirementVaultId,
              eventType: RetirementVaultEventType.rule_change_approved,
              actorType: "operator",
              actorId: operatorId,
              metadata: {
                ruleChangeRequestId: approvedRequest.id,
                operatorRole: normalizedOperatorRole,
                note: normalizedNote,
              },
            },
            {
              retirementVaultId: approvedRequest.retirementVaultId,
              eventType: RetirementVaultEventType.rule_change_cooldown_started,
              actorType: "operator",
              actorId: operatorId,
              metadata: {
                ruleChangeRequestId: approvedRequest.id,
                operatorRole: normalizedOperatorRole,
                cooldownEndsAt: cooldownEndsAt.toISOString(),
              },
            },
          ],
        });

        await transaction.auditEvent.create({
          data: {
            customerId: existingRequest.retirementVault.customerAccount.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action: "retirement_vault.rule_change_approved",
            targetType: "RetirementVaultRuleChangeRequest",
            targetId: approvedRequest.id,
            metadata: {
              retirementVaultId: approvedRequest.retirementVaultId,
              status: approvedRequest.status,
              operatorRole: normalizedOperatorRole,
              cooldownEndsAt: cooldownEndsAt.toISOString(),
              reviewCaseId: approvedRequest.reviewCaseId,
              note: normalizedNote,
            },
          },
        });

        return approvedRequest;
      },
    );

    return {
      ruleChangeRequest: this.mapRuleChangeRequestProjection(updatedRequest),
      stateReused: false,
    };
  }

  async rejectInternalRuleChangeRequest(
    ruleChangeRequestId: string,
    operatorId: string,
    operatorRole?: string | null,
    note?: string,
  ): Promise<DecideInternalRetirementVaultRuleChangeRequestResult> {
    const normalizedOperatorRole = this.assertCanDecideRelease(operatorRole);
    const normalizedNote = this.normalizeOptionalString(note);
    const existingRequest =
      await this.prismaService.retirementVaultRuleChangeRequest.findUnique({
        where: {
          id: ruleChangeRequestId,
        },
        include: internalRuleChangeRequestInclude,
      });

    if (!existingRequest) {
      throw new NotFoundException(
        "Retirement vault rule change request not found.",
      );
    }

    if (existingRequest.status === RetirementVaultRuleChangeRequestStatus.rejected) {
      return {
        ruleChangeRequest: this.mapRuleChangeRequestProjection(existingRequest),
        stateReused: true,
      };
    }

    this.assertRuleChangeRequestActionable(existingRequest, [
      RetirementVaultRuleChangeRequestStatus.review_required,
    ]);

    const occurredAt = new Date();

    const updatedRequest = await this.prismaService.$transaction(
      async (transaction) => {
        const rejectedRequest =
          await transaction.retirementVaultRuleChangeRequest.update({
            where: {
              id: existingRequest.id,
            },
            data: {
              status: RetirementVaultRuleChangeRequestStatus.rejected,
              reviewDecidedAt: occurredAt,
              rejectedAt: occurredAt,
              rejectedByOperatorId: operatorId,
              rejectedByOperatorRole: normalizedOperatorRole,
            },
            include: retirementVaultRuleChangeRequestInclude,
          });

        await this.closeLinkedRuleChangeReviewCase({
          transaction,
          reviewCaseId: rejectedRequest.reviewCaseId,
          actorType: "operator",
          actorId: operatorId,
          note:
            normalizedNote ??
            "Retirement vault rule weakening rejected after operator review.",
          disposition: "resolved",
          customerId: existingRequest.retirementVault.customerAccount.customer.id,
          ruleChangeRequestId: rejectedRequest.id,
        });

        await transaction.retirementVaultEvent.create({
          data: {
            retirementVaultId: rejectedRequest.retirementVaultId,
            eventType: RetirementVaultEventType.rule_change_rejected,
            actorType: "operator",
            actorId: operatorId,
            metadata: {
              ruleChangeRequestId: rejectedRequest.id,
              operatorRole: normalizedOperatorRole,
              note: normalizedNote,
            },
          },
        });

        await transaction.auditEvent.create({
          data: {
            customerId: existingRequest.retirementVault.customerAccount.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action: "retirement_vault.rule_change_rejected",
            targetType: "RetirementVaultRuleChangeRequest",
            targetId: rejectedRequest.id,
            metadata: {
              retirementVaultId: rejectedRequest.retirementVaultId,
              status: rejectedRequest.status,
              operatorRole: normalizedOperatorRole,
              reviewCaseId: rejectedRequest.reviewCaseId,
              note: normalizedNote,
            },
          },
        });

        return rejectedRequest;
      },
    );

    return {
      ruleChangeRequest: this.mapRuleChangeRequestProjection(updatedRequest),
      stateReused: false,
    };
  }

  async sweepRuleChangeRequests(
    workerId: string,
    limit: number,
  ): Promise<SweepRetirementVaultRuleChangeRequestsResult> {
    const now = new Date();
    const staleReviewBefore = new Date(
      now.getTime() - RETIREMENT_VAULT_REVIEW_STALE_SECONDS * 1000,
    );
    const staleApplyBefore = new Date(
      now.getTime() - RETIREMENT_VAULT_RELEASE_STALE_GRACE_SECONDS * 1000,
    );
    const staleApplyingBefore = new Date(
      now.getTime() - RETIREMENT_VAULT_EXECUTING_STALE_SECONDS * 1000,
    );
    const processedRuleChangeRequestIds: string[] = [];
    let readyToApplyCount = 0;
    let appliedCount = 0;
    let failedCount = 0;

    const cooldownReadyRequests =
      await this.prismaService.retirementVaultRuleChangeRequest.findMany({
        where: {
          status: RetirementVaultRuleChangeRequestStatus.cooldown_active,
          cooldownEndsAt: {
            lte: now,
          },
          retirementVault: {
            status: RetirementVaultStatus.active,
            customerAccount: {
              status: AccountLifecycleStatus.active,
            },
          },
        },
        orderBy: {
          cooldownEndsAt: "asc",
        },
        take: limit,
      });

    for (const request of cooldownReadyRequests) {
      const transitioned = await this.prismaService.$transaction(
        async (transaction) => {
          const transitionCount =
            await transaction.retirementVaultRuleChangeRequest.updateMany({
              where: {
                id: request.id,
                status: RetirementVaultRuleChangeRequestStatus.cooldown_active,
                cooldownEndsAt: {
                  lte: now,
                },
              },
              data: {
                status: RetirementVaultRuleChangeRequestStatus.ready_to_apply,
              },
            });

          if (transitionCount.count !== 1) {
            return false;
          }

          await transaction.retirementVaultEvent.create({
            data: {
              retirementVaultId: request.retirementVaultId,
              eventType: RetirementVaultEventType.rule_change_cooldown_completed,
              actorType: "worker",
              actorId: workerId,
              metadata: {
                ruleChangeRequestId: request.id,
                cooldownEndsAt: request.cooldownEndsAt?.toISOString() ?? null,
              },
            },
          });

          await transaction.auditEvent.create({
            data: {
              actorType: "worker",
              actorId: workerId,
              action: "retirement_vault.rule_change_cooldown_completed",
              targetType: "RetirementVaultRuleChangeRequest",
              targetId: request.id,
              metadata: {
                retirementVaultId: request.retirementVaultId,
                cooldownEndsAt: request.cooldownEndsAt?.toISOString() ?? null,
              },
            },
          });

          return true;
        },
      );

      if (transitioned) {
        readyToApplyCount += 1;
      }
    }

    const readyRequests =
      await this.prismaService.retirementVaultRuleChangeRequest.findMany({
        where: {
          status: RetirementVaultRuleChangeRequestStatus.ready_to_apply,
          retirementVault: {
            status: RetirementVaultStatus.active,
            customerAccount: {
              status: AccountLifecycleStatus.active,
            },
          },
        },
        include: internalRuleChangeRequestInclude,
        orderBy: {
          updatedAt: "asc",
        },
        take: limit,
      });

    for (const request of readyRequests) {
      const claimedCount =
        await this.prismaService.retirementVaultRuleChangeRequest.updateMany({
          where: {
            id: request.id,
            status: RetirementVaultRuleChangeRequestStatus.ready_to_apply,
          },
          data: {
            status: RetirementVaultRuleChangeRequestStatus.applying,
            applyStartedAt: new Date(),
            appliedByWorkerId: workerId,
          },
        });

      if (claimedCount.count !== 1) {
        continue;
      }

      try {
        await this.prismaService.$transaction(async (transaction) => {
          const currentRequest =
            await transaction.retirementVaultRuleChangeRequest.findUnique({
              where: {
                id: request.id,
              },
              include: internalRuleChangeRequestInclude,
            });

          if (!currentRequest) {
            throw new NotFoundException(
              "Retirement vault rule change request not found.",
            );
          }

          if (
            currentRequest.status !== RetirementVaultRuleChangeRequestStatus.applying
          ) {
            throw new ConflictException(
              "Retirement vault rule change request is no longer applying.",
            );
          }

          await transaction.retirementVault.update({
            where: {
              id: currentRequest.retirementVaultId,
            },
            data: {
              unlockAt: currentRequest.requestedUnlockAt,
              strictMode: currentRequest.requestedStrictMode,
            },
          });

          const appliedAt = new Date();

          await transaction.retirementVaultRuleChangeRequest.update({
            where: {
              id: currentRequest.id,
            },
            data: {
              status: RetirementVaultRuleChangeRequestStatus.applied,
              appliedAt,
              applyFailureCode: null,
              applyFailureReason: null,
            },
          });

          await transaction.retirementVaultEvent.create({
            data: {
              retirementVaultId: currentRequest.retirementVaultId,
              eventType: RetirementVaultEventType.rule_change_applied,
              actorType: "worker",
              actorId: workerId,
              metadata: {
                ruleChangeRequestId: currentRequest.id,
                previousUnlockAt: currentRequest.currentUnlockAt.toISOString(),
                requestedUnlockAt: currentRequest.requestedUnlockAt.toISOString(),
                previousStrictMode: currentRequest.currentStrictMode,
                requestedStrictMode: currentRequest.requestedStrictMode,
              },
            },
          });

          await transaction.auditEvent.create({
            data: {
              customerId: currentRequest.retirementVault.customerAccount.customer.id,
              actorType: "worker",
              actorId: workerId,
              action: "retirement_vault.rule_change_applied",
              targetType: "RetirementVaultRuleChangeRequest",
              targetId: currentRequest.id,
              metadata: {
                retirementVaultId: currentRequest.retirementVaultId,
                previousUnlockAt: currentRequest.currentUnlockAt.toISOString(),
                requestedUnlockAt: currentRequest.requestedUnlockAt.toISOString(),
                previousStrictMode: currentRequest.currentStrictMode,
                requestedStrictMode: currentRequest.requestedStrictMode,
              },
            },
          });
        });

        appliedCount += 1;
        processedRuleChangeRequestIds.push(request.id);
      } catch (error) {
        const failureMessage =
          error instanceof Error
            ? error.message
            : "Retirement vault rule change application failed.";

        await this.prismaService.$transaction(async (transaction) => {
          await transaction.retirementVaultRuleChangeRequest.update({
            where: {
              id: request.id,
            },
            data: {
              status: RetirementVaultRuleChangeRequestStatus.failed,
              applyFailureCode: "rule_change_apply_failed",
              applyFailureReason: failureMessage,
            },
          });

          await transaction.retirementVaultEvent.create({
            data: {
              retirementVaultId: request.retirementVaultId,
              eventType: RetirementVaultEventType.rule_change_failed,
              actorType: "worker",
              actorId: workerId,
              metadata: {
                ruleChangeRequestId: request.id,
                failureCode: "rule_change_apply_failed",
                failureReason: failureMessage,
              },
            },
          });

          await transaction.auditEvent.create({
            data: {
              customerId: request.retirementVault.customerAccount.customer.id,
              actorType: "worker",
              actorId: workerId,
              action: "retirement_vault.rule_change_failed",
              targetType: "RetirementVaultRuleChangeRequest",
              targetId: request.id,
              metadata: {
                retirementVaultId: request.retirementVaultId,
                failureCode: "rule_change_apply_failed",
                failureReason: failureMessage,
              },
            },
          });
        });

        failedCount += 1;
        processedRuleChangeRequestIds.push(request.id);
      }
    }

    const [
      blockedRuleChangeCount,
      staleReviewRequiredCount,
      staleCooldownCount,
      staleReadyToApplyCount,
      staleApplyingCount,
    ] = await Promise.all([
      this.prismaService.retirementVaultRuleChangeRequest.count({
        where: {
          status: {
            in: [
              RetirementVaultRuleChangeRequestStatus.cooldown_active,
              RetirementVaultRuleChangeRequestStatus.ready_to_apply,
              RetirementVaultRuleChangeRequestStatus.applying,
            ],
          },
          OR: [
            {
              retirementVault: {
                status: RetirementVaultStatus.restricted,
              },
            },
            {
              retirementVault: {
                customerAccount: {
                  status: {
                    not: AccountLifecycleStatus.active,
                  },
                },
              },
            },
          ],
        },
      }),
      this.prismaService.retirementVaultRuleChangeRequest.count({
        where: {
          status: RetirementVaultRuleChangeRequestStatus.review_required,
          updatedAt: {
            lte: staleReviewBefore,
          },
        },
      }),
      this.prismaService.retirementVaultRuleChangeRequest.count({
        where: {
          status: RetirementVaultRuleChangeRequestStatus.cooldown_active,
          cooldownEndsAt: {
            lt: staleApplyBefore,
          },
        },
      }),
      this.prismaService.retirementVaultRuleChangeRequest.count({
        where: {
          status: RetirementVaultRuleChangeRequestStatus.ready_to_apply,
          updatedAt: {
            lte: staleApplyBefore,
          },
        },
      }),
      this.prismaService.retirementVaultRuleChangeRequest.count({
        where: {
          status: RetirementVaultRuleChangeRequestStatus.applying,
          updatedAt: {
            lte: staleApplyingBefore,
          },
        },
      }),
    ]);

    return {
      limit,
      readyToApplyCount,
      appliedCount,
      failedCount,
      blockedRuleChangeCount,
      staleReviewRequiredCount,
      staleCooldownCount,
      staleReadyToApplyCount,
      staleApplyingCount,
      processedRuleChangeRequestIds,
    };
  }

  async sweepReleaseRequests(
    workerId: string,
    limit: number
  ): Promise<SweepRetirementVaultReleaseRequestsResult> {
    const now = new Date();
    const staleReviewBefore = new Date(
      now.getTime() - RETIREMENT_VAULT_REVIEW_STALE_SECONDS * 1000,
    );
    const staleReleaseBefore = new Date(
      now.getTime() - RETIREMENT_VAULT_RELEASE_STALE_GRACE_SECONDS * 1000,
    );
    const staleExecutingBefore = new Date(
      now.getTime() - RETIREMENT_VAULT_EXECUTING_STALE_SECONDS * 1000,
    );
    const processedReleaseRequestIds: string[] = [];
    let readyForReleaseCount = 0;
    let releasedCount = 0;
    let failedCount = 0;

    const cooldownReadyRequests =
      await this.prismaService.retirementVaultReleaseRequest.findMany({
        where: {
          status: RetirementVaultReleaseRequestStatus.cooldown_active,
          cooldownEndsAt: {
            lte: now,
          },
          retirementVault: {
            status: RetirementVaultStatus.active,
            customerAccount: {
              status: AccountLifecycleStatus.active,
            },
          },
        },
        orderBy: {
          cooldownEndsAt: "asc",
        },
        take: limit,
      });

    for (const request of cooldownReadyRequests) {
      const transitioned = await this.prismaService.$transaction(async (transaction) => {
        const transitionCount = await transaction.retirementVaultReleaseRequest.updateMany({
          where: {
            id: request.id,
            status: RetirementVaultReleaseRequestStatus.cooldown_active,
            cooldownEndsAt: {
              lte: now,
            },
          },
          data: {
            status: RetirementVaultReleaseRequestStatus.ready_for_release,
            readyForReleaseAt: now,
          },
        });

        if (transitionCount.count !== 1) {
          return false;
        }

        await transaction.retirementVaultEvent.create({
          data: {
            retirementVaultId: request.retirementVaultId,
            eventType: RetirementVaultEventType.cooldown_completed,
            actorType: "worker",
            actorId: workerId,
            metadata: {
              releaseRequestId: request.id,
              cooldownEndsAt: request.cooldownEndsAt?.toISOString() ?? null,
            },
          },
        });

        await transaction.auditEvent.create({
          data: {
            actorType: "worker",
            actorId: workerId,
            action: "retirement_vault.cooldown_completed",
            targetType: "RetirementVaultReleaseRequest",
            targetId: request.id,
            metadata: {
              retirementVaultId: request.retirementVaultId,
              cooldownEndsAt: request.cooldownEndsAt?.toISOString() ?? null,
            },
          },
        });

        return true;
      });

      if (transitioned) {
        readyForReleaseCount += 1;
      }
    }

    const readyRequests =
      await this.prismaService.retirementVaultReleaseRequest.findMany({
        where: {
          status: RetirementVaultReleaseRequestStatus.ready_for_release,
          retirementVault: {
            status: RetirementVaultStatus.active,
            customerAccount: {
              status: AccountLifecycleStatus.active,
            },
          },
        },
        include: internalReleaseRequestInclude,
        orderBy: {
          readyForReleaseAt: "asc",
        },
        take: limit,
      });

    for (const request of readyRequests) {
      const claimedCount =
        await this.prismaService.retirementVaultReleaseRequest.updateMany({
          where: {
            id: request.id,
            status: RetirementVaultReleaseRequestStatus.ready_for_release,
          },
          data: {
            status: RetirementVaultReleaseRequestStatus.executing,
            executionStartedAt: new Date(),
            executedByWorkerId: workerId,
          },
        });

      if (claimedCount.count !== 1) {
        continue;
      }

      try {
        await this.prismaService.$transaction(async (transaction) => {
          const currentRequest =
            await transaction.retirementVaultReleaseRequest.findUnique({
              where: {
                id: request.id,
              },
              include: internalReleaseRequestInclude,
            });

          if (!currentRequest) {
            throw new NotFoundException(
              "Retirement vault release request not found."
            );
          }

          if (
            currentRequest.status !==
            RetirementVaultReleaseRequestStatus.executing
          ) {
            throw new ConflictException(
              "Retirement vault release request is no longer executing."
            );
          }

          const idempotencyKey = `vault_release:${currentRequest.id}`;

          const releaseIntent = await transaction.transactionIntent.create({
            data: {
              customerAccountId:
                currentRequest.retirementVault.customerAccount.id,
              retirementVaultId: currentRequest.retirementVaultId,
              assetId: currentRequest.retirementVault.asset.id,
              chainId: this.productChainId,
              intentType: TransactionIntentType.vault_redemption,
              status: TransactionIntentStatus.settled,
              policyDecision: PolicyDecision.approved,
              requestedAmount: currentRequest.requestedAmount,
              settledAmount: currentRequest.requestedAmount,
              idempotencyKey,
            },
          });

          const ledgerResult =
            await this.ledgerService.releaseRetirementVaultBalance(transaction, {
              transactionIntentId: releaseIntent.id,
              retirementVaultId: currentRequest.retirementVaultId,
              customerAccountId: currentRequest.retirementVault.customerAccount.id,
              assetId: currentRequest.retirementVault.asset.id,
              chainId: this.productChainId,
              amount: currentRequest.requestedAmount,
            });

          const releaseOccurredAt = new Date();

          const updatedVault = await transaction.retirementVault.update({
            where: {
              id: currentRequest.retirementVaultId,
            },
            data: {
              status:
                ledgerResult.lockedBalance === "0"
                  ? RetirementVaultStatus.released
                  : RetirementVaultStatus.active,
            },
          });

          await transaction.retirementVaultReleaseRequest.update({
            where: {
              id: currentRequest.id,
            },
            data: {
              status: RetirementVaultReleaseRequestStatus.released,
              releasedAt: releaseOccurredAt,
              transactionIntentId: releaseIntent.id,
              executionFailureCode: null,
              executionFailureReason: null,
            },
          });

          await transaction.retirementVaultEvent.create({
            data: {
              retirementVaultId: currentRequest.retirementVaultId,
              eventType: RetirementVaultEventType.released,
              actorType: "worker",
              actorId: workerId,
              metadata: {
                releaseRequestId: currentRequest.id,
                transactionIntentId: releaseIntent.id,
                ledgerJournalId: ledgerResult.ledgerJournalId,
                availableBalanceAfter: ledgerResult.availableBalance,
                lockedBalanceAfter: ledgerResult.lockedBalance,
                vaultStatusAfter: updatedVault.status,
              },
            },
          });

          await transaction.auditEvent.create({
            data: {
              customerId:
                currentRequest.retirementVault.customerAccount.customer.id,
              actorType: "worker",
              actorId: workerId,
              action: "retirement_vault.released",
              targetType: "RetirementVaultReleaseRequest",
              targetId: currentRequest.id,
              metadata: {
                retirementVaultId: currentRequest.retirementVaultId,
                transactionIntentId: releaseIntent.id,
                ledgerJournalId: ledgerResult.ledgerJournalId,
                availableBalanceAfter: ledgerResult.availableBalance,
                lockedBalanceAfter: ledgerResult.lockedBalance,
                vaultStatusAfter: updatedVault.status,
              },
            },
          });
        });

        releasedCount += 1;
        processedReleaseRequestIds.push(request.id);
      } catch (error) {
        const failureMessage =
          error instanceof Error
            ? error.message
            : "Retirement vault release execution failed.";

        await this.prismaService.$transaction(async (transaction) => {
          await transaction.retirementVaultReleaseRequest.update({
            where: {
              id: request.id,
            },
            data: {
              status: RetirementVaultReleaseRequestStatus.failed,
              executionFailureCode: "release_execution_failed",
              executionFailureReason: failureMessage,
            },
          });

          await transaction.retirementVaultEvent.create({
            data: {
              retirementVaultId: request.retirementVaultId,
              eventType: RetirementVaultEventType.release_failed,
              actorType: "worker",
              actorId: workerId,
              metadata: {
                releaseRequestId: request.id,
                failureCode: "release_execution_failed",
                failureReason: failureMessage,
              },
            },
          });

          await transaction.auditEvent.create({
            data: {
              customerId: request.retirementVault.customerAccount.customer.id,
              actorType: "worker",
              actorId: workerId,
              action: "retirement_vault.release_failed",
              targetType: "RetirementVaultReleaseRequest",
              targetId: request.id,
              metadata: {
                retirementVaultId: request.retirementVaultId,
                failureCode: "release_execution_failed",
                failureReason: failureMessage,
              },
            },
          });
        });

        failedCount += 1;
        processedReleaseRequestIds.push(request.id);
      }
    }

    const [
      blockedReleaseCount,
      staleReviewRequiredCount,
      staleCooldownCount,
      staleReadyForReleaseCount,
      staleExecutingCount,
    ] = await Promise.all([
      this.prismaService.retirementVaultReleaseRequest.count({
        where: {
          status: {
            in: [
              RetirementVaultReleaseRequestStatus.cooldown_active,
              RetirementVaultReleaseRequestStatus.ready_for_release,
              RetirementVaultReleaseRequestStatus.executing,
            ],
          },
          OR: [
            {
              retirementVault: {
                status: RetirementVaultStatus.restricted,
              },
            },
            {
              retirementVault: {
                customerAccount: {
                  status: {
                    not: AccountLifecycleStatus.active,
                  },
                },
              },
            },
          ],
        },
      }),
      this.prismaService.retirementVaultReleaseRequest.count({
        where: {
          status: RetirementVaultReleaseRequestStatus.review_required,
          updatedAt: {
            lte: staleReviewBefore,
          },
        },
      }),
      this.prismaService.retirementVaultReleaseRequest.count({
        where: {
          status: RetirementVaultReleaseRequestStatus.cooldown_active,
          cooldownEndsAt: {
            lt: staleReleaseBefore,
          },
        },
      }),
      this.prismaService.retirementVaultReleaseRequest.count({
        where: {
          status: RetirementVaultReleaseRequestStatus.ready_for_release,
          updatedAt: {
            lte: staleReleaseBefore,
          },
        },
      }),
      this.prismaService.retirementVaultReleaseRequest.count({
        where: {
          status: RetirementVaultReleaseRequestStatus.executing,
          updatedAt: {
            lte: staleExecutingBefore,
          },
        },
      }),
    ]);

    return {
      limit,
      readyForReleaseCount,
      releasedCount,
      failedCount,
      blockedReleaseCount,
      staleReviewRequiredCount,
      staleCooldownCount,
      staleReadyForReleaseCount,
      staleExecutingCount,
      processedReleaseRequestIds,
    };
  }
}
