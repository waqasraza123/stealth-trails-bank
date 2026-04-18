import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import {
  loadGovernedExecutionRuntimeConfig,
  type ApiRuntimeEnvironment,
  type GovernedExecutionRuntimeConfig
} from "@stealth-trails-bank/config/api";
import {
  GovernedExecutionOverrideRequestStatus,
  Prisma,
  WalletCustodyType,
  WalletKind,
  WalletStatus,
  WorkerRuntimeEnvironment,
  WorkerRuntimeExecutionMode
} from "@prisma/client";
import { assertOperatorRoleAuthorized } from "../auth/internal-operator-role-policy";
import { PrismaService } from "../prisma/prisma.service";
import type { PrismaJsonValue } from "../prisma/prisma-json";

const RESERVE_WALLET_KINDS = [
  WalletKind.treasury,
  WalletKind.operational,
  WalletKind.contract
] as const;

const walletInclude = {
  customerAccount: {
    select: {
      id: true,
      status: true,
      customer: {
        select: {
          email: true,
          supabaseUserId: true
        }
      }
    }
  }
} satisfies Prisma.WalletInclude;

type ReserveWalletRecord = Prisma.WalletGetPayload<{
  include: typeof walletInclude;
}>;

type OverrideRecord = Prisma.GovernedExecutionOverrideRequestGetPayload<{}>;
type WorkerHeartbeatRecord = Prisma.WorkerRuntimeHeartbeatGetPayload<{}>;

type OperatorContext = {
  operatorId: string | null;
  operatorRole: string | null;
};

type OverrideProjection = {
  id: string;
  environment: WorkerRuntimeEnvironment;
  status: GovernedExecutionOverrideRequestStatus;
  allowUnsafeWithdrawalExecution: boolean;
  allowDirectLoanFunding: boolean;
  allowDirectStakingWrites: boolean;
  reasonCode: string;
  requestNote: string | null;
  requestedByOperatorId: string;
  requestedByOperatorRole: string;
  requestedAt: string;
  expiresAt: string;
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

export type GovernedExecutionWorkspaceResult = {
  generatedAt: string;
  environment: WorkerRuntimeEnvironment;
  policy: {
    governedExecutionRequiredInProduction: boolean;
    governedReserveCustodyTypes: string[];
    loanFundingExecutionMode: string;
    stakingWriteExecutionMode: string;
    overrideMaxHours: number;
  };
  posture: {
    status: "healthy" | "warning" | "critical";
    reasons: Array<{
      code: string;
      severity: "warning" | "critical";
      summary: string;
    }>;
    totalReserveWalletCount: number;
    governedReserveWalletCount: number;
    unsafeReserveWalletCount: number;
    contractControlledReserveWalletCount: number;
    multisigControlledReserveWalletCount: number;
    policyControlledReadyWorkerCount: number;
    managedWorkerCount: number;
    activeApprovedOverrideCount: number;
    pendingOverrideCount: number;
  };
  reserveWallets: Array<{
    id: string;
    chainId: number;
    address: string;
    kind: WalletKind;
    custodyType: WalletCustodyType;
    status: WalletStatus;
    governanceStatus: "governed" | "unsafe";
    governanceReason: string;
    customerAssignment: {
      customerAccountId: string;
      accountStatus: string;
      email: string | null;
      supabaseUserId: string | null;
    } | null;
    createdAt: string;
    updatedAt: string;
  }>;
  latestPendingOverrideRequest: OverrideProjection | null;
  activeApprovedOverrides: OverrideProjection[];
  recentOverrideRequests: OverrideProjection[];
  governance: {
    currentOperator: {
      operatorId: string | null;
      operatorRole: string | null;
      canRequestOverride: boolean;
      canApproveOverride: boolean;
    };
    requestAllowedOperatorRoles: string[];
    approverAllowedOperatorRoles: string[];
  };
};

type AssertManagedWithdrawalInput = {
  sourceWalletAddress: string | null;
  sourceWalletKind: WalletKind | null;
  sourceWalletCustodyType: WalletCustodyType | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMetadataBoolean(
  metadata: Prisma.JsonValue | null | undefined,
  key: string
): boolean {
  if (!isRecord(metadata)) {
    return false;
  }

  return metadata[key] === true;
}

@Injectable()
export class GovernedExecutionService {
  private readonly config: GovernedExecutionRuntimeConfig;
  private readonly governedReserveCustodyTypes: Set<string>;
  private readonly requestAllowedRoles: readonly string[];
  private readonly approverAllowedRoles: readonly string[];

  constructor(private readonly prismaService: PrismaService) {
    this.config = loadGovernedExecutionRuntimeConfig();
    this.governedReserveCustodyTypes = new Set(
      this.config.governedReserveCustodyTypes
    );
    this.requestAllowedRoles = [...this.config.requestAllowedOperatorRoles];
    this.approverAllowedRoles = [...this.config.approverAllowedOperatorRoles];
  }

  private normalizeEnvironment(
    environment: ApiRuntimeEnvironment
  ): WorkerRuntimeEnvironment {
    if (environment === "development") {
      return WorkerRuntimeEnvironment.development;
    }

    if (environment === "test") {
      return WorkerRuntimeEnvironment.test;
    }

    return WorkerRuntimeEnvironment.production;
  }

  private get environment(): WorkerRuntimeEnvironment {
    return this.normalizeEnvironment(this.config.environment);
  }

  private normalizeOptionalString(value?: string | null): string | null {
    const normalizedValue = value?.trim() ?? null;
    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  }

  private assertCanRequest(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole ?? undefined,
      this.requestAllowedRoles,
      "Operator role is not authorized to request governed execution overrides."
    );
  }

  private assertCanApprove(operatorRole?: string | null): string {
    return assertOperatorRoleAuthorized(
      operatorRole ?? undefined,
      this.approverAllowedRoles,
      "Operator role is not authorized to approve or reject governed execution overrides."
    );
  }

  private mapOverrideProjection(record: OverrideRecord): OverrideProjection {
    return {
      id: record.id,
      environment: record.environment,
      status: record.status,
      allowUnsafeWithdrawalExecution: record.allowUnsafeWithdrawalExecution,
      allowDirectLoanFunding: record.allowDirectLoanFunding,
      allowDirectStakingWrites: record.allowDirectStakingWrites,
      reasonCode: record.reasonCode,
      requestNote: record.requestNote ?? null,
      requestedByOperatorId: record.requestedByOperatorId,
      requestedByOperatorRole: record.requestedByOperatorRole,
      requestedAt: record.requestedAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
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

  private async expireStaleOverrides(now: Date): Promise<void> {
    const expired = await this.prismaService.governedExecutionOverrideRequest.updateMany({
      where: {
        environment: this.environment,
        status: {
          in: [
            GovernedExecutionOverrideRequestStatus.pending_approval,
            GovernedExecutionOverrideRequestStatus.approved
          ]
        },
        expiresAt: {
          lt: now
        }
      },
      data: {
        status: GovernedExecutionOverrideRequestStatus.expired
      }
    });

    if (expired.count > 0) {
      await this.prismaService.auditEvent.create({
        data: {
          customerId: null,
          actorType: "system",
          actorId: null,
          action: "governed_execution.override.expired",
          targetType: "GovernedExecutionOverrideRequest",
          targetId: null,
          metadata: {
            environment: this.environment,
            expiredCount: expired.count
          } as PrismaJsonValue
        }
      });
    }
  }

  private async findOverrideRecords(now: Date): Promise<OverrideRecord[]> {
    await this.expireStaleOverrides(now);

    return this.prismaService.governedExecutionOverrideRequest.findMany({
      where: {
        environment: this.environment
      },
      orderBy: {
        requestedAt: "desc"
      },
      take: 12
    });
  }

  private classifyReserveWallet(record: ReserveWalletRecord): {
    governanceStatus: "governed" | "unsafe";
    governanceReason: string;
  } {
    if (this.governedReserveCustodyTypes.has(record.custodyType)) {
      return {
        governanceStatus: "governed",
        governanceReason:
          record.custodyType === WalletCustodyType.contract_controlled
            ? "Reserve wallet executes through contract-controlled policy enforcement."
            : "Reserve wallet is held under multisig-controlled custody."
      };
    }

    return {
      governanceStatus: "unsafe",
      governanceReason:
        record.custodyType === WalletCustodyType.platform_managed
          ? "Reserve wallet depends on application-managed key custody."
          : "Reserve wallet custody type is not accepted as governed reserve custody."
    };
  }

  private buildGovernanceProjection(
    operator: OperatorContext
  ): GovernedExecutionWorkspaceResult["governance"] {
    const normalizedRole = operator.operatorRole?.trim().toLowerCase() ?? null;

    return {
      currentOperator: {
        operatorId: operator.operatorId,
        operatorRole: normalizedRole,
        canRequestOverride: normalizedRole
          ? this.requestAllowedRoles.includes(normalizedRole)
          : false,
        canApproveOverride: normalizedRole
          ? this.approverAllowedRoles.includes(normalizedRole)
          : false
      },
      requestAllowedOperatorRoles: [...this.requestAllowedRoles],
      approverAllowedOperatorRoles: [...this.approverAllowedRoles]
    };
  }

  private async getActiveApprovedOverrides(now: Date): Promise<OverrideRecord[]> {
    await this.expireStaleOverrides(now);

    return this.prismaService.governedExecutionOverrideRequest.findMany({
      where: {
        environment: this.environment,
        status: GovernedExecutionOverrideRequestStatus.approved,
        expiresAt: {
          gt: now
        }
      },
      orderBy: {
        approvedAt: "desc"
      }
    });
  }

  private hasOverride(
    overrides: OverrideRecord[],
    scope:
      | "allowUnsafeWithdrawalExecution"
      | "allowDirectLoanFunding"
      | "allowDirectStakingWrites"
  ): boolean {
    return overrides.some((record) => record[scope]);
  }

  async getWorkspace(operator: OperatorContext): Promise<GovernedExecutionWorkspaceResult> {
    const now = new Date();
    const [reserveWallets, overrideRecords, managedWorkers] = await Promise.all([
      this.prismaService.wallet.findMany({
        where: {
          kind: {
            in: [...RESERVE_WALLET_KINDS]
          },
          status: WalletStatus.active
        },
        include: walletInclude,
        orderBy: [{ kind: "asc" }, { updatedAt: "desc" }]
      }),
      this.findOverrideRecords(now),
      this.prismaService.workerRuntimeHeartbeat.findMany({
        where: {
          environment: this.environment,
          executionMode: WorkerRuntimeExecutionMode.managed
        },
        orderBy: {
          lastHeartbeatAt: "desc"
        },
        take: 6
      })
    ]);

    const activeApprovedOverrides = overrideRecords.filter(
      (record) =>
        record.status === GovernedExecutionOverrideRequestStatus.approved &&
        record.expiresAt.getTime() > now.getTime()
    );
    const latestPendingOverrideRequest =
      overrideRecords.find(
        (record) =>
          record.status ===
          GovernedExecutionOverrideRequestStatus.pending_approval
      ) ?? null;
    const reserveWalletProjections = reserveWallets.map((record) => {
      const classification = this.classifyReserveWallet(record);

      return {
        id: record.id,
        chainId: record.chainId,
        address: record.address,
        kind: record.kind,
        custodyType: record.custodyType,
        status: record.status,
        governanceStatus: classification.governanceStatus,
        governanceReason: classification.governanceReason,
        customerAssignment: record.customerAccount
          ? {
              customerAccountId: record.customerAccount.id,
              accountStatus: record.customerAccount.status,
              email: record.customerAccount.customer?.email ?? null,
              supabaseUserId:
                record.customerAccount.customer?.supabaseUserId ?? null
            }
          : null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      };
    });

    const unsafeReserveWalletCount = reserveWalletProjections.filter(
      (record) => record.governanceStatus === "unsafe"
    ).length;
    const contractControlledReserveWalletCount = reserveWalletProjections.filter(
      (record) => record.custodyType === WalletCustodyType.contract_controlled
    ).length;
    const multisigControlledReserveWalletCount = reserveWalletProjections.filter(
      (record) => record.custodyType === WalletCustodyType.multisig_controlled
    ).length;
    const policyControlledReadyWorkerCount = managedWorkers.filter((record) =>
      readMetadataBoolean(record.runtimeMetadata, "policyControlledWithdrawalReady")
    ).length;

    const reasons: GovernedExecutionWorkspaceResult["posture"]["reasons"] = [];

    if (
      this.config.governedExecutionRequiredInProduction &&
      this.environment === WorkerRuntimeEnvironment.production &&
      unsafeReserveWalletCount > 0 &&
      !this.hasOverride(activeApprovedOverrides, "allowUnsafeWithdrawalExecution")
    ) {
      reasons.push({
        code: "unsafe_reserve_wallet_custody",
        severity: "critical",
        summary:
          "Active reserve wallets still rely on non-governed custody types."
      });
    }

    if (
      this.environment === WorkerRuntimeEnvironment.production &&
      contractControlledReserveWalletCount > 0 &&
      policyControlledReadyWorkerCount === 0 &&
      !this.hasOverride(activeApprovedOverrides, "allowUnsafeWithdrawalExecution")
    ) {
      reasons.push({
        code: "policy_controlled_worker_not_ready",
        severity: "critical",
        summary:
          "Contract-controlled reserve wallets exist, but no managed worker is reporting policy-controlled withdrawal readiness."
      });
    }

    if (
      this.environment === WorkerRuntimeEnvironment.production &&
      this.config.loanFundingExecutionMode !== "governed_external" &&
      !this.hasOverride(activeApprovedOverrides, "allowDirectLoanFunding")
    ) {
      reasons.push({
        code: "loan_funding_not_governed",
        severity: "critical",
        summary:
          "Loan funding still depends on direct application key execution."
      });
    }

    if (
      this.environment === WorkerRuntimeEnvironment.production &&
      this.config.stakingWriteExecutionMode !== "governed_external" &&
      !this.hasOverride(activeApprovedOverrides, "allowDirectStakingWrites")
    ) {
      reasons.push({
        code: "staking_writes_not_governed",
        severity: "critical",
        summary:
          "Staking writes still depend on direct application key execution."
      });
    }

    if (
      latestPendingOverrideRequest &&
      reasons.every((reason) => reason.severity !== "critical")
    ) {
      reasons.push({
        code: "override_pending_approval",
        severity: "warning",
        summary: "A governed execution override is awaiting approval."
      });
    }

    const status = reasons.some((reason) => reason.severity === "critical")
      ? "critical"
      : reasons.length > 0
        ? "warning"
        : "healthy";

    return {
      generatedAt: now.toISOString(),
      environment: this.environment,
      policy: {
        governedExecutionRequiredInProduction:
          this.config.governedExecutionRequiredInProduction,
        governedReserveCustodyTypes: [...this.config.governedReserveCustodyTypes],
        loanFundingExecutionMode: this.config.loanFundingExecutionMode,
        stakingWriteExecutionMode: this.config.stakingWriteExecutionMode,
        overrideMaxHours: this.config.overrideMaxHours
      },
      posture: {
        status,
        reasons,
        totalReserveWalletCount: reserveWalletProjections.length,
        governedReserveWalletCount:
          reserveWalletProjections.length - unsafeReserveWalletCount,
        unsafeReserveWalletCount,
        contractControlledReserveWalletCount,
        multisigControlledReserveWalletCount,
        policyControlledReadyWorkerCount,
        managedWorkerCount: managedWorkers.length,
        activeApprovedOverrideCount: activeApprovedOverrides.length,
        pendingOverrideCount: overrideRecords.filter(
          (record) =>
            record.status ===
            GovernedExecutionOverrideRequestStatus.pending_approval
        ).length
      },
      reserveWallets: reserveWalletProjections,
      latestPendingOverrideRequest: latestPendingOverrideRequest
        ? this.mapOverrideProjection(latestPendingOverrideRequest)
        : null,
      activeApprovedOverrides: activeApprovedOverrides.map((record) =>
        this.mapOverrideProjection(record)
      ),
      recentOverrideRequests: overrideRecords.map((record) =>
        this.mapOverrideProjection(record)
      ),
      governance: this.buildGovernanceProjection(operator)
    };
  }

  async requestOverride(
    input: {
      allowUnsafeWithdrawalExecution?: boolean;
      allowDirectLoanFunding?: boolean;
      allowDirectStakingWrites?: boolean;
      reasonCode: string;
      requestNote?: string;
      expiresInHours: number;
    },
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: OverrideProjection;
    workspace: GovernedExecutionWorkspaceResult;
  }> {
    const normalizedOperatorRole = this.assertCanRequest(operator.operatorRole);

    if (
      !input.allowUnsafeWithdrawalExecution &&
      !input.allowDirectLoanFunding &&
      !input.allowDirectStakingWrites
    ) {
      throw new BadRequestException(
        "At least one governed execution override scope must be requested."
      );
    }

    if (input.expiresInHours > this.config.overrideMaxHours) {
      throw new BadRequestException(
        `Governed execution override requests must not exceed ${this.config.overrideMaxHours} hours.`
      );
    }

    const requestNote = this.normalizeOptionalString(input.requestNote);
    const reasonCode = this.normalizeOptionalString(input.reasonCode);

    if (!reasonCode) {
      throw new BadRequestException("reasonCode is required.");
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + input.expiresInHours * 3_600_000);

    const created = await this.prismaService.$transaction(async (transaction) => {
      const existingPending =
        await transaction.governedExecutionOverrideRequest.findFirst({
          where: {
            environment: this.environment,
            status: GovernedExecutionOverrideRequestStatus.pending_approval,
            expiresAt: {
              gt: now
            }
          }
        });

      if (existingPending) {
        throw new ConflictException(
          "A governed execution override request is already pending approval."
        );
      }

      const createdRequest =
        await transaction.governedExecutionOverrideRequest.create({
          data: {
            environment: this.environment,
            status: GovernedExecutionOverrideRequestStatus.pending_approval,
            allowUnsafeWithdrawalExecution:
              input.allowUnsafeWithdrawalExecution ?? false,
            allowDirectLoanFunding: input.allowDirectLoanFunding ?? false,
            allowDirectStakingWrites: input.allowDirectStakingWrites ?? false,
            reasonCode,
            requestNote: requestNote ?? undefined,
            requestedByOperatorId: operator.operatorId,
            requestedByOperatorRole: normalizedOperatorRole,
            expiresAt
          }
        });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.override.requested",
          targetType: "GovernedExecutionOverrideRequest",
          targetId: createdRequest.id,
          metadata: {
            environment: this.environment,
            requestedByOperatorRole: normalizedOperatorRole,
            allowUnsafeWithdrawalExecution:
              createdRequest.allowUnsafeWithdrawalExecution,
            allowDirectLoanFunding: createdRequest.allowDirectLoanFunding,
            allowDirectStakingWrites: createdRequest.allowDirectStakingWrites,
            reasonCode,
            requestNote,
            expiresAt: createdRequest.expiresAt.toISOString()
          } as PrismaJsonValue
        }
      });

      return createdRequest;
    });

    return {
      request: this.mapOverrideProjection(created),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      })
    };
  }

  async approveOverride(
    requestId: string,
    input: {
      approvalNote?: string;
    },
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: OverrideProjection;
    workspace: GovernedExecutionWorkspaceResult;
  }> {
    const normalizedOperatorRole = this.assertCanApprove(operator.operatorRole);
    const approvalNote = this.normalizeOptionalString(input.approvalNote);
    const now = new Date();

    const approved = await this.prismaService.$transaction(async (transaction) => {
      await this.expireStaleOverrides(now);
      const request = await transaction.governedExecutionOverrideRequest.findUnique({
        where: {
          id: requestId
        }
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed execution override request was not found in this environment."
        );
      }

      if (
        request.status !==
        GovernedExecutionOverrideRequestStatus.pending_approval
      ) {
        return request;
      }

      if (request.requestedByOperatorId === operator.operatorId) {
        throw new ForbiddenException(
          "The requesting operator cannot approve their own governed execution override."
        );
      }

      if (request.expiresAt.getTime() <= now.getTime()) {
        throw new ConflictException(
          "Governed execution override request has expired."
        );
      }

      const updated = await transaction.governedExecutionOverrideRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: GovernedExecutionOverrideRequestStatus.approved,
          approvedByOperatorId: operator.operatorId,
          approvedByOperatorRole: normalizedOperatorRole,
          approvalNote: approvalNote ?? undefined,
          approvedAt: now
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.override.approved",
          targetType: "GovernedExecutionOverrideRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            approvedByOperatorRole: normalizedOperatorRole,
            approvalNote
          } as PrismaJsonValue
        }
      });

      return updated;
    });

    return {
      request: this.mapOverrideProjection(approved),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      })
    };
  }

  async rejectOverride(
    requestId: string,
    input: {
      rejectionNote?: string;
    },
    operator: {
      operatorId: string;
      operatorRole?: string | null;
    }
  ): Promise<{
    request: OverrideProjection;
    workspace: GovernedExecutionWorkspaceResult;
  }> {
    const normalizedOperatorRole = this.assertCanApprove(operator.operatorRole);
    const rejectionNote = this.normalizeOptionalString(input.rejectionNote);
    const now = new Date();

    const rejected = await this.prismaService.$transaction(async (transaction) => {
      await this.expireStaleOverrides(now);
      const request = await transaction.governedExecutionOverrideRequest.findUnique({
        where: {
          id: requestId
        }
      });

      if (!request || request.environment !== this.environment) {
        throw new ConflictException(
          "Governed execution override request was not found in this environment."
        );
      }

      if (
        request.status !==
        GovernedExecutionOverrideRequestStatus.pending_approval
      ) {
        return request;
      }

      const updated = await transaction.governedExecutionOverrideRequest.update({
        where: {
          id: request.id
        },
        data: {
          status: GovernedExecutionOverrideRequestStatus.rejected,
          rejectedByOperatorId: operator.operatorId,
          rejectedByOperatorRole: normalizedOperatorRole,
          rejectionNote: rejectionNote ?? undefined,
          rejectedAt: now
        }
      });

      await transaction.auditEvent.create({
        data: {
          customerId: null,
          actorType: "operator",
          actorId: operator.operatorId,
          action: "governed_execution.override.rejected",
          targetType: "GovernedExecutionOverrideRequest",
          targetId: updated.id,
          metadata: {
            environment: this.environment,
            rejectedByOperatorRole: normalizedOperatorRole,
            rejectionNote
          } as PrismaJsonValue
        }
      });

      return updated;
    });

    return {
      request: this.mapOverrideProjection(rejected),
      workspace: await this.getWorkspace({
        operatorId: operator.operatorId,
        operatorRole: normalizedOperatorRole
      })
    };
  }

  async assertManagedWithdrawalExecutionAllowed(
    input: AssertManagedWithdrawalInput
  ): Promise<void> {
    if (
      !this.config.governedExecutionRequiredInProduction ||
      this.environment !== WorkerRuntimeEnvironment.production
    ) {
      return;
    }

    if (
      !input.sourceWalletKind ||
      !RESERVE_WALLET_KINDS.some((kind) => kind === input.sourceWalletKind)
    ) {
      return;
    }

    if (
      input.sourceWalletCustodyType &&
      this.governedReserveCustodyTypes.has(input.sourceWalletCustodyType)
    ) {
      return;
    }

    const activeOverrides = await this.getActiveApprovedOverrides(new Date());

    if (this.hasOverride(activeOverrides, "allowUnsafeWithdrawalExecution")) {
      return;
    }

    throw new ServiceUnavailableException(
      `Managed withdrawal execution is blocked because wallet ${input.sourceWalletAddress ?? "unknown"} is not governed reserve custody.`
    );
  }

  async assertLoanFundingExecutionAllowed(): Promise<void> {
    if (
      !this.config.governedExecutionRequiredInProduction ||
      this.environment !== WorkerRuntimeEnvironment.production
    ) {
      return;
    }

    if (this.config.loanFundingExecutionMode === "governed_external") {
      return;
    }

    const activeOverrides = await this.getActiveApprovedOverrides(new Date());

    if (this.hasOverride(activeOverrides, "allowDirectLoanFunding")) {
      return;
    }

    throw new ServiceUnavailableException(
      "Loan funding is blocked because governed treasury execution is required in production."
    );
  }

  async assertStakingWriteExecutionAllowed(): Promise<void> {
    if (
      !this.config.governedExecutionRequiredInProduction ||
      this.environment !== WorkerRuntimeEnvironment.production
    ) {
      return;
    }

    if (this.config.stakingWriteExecutionMode === "governed_external") {
      return;
    }

    const activeOverrides = await this.getActiveApprovedOverrides(new Date());

    if (this.hasOverride(activeOverrides, "allowDirectStakingWrites")) {
      return;
    }

    throw new ServiceUnavailableException(
      "Staking writes are blocked because governed treasury execution is required in production."
    );
  }
}
