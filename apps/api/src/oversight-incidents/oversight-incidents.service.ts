import {
  AccountLifecycleStatus,
  BlockchainTransactionStatus,
  CustomerAccountRestrictionStatus,
  OversightIncidentEventType,
  OversightIncidentStatus,
  OversightIncidentType,
  Prisma,
  ReviewCaseType,
  TransactionIntentType
} from "@prisma/client";
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  loadAccountHoldPolicyRuntimeConfig,
  loadProductChainRuntimeConfig
} from "@stealth-trails-bank/config/api";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewCasesService } from "../review-cases/review-cases.service";
import { AddOversightIncidentNoteDto } from "./dto/add-oversight-incident-note.dto";
import { ApplyAccountRestrictionDto } from "./dto/apply-account-restriction.dto";
import { DismissOversightIncidentDto } from "./dto/dismiss-oversight-incident.dto";
import { GetOversightIncidentWorkspaceDto } from "./dto/get-oversight-incident-workspace.dto";
import { ListOversightAlertsDto } from "./dto/list-oversight-alerts.dto";
import { ListOversightIncidentsDto } from "./dto/list-oversight-incidents.dto";
import { OpenCustomerOversightIncidentDto } from "./dto/open-customer-oversight-incident.dto";
import { OpenOperatorOversightIncidentDto } from "./dto/open-operator-oversight-incident.dto";
import { ResolveOversightIncidentDto } from "./dto/resolve-oversight-incident.dto";
import { StartOversightIncidentDto } from "./dto/start-oversight-incident.dto";

const manuallyResolvedIntentInclude = {
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

const customerAccountRestrictionSnapshotSelect = {
  id: true,
  customerId: true,
  status: true,
  restrictedAt: true,
  restrictedFromStatus: true,
  restrictionReasonCode: true,
  restrictedByOperatorId: true,
  restrictedByOversightIncidentId: true,
  restrictionReleasedAt: true,
  restrictionReleasedByOperatorId: true
} satisfies Prisma.CustomerAccountSelect;

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
    select: customerAccountRestrictionSnapshotSelect
  }
} satisfies Prisma.OversightIncidentInclude;

type OversightIncidentRecord = Prisma.OversightIncidentGetPayload<{
  include: typeof oversightIncidentInclude;
}>;

type OversightIncidentEventRecord = Prisma.OversightIncidentEventGetPayload<{}>;

type ManuallyResolvedIntentRecord = Prisma.TransactionIntentGetPayload<{
  include: typeof manuallyResolvedIntentInclude;
}>;

type ReviewCaseSummaryRecord = Prisma.ReviewCaseGetPayload<{
  select: {
    id: true;
    type: true;
    status: true;
    reasonCode: true;
    assignedOperatorId: true;
    transactionIntentId: true;
    customerAccountId: true;
    updatedAt: true;
    resolvedAt: true;
  };
}>;

type SubjectCustomerAccountRecord = Prisma.CustomerAccountGetPayload<{
  select: typeof customerAccountRestrictionSnapshotSelect;
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

type ManuallyResolvedIntentProjection = {
  id: string;
  customer: {
    customerId: string;
    customerAccountId: string;
    supabaseUserId: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  asset: {
    id: string;
    symbol: string;
    displayName: string;
    decimals: number;
    chainId: number;
  };
  intentType: TransactionIntentType;
  requestedAmount: string;
  settledAmount: string | null;
  failureCode: string | null;
  failureReason: string | null;
  sourceWalletAddress: string | null;
  destinationWalletAddress: string | null;
  externalAddress: string | null;
  manuallyResolvedAt: string;
  manualResolutionReasonCode: string | null;
  manualResolutionNote: string | null;
  manualResolvedByOperatorId: string | null;
  manualResolutionOperatorRole: string | null;
  manualResolutionReviewCaseId: string | null;
  latestBlockchainTransaction: LatestBlockchainTransactionProjection | null;
};

type OversightAccountRestrictionProjection = {
  active: boolean;
  customerAccountId: string | null;
  accountStatus: AccountLifecycleStatus | null;
  restrictedAt: string | null;
  restrictedFromStatus: AccountLifecycleStatus | null;
  restrictionReasonCode: string | null;
  restrictedByOperatorId: string | null;
  restrictedByOversightIncidentId: string | null;
  restrictionReleasedAt: string | null;
  restrictionReleasedByOperatorId: string | null;
};

type OversightAccountHoldGovernanceProjection = {
  operatorRole: string | null;
  canApplyAccountHold: boolean;
  canReleaseAccountHold: boolean;
  allowedApplyOperatorRoles: string[];
  allowedReleaseOperatorRoles: string[];
};

type OversightIncidentProjection = {
  id: string;
  incidentType: OversightIncidentType;
  status: OversightIncidentStatus;
  reasonCode: string | null;
  summaryNote: string | null;
  subjectCustomer: {
    customerId: string | null;
    customerAccountId: string | null;
    supabaseUserId: string | null;
    email: string | null;
    firstName: string;
    lastName: string;
  };
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

type OversightIncidentEventProjection = {
  id: string;
  actorType: string;
  actorId: string | null;
  eventType: OversightIncidentEventType;
  note: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: string;
};

type ReviewCaseSummaryProjection = {
  id: string;
  type: string;
  status: string;
  reasonCode: string | null;
  assignedOperatorId: string | null;
  transactionIntentId: string | null;
  customerAccountId: string | null;
  updatedAt: string;
  resolvedAt: string | null;
};

type OversightAlertProjection = {
  incidentType: OversightIncidentType;
  subjectCustomer: {
    customerId: string | null;
    customerAccountId: string | null;
    supabaseUserId: string | null;
    email: string | null;
    firstName: string;
    lastName: string;
  } | null;
  subjectOperatorId: string | null;
  subjectOperatorRole: string | null;
  count: number;
  threshold: number;
  sinceDays: number;
  latestManualResolutionAt: string;
  reasonCodeBreakdown: {
    manualResolutionReasonCode: string;
    count: number;
  }[];
  openIncidentId: string | null;
  recommendedAction: "open_incident" | "monitor_existing_incident";
};

type ListOversightAlertsResult = {
  alerts: OversightAlertProjection[];
  limit: number;
  sinceDays: number;
  customerThreshold: number;
  operatorThreshold: number;
};

type OpenOversightIncidentResult = {
  oversightIncident: OversightIncidentProjection;
  oversightIncidentReused: boolean;
};

type ListOversightIncidentsResult = {
  oversightIncidents: OversightIncidentProjection[];
  limit: number;
};

type GetOversightIncidentResult = {
  oversightIncident: OversightIncidentProjection;
};

type OversightIncidentWorkspaceResult = {
  oversightIncident: OversightIncidentProjection;
  accountRestriction: OversightAccountRestrictionProjection;
  accountHoldGovernance: OversightAccountHoldGovernanceProjection;
  events: OversightIncidentEventProjection[];
  recentManuallyResolvedIntents: ManuallyResolvedIntentProjection[];
  recentReviewCases: ReviewCaseSummaryProjection[];
  recentLimit: number;
};

type UpdateOversightIncidentStateResult = {
  oversightIncident: OversightIncidentProjection;
  stateReused: boolean;
};

type AddOversightIncidentNoteResult = {
  oversightIncident: OversightIncidentProjection;
  event: OversightIncidentEventProjection;
};

type UpdateOversightAccountRestrictionResult = {
  oversightIncident: OversightIncidentProjection;
  accountRestriction: OversightAccountRestrictionProjection;
  stateReused: boolean;
};

@Injectable()
export class OversightIncidentsService {
  private readonly productChainId: number;
  private readonly accountHoldApplyAllowedOperatorRoles: string[];
  private readonly accountHoldReleaseAllowedOperatorRoles: string[];

  constructor(
    private readonly prismaService: PrismaService,
    private readonly reviewCasesService: ReviewCasesService
  ) {
    this.productChainId = loadProductChainRuntimeConfig().productChainId;
    const accountHoldPolicy = loadAccountHoldPolicyRuntimeConfig();
    this.accountHoldApplyAllowedOperatorRoles = [
      ...accountHoldPolicy.accountHoldApplyAllowedOperatorRoles
    ];
    this.accountHoldReleaseAllowedOperatorRoles = [
      ...accountHoldPolicy.accountHoldReleaseAllowedOperatorRoles
    ];
  }

  private buildSinceDate(sinceDays: number): Date {
    const now = new Date();
    const sinceDate = new Date(now);
    sinceDate.setUTCDate(now.getUTCDate() - sinceDays);
    return sinceDate;
  }

  private mapLatestBlockchainTransaction(
    intent: ManuallyResolvedIntentRecord
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

  private mapManuallyResolvedIntentProjection(
    intent: ManuallyResolvedIntentRecord
  ): ManuallyResolvedIntentProjection {
    return {
      id: intent.id,
      customer: {
        customerId: intent.customerAccount!.customer.id,
        customerAccountId: intent.customerAccount!.id,
        supabaseUserId: intent.customerAccount!.customer.supabaseUserId,
        email: intent.customerAccount!.customer.email,
        firstName: intent.customerAccount!.customer.firstName ?? "",
        lastName: intent.customerAccount!.customer.lastName ?? ""
      },
      asset: {
        id: intent.asset.id,
        symbol: intent.asset.symbol,
        displayName: intent.asset.displayName,
        decimals: intent.asset.decimals,
        chainId: intent.asset.chainId
      },
      intentType: intent.intentType,
      requestedAmount: intent.requestedAmount.toString(),
      settledAmount: intent.settledAmount?.toString() ?? null,
      failureCode: intent.failureCode,
      failureReason: intent.failureReason,
      sourceWalletAddress: intent.sourceWallet?.address ?? null,
      destinationWalletAddress: intent.destinationWallet?.address ?? null,
      externalAddress: intent.externalAddress ?? null,
      manuallyResolvedAt: intent.manuallyResolvedAt!.toISOString(),
      manualResolutionReasonCode: intent.manualResolutionReasonCode,
      manualResolutionNote: intent.manualResolutionNote,
      manualResolvedByOperatorId: intent.manualResolvedByOperatorId,
      manualResolutionOperatorRole: intent.manualResolutionOperatorRole,
      manualResolutionReviewCaseId: intent.manualResolutionReviewCaseId,
      latestBlockchainTransaction: this.mapLatestBlockchainTransaction(intent)
    };
  }

  private mapAccountRestrictionProjection(
    customerAccount: SubjectCustomerAccountRecord | null
  ): OversightAccountRestrictionProjection {
    return {
      active: customerAccount?.status === AccountLifecycleStatus.restricted,
      customerAccountId: customerAccount?.id ?? null,
      accountStatus: customerAccount?.status ?? null,
      restrictedAt: customerAccount?.restrictedAt?.toISOString() ?? null,
      restrictedFromStatus: customerAccount?.restrictedFromStatus ?? null,
      restrictionReasonCode: customerAccount?.restrictionReasonCode ?? null,
      restrictedByOperatorId: customerAccount?.restrictedByOperatorId ?? null,
      restrictedByOversightIncidentId:
        customerAccount?.restrictedByOversightIncidentId ?? null,
      restrictionReleasedAt:
        customerAccount?.restrictionReleasedAt?.toISOString() ?? null,
      restrictionReleasedByOperatorId:
        customerAccount?.restrictionReleasedByOperatorId ?? null
    };
  }

  private mapOversightIncidentProjection(
    incident: OversightIncidentRecord
  ): OversightIncidentProjection {
    return {
      id: incident.id,
      incidentType: incident.incidentType,
      status: incident.status,
      reasonCode: incident.reasonCode,
      summaryNote: incident.summaryNote,
      subjectCustomer: {
        customerId: incident.subjectCustomer?.id ?? null,
        customerAccountId: incident.subjectCustomerAccountId ?? null,
        supabaseUserId: incident.subjectCustomer?.supabaseUserId ?? null,
        email: incident.subjectCustomer?.email ?? null,
        firstName: incident.subjectCustomer?.firstName ?? "",
        lastName: incident.subjectCustomer?.lastName ?? ""
      },
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

  private mapOversightIncidentEventProjection(
    event: OversightIncidentEventRecord
  ): OversightIncidentEventProjection {
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

  private normalizeOperatorRole(operatorRole?: string): string | null {
    const normalizedOperatorRole = operatorRole?.trim().toLowerCase() ?? null;
    return normalizedOperatorRole && normalizedOperatorRole.length > 0
      ? normalizedOperatorRole
      : null;
  }

  private isOperatorRoleAuthorized(
    operatorRole: string | null,
    allowedRoles: readonly string[]
  ): boolean {
    return operatorRole !== null && allowedRoles.includes(operatorRole);
  }

  private canApplyAccountHoldForIncident(
    incident: OversightIncidentRecord,
    operatorRole: string | null
  ): boolean {
    const subjectCustomerAccount = incident.subjectCustomerAccount;

    if (
      !subjectCustomerAccount ||
      incident.status === OversightIncidentStatus.resolved ||
      incident.status === OversightIncidentStatus.dismissed
    ) {
      return false;
    }

    if (
      !this.isOperatorRoleAuthorized(
        operatorRole,
        this.accountHoldApplyAllowedOperatorRoles
      )
    ) {
      return false;
    }

    return (
      subjectCustomerAccount.status !== AccountLifecycleStatus.restricted &&
      subjectCustomerAccount.status !== AccountLifecycleStatus.frozen &&
      subjectCustomerAccount.status !== AccountLifecycleStatus.closed
    );
  }

  private canReleaseAccountHoldForIncident(
    incident: OversightIncidentRecord,
    operatorRole: string | null
  ): boolean {
    const subjectCustomerAccount = incident.subjectCustomerAccount;

    if (
      !subjectCustomerAccount ||
      incident.status === OversightIncidentStatus.dismissed
    ) {
      return false;
    }

    if (
      !this.isOperatorRoleAuthorized(
        operatorRole,
        this.accountHoldReleaseAllowedOperatorRoles
      )
    ) {
      return false;
    }

    return (
      subjectCustomerAccount.status === AccountLifecycleStatus.restricted &&
      subjectCustomerAccount.restrictedByOversightIncidentId === incident.id &&
      subjectCustomerAccount.restrictionReleasedAt === null
    );
  }

  private buildAccountHoldGovernanceProjection(
    incident: OversightIncidentRecord,
    operatorRole?: string
  ): OversightAccountHoldGovernanceProjection {
    const normalizedOperatorRole = this.normalizeOperatorRole(operatorRole);

    return {
      operatorRole: normalizedOperatorRole,
      canApplyAccountHold: this.canApplyAccountHoldForIncident(
        incident,
        normalizedOperatorRole
      ),
      canReleaseAccountHold: this.canReleaseAccountHoldForIncident(
        incident,
        normalizedOperatorRole
      ),
      allowedApplyOperatorRoles: [...this.accountHoldApplyAllowedOperatorRoles],
      allowedReleaseOperatorRoles: [...this.accountHoldReleaseAllowedOperatorRoles]
    };
  }

  private assertCanApplyAccountHold(operatorRole?: string): string | null {
    const normalizedOperatorRole = this.normalizeOperatorRole(operatorRole);

    if (
      !this.isOperatorRoleAuthorized(
        normalizedOperatorRole,
        this.accountHoldApplyAllowedOperatorRoles
      )
    ) {
      throw new ForbiddenException(
        "Operator role is not authorized to place account holds."
      );
    }

    return normalizedOperatorRole;
  }

  private mapReviewCaseSummaryProjection(
    reviewCase: ReviewCaseSummaryRecord
  ): ReviewCaseSummaryProjection {
    return {
      id: reviewCase.id,
      type: reviewCase.type,
      status: reviewCase.status,
      reasonCode: reviewCase.reasonCode,
      assignedOperatorId: reviewCase.assignedOperatorId,
      transactionIntentId: reviewCase.transactionIntentId,
      customerAccountId: reviewCase.customerAccountId,
      updatedAt: reviewCase.updatedAt.toISOString(),
      resolvedAt: reviewCase.resolvedAt?.toISOString() ?? null
    };
  }

  private async openOrReuseRestrictionReleaseReviewCase(
    transaction: Prisma.TransactionClient,
    incident: OversightIncidentRecord,
    customerAccountId: string,
    operatorId: string,
    note: string | null
  ): Promise<{ reviewCaseId: string }> {
    const result = await this.reviewCasesService.openOrReuseReviewCase(
      transaction,
      {
        customerId: incident.subjectCustomerId,
        customerAccountId,
        transactionIntentId: null,
        type: ReviewCaseType.account_review,
        reasonCode: null,
        notes: note,
        actorType: "operator",
        actorId: operatorId,
        auditAction: "review_case.account_review.opened",
        auditMetadata: {
          oversightIncidentId: incident.id,
          oversightIncidentType: incident.incidentType
        }
      }
    );

    return {
      reviewCaseId: result.reviewCase.id
    };
  }

  private async findOversightIncidentById(
    oversightIncidentId: string
  ): Promise<OversightIncidentRecord | null> {
    return this.prismaService.oversightIncident.findUnique({
      where: {
        id: oversightIncidentId
      },
      include: oversightIncidentInclude
    });
  }

  private ensureOversightIncidentIsActionable(
    incident: OversightIncidentRecord
  ): void {
    if (incident.status === OversightIncidentStatus.resolved) {
      throw new ConflictException("Oversight incident is already resolved.");
    }

    if (incident.status === OversightIncidentStatus.dismissed) {
      throw new ConflictException("Oversight incident is already dismissed.");
    }
  }

  private ensureOperatorCanMutateOversightIncident(
    incident: OversightIncidentRecord,
    operatorId: string
  ): void {
    if (
      incident.status === OversightIncidentStatus.in_progress &&
      incident.assignedOperatorId &&
      incident.assignedOperatorId !== operatorId
    ) {
      throw new ConflictException(
        "Oversight incident is currently assigned to another operator."
      );
    }
  }

  private async appendOversightIncidentEvent(
    client: Prisma.TransactionClient | PrismaService,
    oversightIncidentId: string,
    actorType: string,
    actorId: string | null,
    eventType: OversightIncidentEventType,
    note: string | null,
    metadata: Prisma.InputJsonValue | null
  ): Promise<OversightIncidentEventRecord> {
    return client.oversightIncidentEvent.create({
      data: {
        oversightIncidentId,
        actorType,
        actorId,
        eventType,
        note,
        metadata: metadata ?? Prisma.JsonNull
      }
    });
  }

  private async listMatchingManuallyResolvedIntentsForCustomer(
    customerAccountId: string,
    sinceDays: number
  ): Promise<ManuallyResolvedIntentRecord[]> {
    return this.prismaService.transactionIntent.findMany({
      where: {
        chainId: this.productChainId,
        customerAccountId,
        manuallyResolvedAt: {
          gte: this.buildSinceDate(sinceDays)
        }
      },
      orderBy: {
        manuallyResolvedAt: "desc"
      },
      include: manuallyResolvedIntentInclude
    });
  }

  private async listMatchingManuallyResolvedIntentsForOperator(
    subjectOperatorId: string,
    sinceDays: number
  ): Promise<ManuallyResolvedIntentRecord[]> {
    return this.prismaService.transactionIntent.findMany({
      where: {
        chainId: this.productChainId,
        manualResolvedByOperatorId: subjectOperatorId,
        manuallyResolvedAt: {
          gte: this.buildSinceDate(sinceDays)
        }
      },
      orderBy: {
        manuallyResolvedAt: "desc"
      },
      include: manuallyResolvedIntentInclude
    });
  }

  async listOversightAlerts(
    query: ListOversightAlertsDto
  ): Promise<ListOversightAlertsResult> {
    const limit = query.limit ?? 20;
    const sinceDays = query.sinceDays ?? 30;
    const customerThreshold = query.customerThreshold ?? 2;
    const operatorThreshold = query.operatorThreshold ?? 3;

    const intents = await this.prismaService.transactionIntent.findMany({
      where: {
        chainId: this.productChainId,
        manuallyResolvedAt: {
          gte: this.buildSinceDate(sinceDays)
        }
      },
      orderBy: {
        manuallyResolvedAt: "desc"
      },
      include: manuallyResolvedIntentInclude
    });

    const openIncidents = await this.prismaService.oversightIncident.findMany({
      where: {
        status: {
          in: [OversightIncidentStatus.open, OversightIncidentStatus.in_progress]
        }
      },
      include: oversightIncidentInclude
    });

    const openCustomerIncidentMap = new Map<string, string>();
    const openOperatorIncidentMap = new Map<string, string>();

    for (const incident of openIncidents) {
      if (
        incident.incidentType ===
          OversightIncidentType.customer_manual_resolution_spike &&
        incident.subjectCustomerAccountId
      ) {
        openCustomerIncidentMap.set(
          incident.subjectCustomerAccountId,
          incident.id
        );
      }

      if (
        incident.incidentType ===
          OversightIncidentType.operator_manual_resolution_spike &&
        incident.subjectOperatorId
      ) {
        openOperatorIncidentMap.set(incident.subjectOperatorId, incident.id);
      }
    }

    const customerGroups = new Map<
      string,
      {
        subjectCustomer: OversightAlertProjection["subjectCustomer"];
        count: number;
        latestManualResolutionAt: Date;
        reasonCodes: Map<string, number>;
      }
    >();

    const operatorGroups = new Map<
      string,
      {
        subjectOperatorId: string;
        subjectOperatorRole: string | null;
        count: number;
        latestManualResolutionAt: Date;
        reasonCodes: Map<string, number>;
      }
    >();

    for (const intent of intents) {
      const reasonCode =
        intent.manualResolutionReasonCode ?? "unknown_reason_code";

      if (intent.customerAccountId && intent.customerAccount) {
        const existingCustomerAggregate =
          customerGroups.get(intent.customerAccountId) ?? {
            subjectCustomer: {
              customerId: intent.customerAccount.customer.id,
              customerAccountId: intent.customerAccount.id,
              supabaseUserId: intent.customerAccount.customer.supabaseUserId,
              email: intent.customerAccount.customer.email,
              firstName: intent.customerAccount.customer.firstName ?? "",
              lastName: intent.customerAccount.customer.lastName ?? ""
            },
            count: 0,
            latestManualResolutionAt: intent.manuallyResolvedAt!,
            reasonCodes: new Map<string, number>()
          };

        existingCustomerAggregate.count += 1;

        if (
          intent.manuallyResolvedAt! >
          existingCustomerAggregate.latestManualResolutionAt
        ) {
          existingCustomerAggregate.latestManualResolutionAt =
            intent.manuallyResolvedAt!;
        }

        existingCustomerAggregate.reasonCodes.set(
          reasonCode,
          (existingCustomerAggregate.reasonCodes.get(reasonCode) ?? 0) + 1
        );

        customerGroups.set(intent.customerAccountId, existingCustomerAggregate);
      }

      if (intent.manualResolvedByOperatorId) {
        const existingOperatorAggregate =
          operatorGroups.get(intent.manualResolvedByOperatorId) ?? {
            subjectOperatorId: intent.manualResolvedByOperatorId,
            subjectOperatorRole: intent.manualResolutionOperatorRole,
            count: 0,
            latestManualResolutionAt: intent.manuallyResolvedAt!,
            reasonCodes: new Map<string, number>()
          };

        existingOperatorAggregate.count += 1;

        if (
          intent.manuallyResolvedAt! >
          existingOperatorAggregate.latestManualResolutionAt
        ) {
          existingOperatorAggregate.latestManualResolutionAt =
            intent.manuallyResolvedAt!;
        }

        existingOperatorAggregate.reasonCodes.set(
          reasonCode,
          (existingOperatorAggregate.reasonCodes.get(reasonCode) ?? 0) + 1
        );

        operatorGroups.set(
          intent.manualResolvedByOperatorId,
          existingOperatorAggregate
        );
      }
    }

    const alerts: OversightAlertProjection[] = [];

    if (
      !query.incidentType ||
      query.incidentType === "customer_manual_resolution_spike"
    ) {
      for (const [customerAccountId, aggregate] of customerGroups.entries()) {
        if (aggregate.count < customerThreshold) {
          continue;
        }

        const openIncidentId =
          openCustomerIncidentMap.get(customerAccountId) ?? null;

        alerts.push({
          incidentType: OversightIncidentType.customer_manual_resolution_spike,
          subjectCustomer: aggregate.subjectCustomer,
          subjectOperatorId: null,
          subjectOperatorRole: null,
          count: aggregate.count,
          threshold: customerThreshold,
          sinceDays,
          latestManualResolutionAt:
            aggregate.latestManualResolutionAt.toISOString(),
          reasonCodeBreakdown: Array.from(aggregate.reasonCodes.entries())
            .map(([manualResolutionReasonCode, count]) => ({
              manualResolutionReasonCode,
              count
            }))
            .sort((left, right) => right.count - left.count),
          openIncidentId,
          recommendedAction: openIncidentId
            ? "monitor_existing_incident"
            : "open_incident"
        });
      }
    }

    if (
      !query.incidentType ||
      query.incidentType === "operator_manual_resolution_spike"
    ) {
      for (const [subjectOperatorId, aggregate] of operatorGroups.entries()) {
        if (aggregate.count < operatorThreshold) {
          continue;
        }

        const openIncidentId =
          openOperatorIncidentMap.get(subjectOperatorId) ?? null;

        alerts.push({
          incidentType: OversightIncidentType.operator_manual_resolution_spike,
          subjectCustomer: null,
          subjectOperatorId: aggregate.subjectOperatorId,
          subjectOperatorRole: aggregate.subjectOperatorRole,
          count: aggregate.count,
          threshold: operatorThreshold,
          sinceDays,
          latestManualResolutionAt:
            aggregate.latestManualResolutionAt.toISOString(),
          reasonCodeBreakdown: Array.from(aggregate.reasonCodes.entries())
            .map(([manualResolutionReasonCode, count]) => ({
              manualResolutionReasonCode,
              count
            }))
            .sort((left, right) => right.count - left.count),
          openIncidentId,
          recommendedAction: openIncidentId
            ? "monitor_existing_incident"
            : "open_incident"
        });
      }
    }

    return {
      alerts: alerts
        .sort((left, right) => {
          if (right.count !== left.count) {
            return right.count - left.count;
          }

          return (
            new Date(right.latestManualResolutionAt).getTime() -
            new Date(left.latestManualResolutionAt).getTime()
          );
        })
        .slice(0, limit),
      limit,
      sinceDays,
      customerThreshold,
      operatorThreshold
    };
  }

  async openCustomerOversightIncident(
    customerAccountId: string,
    operatorId: string,
    dto: OpenCustomerOversightIncidentDto
  ): Promise<OpenOversightIncidentResult> {
    const sinceDays = dto.sinceDays ?? 30;
    const threshold = dto.threshold ?? 2;
    const intents = await this.listMatchingManuallyResolvedIntentsForCustomer(
      customerAccountId,
      sinceDays
    );

    if (intents.length < threshold) {
      throw new ConflictException(
        "Customer manual resolution count is below the threshold required to open an oversight incident."
      );
    }

    const customerAccount = intents[0]?.customerAccount;

    if (!customerAccount) {
      throw new NotFoundException(
        "Customer account not found for oversight incident."
      );
    }

    const existingIncident = await this.prismaService.oversightIncident.findFirst({
      where: {
        incidentType: OversightIncidentType.customer_manual_resolution_spike,
        subjectCustomerAccountId: customerAccountId,
        status: {
          in: [OversightIncidentStatus.open, OversightIncidentStatus.in_progress]
        }
      },
      include: oversightIncidentInclude
    });

    if (existingIncident) {
      return {
        oversightIncident: this.mapOversightIncidentProjection(existingIncident),
        oversightIncidentReused: true
      };
    }

    const createdIncident = await this.prismaService.$transaction(
      async (transaction) => {
        const incident = await transaction.oversightIncident.create({
          data: {
            incidentType: OversightIncidentType.customer_manual_resolution_spike,
            status: OversightIncidentStatus.open,
            reasonCode: "manual_resolution_threshold_exceeded",
            summaryNote:
              dto.note?.trim() ??
              "Customer exceeded manual resolution threshold within the review window.",
            subjectCustomerId: customerAccount.customer.id,
            subjectCustomerAccountId: customerAccount.id,
            subjectOperatorId: null,
            subjectOperatorRole: null,
            assignedOperatorId: null
          },
          include: oversightIncidentInclude
        });

        await this.appendOversightIncidentEvent(
          transaction,
          incident.id,
          "operator",
          operatorId,
          OversightIncidentEventType.opened,
          dto.note?.trim() ?? null,
          {
            sinceDays,
            threshold,
            currentCount: intents.length,
            incidentType: OversightIncidentType.customer_manual_resolution_spike
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: customerAccount.customer.id,
            actorType: "operator",
            actorId: operatorId,
            action: "oversight_incident.opened",
            targetType: "OversightIncident",
            targetId: incident.id,
            metadata: {
              incidentType: OversightIncidentType.customer_manual_resolution_spike,
              subjectCustomerAccountId: customerAccount.id,
              subjectCustomerId: customerAccount.customer.id,
              sinceDays,
              threshold,
              currentCount: intents.length,
              note: dto.note?.trim() ?? null
            }
          }
        });

        return incident;
      }
    );

    return {
      oversightIncident: this.mapOversightIncidentProjection(createdIncident),
      oversightIncidentReused: false
    };
  }

  async openOperatorOversightIncident(
    subjectOperatorId: string,
    operatorId: string,
    dto: OpenOperatorOversightIncidentDto
  ): Promise<OpenOversightIncidentResult> {
    const sinceDays = dto.sinceDays ?? 30;
    const threshold = dto.threshold ?? 3;
    const intents = await this.listMatchingManuallyResolvedIntentsForOperator(
      subjectOperatorId,
      sinceDays
    );

    if (intents.length < threshold) {
      throw new ConflictException(
        "Operator manual resolution count is below the threshold required to open an oversight incident."
      );
    }

    const subjectOperatorRole = intents[0]?.manualResolutionOperatorRole ?? null;

    const existingIncident = await this.prismaService.oversightIncident.findFirst({
      where: {
        incidentType: OversightIncidentType.operator_manual_resolution_spike,
        subjectOperatorId,
        status: {
          in: [OversightIncidentStatus.open, OversightIncidentStatus.in_progress]
        }
      },
      include: oversightIncidentInclude
    });

    if (existingIncident) {
      return {
        oversightIncident: this.mapOversightIncidentProjection(existingIncident),
        oversightIncidentReused: true
      };
    }

    const createdIncident = await this.prismaService.$transaction(
      async (transaction) => {
        const incident = await transaction.oversightIncident.create({
          data: {
            incidentType: OversightIncidentType.operator_manual_resolution_spike,
            status: OversightIncidentStatus.open,
            reasonCode: "manual_resolution_threshold_exceeded",
            summaryNote:
              dto.note?.trim() ??
              "Operator exceeded manual resolution threshold within the review window.",
            subjectCustomerId: null,
            subjectCustomerAccountId: null,
            subjectOperatorId,
            subjectOperatorRole,
            assignedOperatorId: null
          },
          include: oversightIncidentInclude
        });

        await this.appendOversightIncidentEvent(
          transaction,
          incident.id,
          "operator",
          operatorId,
          OversightIncidentEventType.opened,
          dto.note?.trim() ?? null,
          {
            sinceDays,
            threshold,
            currentCount: intents.length,
            incidentType: OversightIncidentType.operator_manual_resolution_spike,
            subjectOperatorId,
            subjectOperatorRole
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: null,
            actorType: "operator",
            actorId: operatorId,
            action: "oversight_incident.opened",
            targetType: "OversightIncident",
            targetId: incident.id,
            metadata: {
              incidentType: OversightIncidentType.operator_manual_resolution_spike,
              subjectOperatorId,
              subjectOperatorRole,
              sinceDays,
              threshold,
              currentCount: intents.length,
              note: dto.note?.trim() ?? null
            }
          }
        });

        return incident;
      }
    );

    return {
      oversightIncident: this.mapOversightIncidentProjection(createdIncident),
      oversightIncidentReused: false
    };
  }

  async listOversightIncidents(
    query: ListOversightIncidentsDto
  ): Promise<ListOversightIncidentsResult> {
    const limit = query.limit ?? 20;
    const where: Prisma.OversightIncidentWhereInput = {};

    if (query.status) {
      where.status = query.status as OversightIncidentStatus;
    }

    if (query.incidentType) {
      where.incidentType = query.incidentType as OversightIncidentType;
    }

    if (query.assignedOperatorId?.trim()) {
      where.assignedOperatorId = query.assignedOperatorId.trim();
    }

    if (query.subjectCustomerAccountId?.trim()) {
      where.subjectCustomerAccountId = query.subjectCustomerAccountId.trim();
    }

    if (query.subjectOperatorId?.trim()) {
      where.subjectOperatorId = query.subjectOperatorId.trim();
    }

    if (query.reasonCode?.trim()) {
      where.reasonCode = query.reasonCode.trim();
    }

    if (query.email?.trim()) {
      where.subjectCustomer = {
        is: {
          email: query.email.trim().toLowerCase()
        }
      };
    }

    const incidents = await this.prismaService.oversightIncident.findMany({
      where,
      orderBy: {
        updatedAt: "desc"
      },
      take: limit,
      include: oversightIncidentInclude
    });

    return {
      oversightIncidents: incidents.map((incident) =>
        this.mapOversightIncidentProjection(incident)
      ),
      limit
    };
  }

  async getOversightIncident(
    oversightIncidentId: string
  ): Promise<GetOversightIncidentResult> {
    const incident = await this.findOversightIncidentById(oversightIncidentId);

    if (!incident) {
      throw new NotFoundException("Oversight incident not found.");
    }

    return {
      oversightIncident: this.mapOversightIncidentProjection(incident)
    };
  }

  async getOversightIncidentWorkspace(
    oversightIncidentId: string,
    query: GetOversightIncidentWorkspaceDto,
    operatorRole?: string
  ): Promise<OversightIncidentWorkspaceResult> {
    const recentLimit = query.recentLimit ?? 20;
    const incident = await this.findOversightIncidentById(oversightIncidentId);

    if (!incident) {
      throw new NotFoundException("Oversight incident not found.");
    }

    const events = await this.prismaService.oversightIncidentEvent.findMany({
      where: {
        oversightIncidentId
      },
      orderBy: {
        createdAt: "asc"
      }
    });

    const recentIntentsWhere: Prisma.TransactionIntentWhereInput = {
      chainId: this.productChainId,
      manuallyResolvedAt: {
        not: null
      }
    };

    if (incident.subjectCustomerAccountId) {
      recentIntentsWhere.customerAccountId = incident.subjectCustomerAccountId;
    }

    if (incident.subjectOperatorId) {
      recentIntentsWhere.manualResolvedByOperatorId = incident.subjectOperatorId;
    }

    const recentManuallyResolvedIntents =
      await this.prismaService.transactionIntent.findMany({
        where: recentIntentsWhere,
        orderBy: {
          manuallyResolvedAt: "desc"
        },
        take: recentLimit,
        include: manuallyResolvedIntentInclude
      });

    const recentReviewCasesWhere: Prisma.ReviewCaseWhereInput = {};

    if (incident.subjectCustomerAccountId) {
      recentReviewCasesWhere.customerAccountId = incident.subjectCustomerAccountId;
    }

    if (incident.subjectOperatorId) {
      recentReviewCasesWhere.assignedOperatorId = incident.subjectOperatorId;
    }

    const recentReviewCases = await this.prismaService.reviewCase.findMany({
      where: recentReviewCasesWhere,
      orderBy: {
        updatedAt: "desc"
      },
      take: recentLimit,
      select: {
        id: true,
        type: true,
        status: true,
        reasonCode: true,
        assignedOperatorId: true,
        transactionIntentId: true,
        customerAccountId: true,
        updatedAt: true,
        resolvedAt: true
      }
    });

    return {
      oversightIncident: this.mapOversightIncidentProjection(incident),
      accountRestriction: this.mapAccountRestrictionProjection(
        incident.subjectCustomerAccount
      ),
      accountHoldGovernance: this.buildAccountHoldGovernanceProjection(
        incident,
        operatorRole
      ),
      events: events.map((event) =>
        this.mapOversightIncidentEventProjection(event)
      ),
      recentManuallyResolvedIntents: recentManuallyResolvedIntents.map((intent) =>
        this.mapManuallyResolvedIntentProjection(intent)
      ),
      recentReviewCases: recentReviewCases.map((reviewCase) =>
        this.mapReviewCaseSummaryProjection(reviewCase)
      ),
      recentLimit
    };
  }

  async startOversightIncident(
    oversightIncidentId: string,
    operatorId: string,
    dto: StartOversightIncidentDto
  ): Promise<UpdateOversightIncidentStateResult> {
    const incident = await this.findOversightIncidentById(oversightIncidentId);

    if (!incident) {
      throw new NotFoundException("Oversight incident not found.");
    }

    this.ensureOversightIncidentIsActionable(incident);
    this.ensureOperatorCanMutateOversightIncident(incident, operatorId);

    if (
      incident.status === OversightIncidentStatus.in_progress &&
      incident.assignedOperatorId === operatorId
    ) {
      return {
        oversightIncident: this.mapOversightIncidentProjection(incident),
        stateReused: true
      };
    }

    const updatedIncident = await this.prismaService.$transaction(
      async (transaction) => {
        const oversightIncident = await transaction.oversightIncident.update({
          where: {
            id: incident.id
          },
          data: {
            status: OversightIncidentStatus.in_progress,
            assignedOperatorId: operatorId,
            startedAt: incident.startedAt ?? new Date(),
            summaryNote: dto.note?.trim() ?? incident.summaryNote
          },
          include: oversightIncidentInclude
        });

        await this.appendOversightIncidentEvent(
          transaction,
          incident.id,
          "operator",
          operatorId,
          OversightIncidentEventType.started,
          dto.note?.trim() ?? null,
          {
            previousStatus: incident.status,
            newStatus: OversightIncidentStatus.in_progress,
            previousAssignedOperatorId: incident.assignedOperatorId,
            newAssignedOperatorId: operatorId
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: incident.subjectCustomerId,
            actorType: "operator",
            actorId: operatorId,
            action: "oversight_incident.started",
            targetType: "OversightIncident",
            targetId: incident.id,
            metadata: {
              previousStatus: incident.status,
              newStatus: OversightIncidentStatus.in_progress,
              previousAssignedOperatorId: incident.assignedOperatorId,
              newAssignedOperatorId: operatorId,
              note: dto.note?.trim() ?? null,
              incidentType: incident.incidentType
            }
          }
        });

        return oversightIncident;
      }
    );

    return {
      oversightIncident: this.mapOversightIncidentProjection(updatedIncident),
      stateReused: false
    };
  }

  async addOversightIncidentNote(
    oversightIncidentId: string,
    operatorId: string,
    dto: AddOversightIncidentNoteDto
  ): Promise<AddOversightIncidentNoteResult> {
    const incident = await this.findOversightIncidentById(oversightIncidentId);

    if (!incident) {
      throw new NotFoundException("Oversight incident not found.");
    }

    this.ensureOversightIncidentIsActionable(incident);
    this.ensureOperatorCanMutateOversightIncident(incident, operatorId);

    const noteText = dto.note.trim();

    const result = await this.prismaService.$transaction(async (transaction) => {
      const oversightIncident = await transaction.oversightIncident.update({
        where: {
          id: incident.id
        },
        data: {
          summaryNote: noteText
        },
        include: oversightIncidentInclude
      });

      const event = await this.appendOversightIncidentEvent(
        transaction,
        incident.id,
        "operator",
        operatorId,
        OversightIncidentEventType.note_added,
        noteText,
        {
          assignedOperatorId: incident.assignedOperatorId,
          status: incident.status
        } as Prisma.InputJsonValue
      );

      await transaction.auditEvent.create({
        data: {
          customerId: incident.subjectCustomerId,
          actorType: "operator",
          actorId: operatorId,
          action: "oversight_incident.note_added",
          targetType: "OversightIncident",
          targetId: incident.id,
          metadata: {
            note: noteText,
            assignedOperatorId: incident.assignedOperatorId,
            status: incident.status,
            incidentType: incident.incidentType
          }
        }
      });

      return {
        oversightIncident,
        event
      };
    });

    return {
      oversightIncident: this.mapOversightIncidentProjection(
        result.oversightIncident
      ),
      event: this.mapOversightIncidentEventProjection(result.event)
    };
  }

  async applyAccountRestriction(
    oversightIncidentId: string,
    operatorId: string,
    operatorRole: string | undefined,
    dto: ApplyAccountRestrictionDto
  ): Promise<UpdateOversightAccountRestrictionResult> {
    const incident = await this.findOversightIncidentById(oversightIncidentId);

    if (!incident) {
      throw new NotFoundException("Oversight incident not found.");
    }

    const normalizedOperatorRole = this.assertCanApplyAccountHold(operatorRole);

    this.ensureOversightIncidentIsActionable(incident);
    this.ensureOperatorCanMutateOversightIncident(incident, operatorId);

    if (!incident.subjectCustomerAccountId) {
      throw new ConflictException(
        "Oversight incident does not target a customer account."
      );
    }

    const customerAccount = await this.prismaService.customerAccount.findUnique({
      where: {
        id: incident.subjectCustomerAccountId
      },
      select: customerAccountRestrictionSnapshotSelect
    });

    if (!customerAccount) {
      throw new NotFoundException("Customer account not found.");
    }

    if (
      customerAccount.status === AccountLifecycleStatus.restricted &&
      customerAccount.restrictedByOversightIncidentId === incident.id &&
      !customerAccount.restrictionReleasedAt
    ) {
      return {
        oversightIncident: this.mapOversightIncidentProjection(incident),
        accountRestriction: this.mapAccountRestrictionProjection(customerAccount),
        stateReused: true
      };
    }

    if (customerAccount.status === AccountLifecycleStatus.restricted) {
      throw new ConflictException(
        "Customer account is already restricted by another active hold."
      );
    }

    if (
      customerAccount.status === AccountLifecycleStatus.frozen ||
      customerAccount.status === AccountLifecycleStatus.closed
    ) {
      throw new ConflictException(
        "Customer account is already in a stronger restricted lifecycle state."
      );
    }

    const restrictionReasonCode = dto.restrictionReasonCode.trim();
    const note = dto.note?.trim() ?? null;
    const restrictionAppliedAt = new Date();

    try {
      const result = await this.prismaService.$transaction(async (transaction) => {
        const { reviewCaseId } =
          await this.openOrReuseRestrictionReleaseReviewCase(
            transaction,
            incident,
            customerAccount.id,
            operatorId,
            note
          );

        const createdRestrictionRecord =
          await transaction.customerAccountRestriction.create({
            data: {
              customerAccountId: customerAccount.id,
              oversightIncidentId: incident.id,
              status: CustomerAccountRestrictionStatus.active,
              restrictionReasonCode,
              appliedByOperatorId: operatorId,
              appliedByOperatorRole: normalizedOperatorRole,
              appliedNote: note,
              previousStatus: customerAccount.status,
              appliedAt: restrictionAppliedAt,
              releasedAt: null,
              releasedByOperatorId: null,
              releasedByOperatorRole: null,
              releaseNote: null,
              restoredStatus: null,
              releaseDecisionStatus: "not_requested",
              releaseRequestedAt: null,
              releaseRequestedByOperatorId: null,
              releaseRequestNote: null,
              releaseDecidedAt: null,
              releaseDecidedByOperatorId: null,
              releaseDecisionNote: null,
              releaseReviewCaseId: reviewCaseId
            },
            select: {
              id: true
            }
          });

        const updatedAccount = await transaction.customerAccount.update({
          where: {
            id: customerAccount.id
          },
          data: {
            status: AccountLifecycleStatus.restricted,
            restrictedAt: restrictionAppliedAt,
            restrictedFromStatus: customerAccount.status,
            restrictionReasonCode,
            restrictedByOperatorId: operatorId,
            restrictedByOversightIncidentId: incident.id,
            restrictionReleasedAt: null,
            restrictionReleasedByOperatorId: null
          },
          select: customerAccountRestrictionSnapshotSelect
        });

        const updatedIncident = await transaction.oversightIncident.update({
          where: {
            id: incident.id
          },
          data: {
            status:
              incident.status === OversightIncidentStatus.open
                ? OversightIncidentStatus.in_progress
                : incident.status,
            assignedOperatorId: incident.assignedOperatorId ?? operatorId,
            startedAt: incident.startedAt ?? restrictionAppliedAt,
            summaryNote: note ?? incident.summaryNote
          },
          include: oversightIncidentInclude
        });

        await this.appendOversightIncidentEvent(
          transaction,
          incident.id,
          "operator",
          operatorId,
          OversightIncidentEventType.account_restriction_applied,
          note,
          {
            restrictionRecordId: createdRestrictionRecord.id,
            previousAccountStatus: customerAccount.status,
            newAccountStatus: AccountLifecycleStatus.restricted,
            restrictionReasonCode,
            appliedByOperatorId: operatorId,
            appliedByOperatorRole: normalizedOperatorRole,
            appliedAt: restrictionAppliedAt.toISOString()
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: incident.subjectCustomerId,
            actorType: "operator",
            actorId: operatorId,
            action: "customer_account.restricted",
            targetType: "CustomerAccount",
            targetId: customerAccount.id,
            metadata: {
              restrictionRecordId: createdRestrictionRecord.id,
              previousStatus: customerAccount.status,
              newStatus: AccountLifecycleStatus.restricted,
              restrictionReasonCode,
              note,
              appliedByOperatorId: operatorId,
              appliedByOperatorRole: normalizedOperatorRole,
              appliedAt: restrictionAppliedAt.toISOString(),
              oversightIncidentId: incident.id,
              oversightIncidentType: incident.incidentType
            }
          }
        });

        return {
          updatedIncident,
          updatedAccount
        };
      });

      return {
        oversightIncident: this.mapOversightIncidentProjection(
          result.updatedIncident
        ),
        accountRestriction: this.mapAccountRestrictionProjection(
          result.updatedAccount
        ),
        stateReused: false
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const [latestIncident, latestCustomerAccount] = await Promise.all([
          this.findOversightIncidentById(oversightIncidentId),
          this.prismaService.customerAccount.findUnique({
            where: {
              id: customerAccount.id
            },
            select: customerAccountRestrictionSnapshotSelect
          })
        ]);

        if (
          latestIncident &&
          latestCustomerAccount &&
          latestCustomerAccount.status === AccountLifecycleStatus.restricted &&
          latestCustomerAccount.restrictedByOversightIncidentId === incident.id &&
          latestCustomerAccount.restrictionReleasedAt === null
        ) {
          return {
            oversightIncident: this.mapOversightIncidentProjection(latestIncident),
            accountRestriction: this.mapAccountRestrictionProjection(
              latestCustomerAccount
            ),
            stateReused: true
          };
        }

        throw new ConflictException(
          "Customer account is already restricted by another active hold."
        );
      }

      throw error;
    }
  }

  async resolveOversightIncident(
    oversightIncidentId: string,
    operatorId: string,
    dto: ResolveOversightIncidentDto
  ): Promise<UpdateOversightIncidentStateResult> {
    const incident = await this.findOversightIncidentById(oversightIncidentId);

    if (!incident) {
      throw new NotFoundException("Oversight incident not found.");
    }

    if (incident.status === OversightIncidentStatus.resolved) {
      return {
        oversightIncident: this.mapOversightIncidentProjection(incident),
        stateReused: true
      };
    }

    if (incident.status === OversightIncidentStatus.dismissed) {
      throw new ConflictException("Oversight incident is already dismissed.");
    }

    this.ensureOperatorCanMutateOversightIncident(incident, operatorId);

    const updatedIncident = await this.prismaService.$transaction(
      async (transaction) => {
        const oversightIncident = await transaction.oversightIncident.update({
          where: {
            id: incident.id
          },
          data: {
            status: OversightIncidentStatus.resolved,
            resolvedAt: new Date(),
            assignedOperatorId: incident.assignedOperatorId ?? operatorId,
            summaryNote: dto.note?.trim() ?? incident.summaryNote
          },
          include: oversightIncidentInclude
        });

        await this.appendOversightIncidentEvent(
          transaction,
          incident.id,
          "operator",
          operatorId,
          OversightIncidentEventType.resolved,
          dto.note?.trim() ?? null,
          {
            previousStatus: incident.status,
            newStatus: OversightIncidentStatus.resolved
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: incident.subjectCustomerId,
            actorType: "operator",
            actorId: operatorId,
            action: "oversight_incident.resolved",
            targetType: "OversightIncident",
            targetId: incident.id,
            metadata: {
              previousStatus: incident.status,
              newStatus: OversightIncidentStatus.resolved,
              note: dto.note?.trim() ?? null,
              incidentType: incident.incidentType
            }
          }
        });

        return oversightIncident;
      }
    );

    return {
      oversightIncident: this.mapOversightIncidentProjection(updatedIncident),
      stateReused: false
    };
  }

  async dismissOversightIncident(
    oversightIncidentId: string,
    operatorId: string,
    dto: DismissOversightIncidentDto
  ): Promise<UpdateOversightIncidentStateResult> {
    const incident = await this.findOversightIncidentById(oversightIncidentId);

    if (!incident) {
      throw new NotFoundException("Oversight incident not found.");
    }

    if (incident.status === OversightIncidentStatus.dismissed) {
      return {
        oversightIncident: this.mapOversightIncidentProjection(incident),
        stateReused: true
      };
    }

    if (incident.status === OversightIncidentStatus.resolved) {
      throw new ConflictException("Oversight incident is already resolved.");
    }

    this.ensureOperatorCanMutateOversightIncident(incident, operatorId);

    const updatedIncident = await this.prismaService.$transaction(
      async (transaction) => {
        const oversightIncident = await transaction.oversightIncident.update({
          where: {
            id: incident.id
          },
          data: {
            status: OversightIncidentStatus.dismissed,
            dismissedAt: new Date(),
            assignedOperatorId: incident.assignedOperatorId ?? operatorId,
            summaryNote: dto.note?.trim() ?? incident.summaryNote
          },
          include: oversightIncidentInclude
        });

        await this.appendOversightIncidentEvent(
          transaction,
          incident.id,
          "operator",
          operatorId,
          OversightIncidentEventType.dismissed,
          dto.note?.trim() ?? null,
          {
            previousStatus: incident.status,
            newStatus: OversightIncidentStatus.dismissed
          } as Prisma.InputJsonValue
        );

        await transaction.auditEvent.create({
          data: {
            customerId: incident.subjectCustomerId,
            actorType: "operator",
            actorId: operatorId,
            action: "oversight_incident.dismissed",
            targetType: "OversightIncident",
            targetId: incident.id,
            metadata: {
              previousStatus: incident.status,
              newStatus: OversightIncidentStatus.dismissed,
              note: dto.note?.trim() ?? null,
              incidentType: incident.incidentType
            }
          }
        });

        return oversightIncident;
      }
    );

    return {
      oversightIncident: this.mapOversightIncidentProjection(updatedIncident),
      stateReused: false
    };
  }
}
