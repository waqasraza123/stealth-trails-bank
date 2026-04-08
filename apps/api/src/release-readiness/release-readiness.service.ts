import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { loadReleaseReadinessApprovalRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  Prisma,
  ReleaseReadinessApprovalStatus,
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceStatus,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReleaseReadinessApprovalDto } from "./dto/create-release-readiness-approval.dto";
import { CreateReleaseReadinessEvidenceDto } from "./dto/create-release-readiness-evidence.dto";
import { ListReleaseReadinessApprovalsDto } from "./dto/list-release-readiness-approvals.dto";
import { ListReleaseReadinessEvidenceDto } from "./dto/list-release-readiness-evidence.dto";
import {
  ApproveReleaseReadinessApprovalDto,
  RejectReleaseReadinessApprovalDto
} from "./dto/release-readiness-approval.dto";

const requiredReleaseReadinessChecks: Array<{
  evidenceType: ReleaseReadinessEvidenceType;
  label: string;
  description: string;
  runbookPath: string;
  acceptedEnvironments: ReleaseReadinessEnvironment[];
}> = [
  {
    evidenceType: ReleaseReadinessEvidenceType.platform_alert_delivery_slo,
    label: "Delivery Target SLO Alerting",
    description:
      "Prove sustained delivery-target degradation opens durable operations alerts from staging or production-like traffic.",
    runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.critical_alert_reescalation,
    label: "Critical Alert Re-escalation Cadence",
    description:
      "Prove overdue critical alerts are re-escalated on the expected timer and leave durable evidence.",
    runbookPath: "docs/runbooks/platform-alert-delivery-targets.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.database_restore_drill,
    label: "Database Restore Drill",
    description:
      "Prove the latest production-like backup restores cleanly and the API reads core domains without schema drift.",
    runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.api_rollback_drill,
    label: "API Rollback Drill",
    description:
      "Prove the prior known-good API artifact can be restored against the current schema without runtime migration surprises.",
    runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  },
  {
    evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill,
    label: "Worker Rollback Drill",
    description:
      "Prove the prior worker artifact resumes heartbeat and queue processing safely without duplicate execution.",
    runbookPath: "docs/runbooks/restore-and-rollback-drills.md",
    acceptedEnvironments: [
      ReleaseReadinessEnvironment.staging,
      ReleaseReadinessEnvironment.production_like,
      ReleaseReadinessEnvironment.production
    ]
  }
];

const releaseReadinessChecklistSections = [
  {
    key: "securityConfigurationComplete",
    label: "Security configuration"
  },
  {
    key: "accessAndGovernanceComplete",
    label: "Access and governance"
  },
  {
    key: "dataAndRecoveryComplete",
    label: "Data and recovery"
  },
  {
    key: "platformHealthComplete",
    label: "Platform health"
  },
  {
    key: "functionalProofComplete",
    label: "Functional proof"
  },
  {
    key: "contractAndChainProofComplete",
    label: "Contract and chain proof"
  },
  {
    key: "finalSignoffComplete",
    label: "Final sign-off"
  },
  {
    key: "unresolvedRisksAccepted",
    label: "Residual risks accepted"
  }
] as const;

type ReleaseReadinessEvidenceRecord =
  Prisma.ReleaseReadinessEvidenceGetPayload<{}>;
type ReleaseReadinessApprovalRecord =
  Prisma.ReleaseReadinessApprovalGetPayload<{}>;

type ReleaseReadinessEvidenceProjection = {
  id: string;
  evidenceType: ReleaseReadinessEvidenceType;
  environment: ReleaseReadinessEnvironment;
  status: ReleaseReadinessEvidenceStatus;
  releaseIdentifier: string | null;
  rollbackReleaseIdentifier: string | null;
  backupReference: string | null;
  summary: string;
  note: string | null;
  operatorId: string;
  operatorRole: string | null;
  runbookPath: string | null;
  evidenceLinks: string[];
  evidencePayload: Prisma.JsonValue | null;
  startedAt: string | null;
  completedAt: string | null;
  observedAt: string;
  createdAt: string;
  updatedAt: string;
};

type ReleaseReadinessEvidenceMutationResult = {
  evidence: ReleaseReadinessEvidenceProjection;
};

type ReleaseReadinessEvidenceList = {
  evidence: ReleaseReadinessEvidenceProjection[];
  limit: number;
  totalCount: number;
};

type ReleaseReadinessSummary = {
  generatedAt: string;
  overallStatus: "healthy" | "warning" | "critical";
  summary: {
    requiredCheckCount: number;
    passedCheckCount: number;
    failedCheckCount: number;
    pendingCheckCount: number;
  };
  requiredChecks: Array<{
    evidenceType: ReleaseReadinessEvidenceType;
    label: string;
    description: string;
    runbookPath: string;
    acceptedEnvironments: ReleaseReadinessEnvironment[];
    status: "passed" | "failed" | "pending";
    latestEvidence: ReleaseReadinessEvidenceProjection | null;
  }>;
  recentEvidence: ReleaseReadinessEvidenceProjection[];
};

type ReleaseReadinessApprovalChecklist = {
  securityConfigurationComplete: boolean;
  accessAndGovernanceComplete: boolean;
  dataAndRecoveryComplete: boolean;
  platformHealthComplete: boolean;
  functionalProofComplete: boolean;
  contractAndChainProofComplete: boolean;
  finalSignoffComplete: boolean;
  unresolvedRisksAccepted: boolean;
  openBlockers: string[];
  residualRiskNote: string | null;
};

type ReleaseReadinessApprovalEvidenceSnapshot = {
  generatedAt: string;
  overallStatus: ReleaseReadinessSummary["overallStatus"];
  summary: ReleaseReadinessSummary["summary"];
  requiredChecks: Array<{
    evidenceType: ReleaseReadinessEvidenceType;
    status: "passed" | "failed" | "pending";
    latestEvidenceObservedAt: string | null;
    latestEvidenceEnvironment: ReleaseReadinessEnvironment | null;
    latestEvidenceStatus: ReleaseReadinessEvidenceStatus | null;
  }>;
};

type ReleaseReadinessApprovalGate = {
  overallStatus: "ready" | "blocked" | "approved" | "rejected";
  approvalEligible: boolean;
  missingChecklistItems: string[];
  missingEvidenceTypes: ReleaseReadinessEvidenceType[];
  failedEvidenceTypes: ReleaseReadinessEvidenceType[];
  openBlockers: string[];
  generatedAt: string;
};

type ReleaseReadinessApprovalProjection = {
  id: string;
  releaseIdentifier: string;
  environment: ReleaseReadinessEnvironment;
  rollbackReleaseIdentifier: string | null;
  status: ReleaseReadinessApprovalStatus;
  summary: string;
  requestNote: string | null;
  approvalNote: string | null;
  rejectionNote: string | null;
  requestedByOperatorId: string;
  requestedByOperatorRole: string | null;
  approvedByOperatorId: string | null;
  approvedByOperatorRole: string | null;
  rejectedByOperatorId: string | null;
  rejectedByOperatorRole: string | null;
  checklist: ReleaseReadinessApprovalChecklist;
  evidenceSnapshot: ReleaseReadinessApprovalEvidenceSnapshot;
  gate: ReleaseReadinessApprovalGate;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReleaseReadinessApprovalMutationResult = {
  approval: ReleaseReadinessApprovalProjection;
};

type ReleaseReadinessApprovalList = {
  approvals: ReleaseReadinessApprovalProjection[];
  limit: number;
  totalCount: number;
};

@Injectable()
export class ReleaseReadinessService {
  private readonly approvalAllowedOperatorRoles: string[];

  constructor(private readonly prismaService: PrismaService) {
    const config = loadReleaseReadinessApprovalRuntimeConfig();
    this.approvalAllowedOperatorRoles = [
      ...config.releaseReadinessApprovalAllowedOperatorRoles
    ];
  }

  private normalizeOptionalString(value?: string | null): string | null {
    const normalizedValue = value?.trim() ?? null;
    return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
  }

  private normalizeOptionalDate(value?: string): Date | null {
    const normalizedValue = this.normalizeOptionalString(value);
    return normalizedValue ? new Date(normalizedValue) : null;
  }

  private normalizeEvidenceLinks(evidenceLinks?: string[]): string[] {
    if (!evidenceLinks) {
      return [];
    }

    return [...new Set(evidenceLinks.map((link) => link.trim()).filter(Boolean))];
  }

  private normalizeStringArray(values?: string[]): string[] {
    if (!values) {
      return [];
    }

    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private normalizeOperatorRole(operatorRole?: string): string | null {
    const normalizedOperatorRole = operatorRole?.trim().toLowerCase() ?? null;
    return normalizedOperatorRole && normalizedOperatorRole.length > 0
      ? normalizedOperatorRole
      : null;
  }

  private assertCanApprove(operatorRole?: string): string {
    const normalizedOperatorRole = this.normalizeOperatorRole(operatorRole);

    if (
      !normalizedOperatorRole ||
      !this.approvalAllowedOperatorRoles.includes(normalizedOperatorRole)
    ) {
      throw new ForbiddenException(
        "Operator role is not authorized to approve or reject launch readiness."
      );
    }

    return normalizedOperatorRole;
  }

  private mapEvidenceProjection(
    record: ReleaseReadinessEvidenceRecord
  ): ReleaseReadinessEvidenceProjection {
    return {
      id: record.id,
      evidenceType: record.evidenceType,
      environment: record.environment,
      status: record.status,
      releaseIdentifier: record.releaseIdentifier ?? null,
      rollbackReleaseIdentifier: record.rollbackReleaseIdentifier ?? null,
      backupReference: record.backupReference ?? null,
      summary: record.summary,
      note: record.note ?? null,
      operatorId: record.operatorId,
      operatorRole: record.operatorRole ?? null,
      runbookPath: record.runbookPath ?? null,
      evidenceLinks: [...record.evidenceLinks],
      evidencePayload: record.evidencePayload ?? null,
      startedAt: record.startedAt?.toISOString() ?? null,
      completedAt: record.completedAt?.toISOString() ?? null,
      observedAt: record.observedAt.toISOString(),
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private buildEvidenceWhere(
    query: ListReleaseReadinessEvidenceDto
  ): Prisma.ReleaseReadinessEvidenceWhereInput {
    const where: Prisma.ReleaseReadinessEvidenceWhereInput = {};

    if (query.evidenceType) {
      where.evidenceType = query.evidenceType;
    }

    if (query.environment) {
      where.environment = query.environment;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.sinceDays) {
      where.observedAt = {
        gte: new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000)
      };
    }

    return where;
  }

  private buildApprovalWhere(
    query: ListReleaseReadinessApprovalsDto
  ): Prisma.ReleaseReadinessApprovalWhereInput {
    const where: Prisma.ReleaseReadinessApprovalWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.environment) {
      where.environment = query.environment;
    }

    if (query.releaseIdentifier) {
      where.releaseIdentifier = {
        contains: query.releaseIdentifier.trim(),
        mode: Prisma.QueryMode.insensitive
      };
    }

    if (query.sinceDays) {
      where.requestedAt = {
        gte: new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000)
      };
    }

    return where;
  }

  private buildApprovalChecklist(
    dto: CreateReleaseReadinessApprovalDto
  ): ReleaseReadinessApprovalChecklist {
    return {
      securityConfigurationComplete: dto.securityConfigurationComplete,
      accessAndGovernanceComplete: dto.accessAndGovernanceComplete,
      dataAndRecoveryComplete: dto.dataAndRecoveryComplete,
      platformHealthComplete: dto.platformHealthComplete,
      functionalProofComplete: dto.functionalProofComplete,
      contractAndChainProofComplete: dto.contractAndChainProofComplete,
      finalSignoffComplete: dto.finalSignoffComplete,
      unresolvedRisksAccepted: dto.unresolvedRisksAccepted,
      openBlockers: this.normalizeStringArray(dto.openBlockers),
      residualRiskNote: this.normalizeOptionalString(dto.residualRiskNote)
    };
  }

  private mapApprovalChecklist(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalChecklist {
    return {
      securityConfigurationComplete: record.securityConfigurationComplete,
      accessAndGovernanceComplete: record.accessAndGovernanceComplete,
      dataAndRecoveryComplete: record.dataAndRecoveryComplete,
      platformHealthComplete: record.platformHealthComplete,
      functionalProofComplete: record.functionalProofComplete,
      contractAndChainProofComplete: record.contractAndChainProofComplete,
      finalSignoffComplete: record.finalSignoffComplete,
      unresolvedRisksAccepted: record.unresolvedRisksAccepted,
      openBlockers: [...record.openBlockers],
      residualRiskNote: record.residualRiskNote ?? null
    };
  }

  private buildApprovalEvidenceSnapshot(
    summary: ReleaseReadinessSummary
  ): ReleaseReadinessApprovalEvidenceSnapshot {
    return {
      generatedAt: summary.generatedAt,
      overallStatus: summary.overallStatus,
      summary: {
        ...summary.summary
      },
      requiredChecks: summary.requiredChecks.map((check) => ({
        evidenceType: check.evidenceType,
        status: check.status,
        latestEvidenceObservedAt: check.latestEvidence?.observedAt ?? null,
        latestEvidenceEnvironment: check.latestEvidence?.environment ?? null,
        latestEvidenceStatus: check.latestEvidence?.status ?? null
      }))
    };
  }

  private evaluateApprovalGate(
    summary: ReleaseReadinessSummary,
    checklist: ReleaseReadinessApprovalChecklist,
    status: ReleaseReadinessApprovalStatus
  ): ReleaseReadinessApprovalGate {
    const missingChecklistItems = releaseReadinessChecklistSections
      .filter((section) => !checklist[section.key])
      .map((section) => section.label);
    const missingEvidenceTypes = summary.requiredChecks
      .filter((check) => check.status === "pending")
      .map((check) => check.evidenceType);
    const failedEvidenceTypes = summary.requiredChecks
      .filter((check) => check.status === "failed")
      .map((check) => check.evidenceType);
    const openBlockers = [...checklist.openBlockers];
    const approvalEligible =
      missingChecklistItems.length === 0 &&
      missingEvidenceTypes.length === 0 &&
      failedEvidenceTypes.length === 0 &&
      openBlockers.length === 0;

    const overallStatus =
      status === ReleaseReadinessApprovalStatus.approved
        ? "approved"
        : status === ReleaseReadinessApprovalStatus.rejected
          ? "rejected"
          : approvalEligible
            ? "ready"
            : "blocked";

    return {
      overallStatus,
      approvalEligible: status === ReleaseReadinessApprovalStatus.approved
        ? true
        : status === ReleaseReadinessApprovalStatus.rejected
          ? false
          : approvalEligible,
      missingChecklistItems,
      missingEvidenceTypes,
      failedEvidenceTypes,
      openBlockers,
      generatedAt: summary.generatedAt
    };
  }

  private mapStoredApprovalEvidenceSnapshot(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalEvidenceSnapshot {
    return record.evidenceSnapshot as unknown as ReleaseReadinessApprovalEvidenceSnapshot;
  }

  private mapStoredApprovalGate(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalGate {
    return record.blockerSnapshot as unknown as ReleaseReadinessApprovalGate;
  }

  private mapApprovalProjection(
    record: ReleaseReadinessApprovalRecord,
    currentSummary?: ReleaseReadinessSummary
  ): ReleaseReadinessApprovalProjection {
    const checklist = this.mapApprovalChecklist(record);
    const evidenceSnapshot =
      record.status === ReleaseReadinessApprovalStatus.pending_approval &&
      currentSummary
        ? this.buildApprovalEvidenceSnapshot(currentSummary)
        : this.mapStoredApprovalEvidenceSnapshot(record);
    const gate =
      record.status === ReleaseReadinessApprovalStatus.pending_approval &&
      currentSummary
        ? this.evaluateApprovalGate(currentSummary, checklist, record.status)
        : this.mapStoredApprovalGate(record);

    return {
      id: record.id,
      releaseIdentifier: record.releaseIdentifier,
      environment: record.environment,
      rollbackReleaseIdentifier: record.rollbackReleaseIdentifier ?? null,
      status: record.status,
      summary: record.summary,
      requestNote: record.requestNote ?? null,
      approvalNote: record.approvalNote ?? null,
      rejectionNote: record.rejectionNote ?? null,
      requestedByOperatorId: record.requestedByOperatorId,
      requestedByOperatorRole: record.requestedByOperatorRole ?? null,
      approvedByOperatorId: record.approvedByOperatorId ?? null,
      approvedByOperatorRole: record.approvedByOperatorRole ?? null,
      rejectedByOperatorId: record.rejectedByOperatorId ?? null,
      rejectedByOperatorRole: record.rejectedByOperatorRole ?? null,
      checklist,
      evidenceSnapshot,
      gate,
      requestedAt: record.requestedAt.toISOString(),
      approvedAt: record.approvedAt?.toISOString() ?? null,
      rejectedAt: record.rejectedAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  async recordEvidence(
    dto: CreateReleaseReadinessEvidenceDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessEvidenceMutationResult> {
    const normalizedOperatorRole = this.normalizeOptionalString(operatorRole);
    const runbookPath =
      this.normalizeOptionalString(dto.runbookPath) ??
      requiredReleaseReadinessChecks.find(
        (check) => check.evidenceType === dto.evidenceType
      )?.runbookPath ??
      null;
    const summary = dto.summary.trim();
    const note = this.normalizeOptionalString(dto.note);
    const releaseIdentifier = this.normalizeOptionalString(dto.releaseIdentifier);
    const rollbackReleaseIdentifier = this.normalizeOptionalString(
      dto.rollbackReleaseIdentifier
    );
    const backupReference = this.normalizeOptionalString(dto.backupReference);
    const startedAt = this.normalizeOptionalDate(dto.startedAt);
    const completedAt = this.normalizeOptionalDate(dto.completedAt);
    const observedAt = this.normalizeOptionalDate(dto.observedAt) ?? new Date();
    const evidenceLinks = this.normalizeEvidenceLinks(dto.evidenceLinks);
    const evidencePayload =
      (dto.evidencePayload as Prisma.InputJsonValue | undefined) ?? undefined;

    const evidence = await this.prismaService.$transaction(async (transaction) => {
      const createdEvidence = await transaction.releaseReadinessEvidence.create({
        data: {
          evidenceType: dto.evidenceType,
          environment: dto.environment,
          status: dto.status,
          releaseIdentifier: releaseIdentifier ?? undefined,
          rollbackReleaseIdentifier: rollbackReleaseIdentifier ?? undefined,
          backupReference: backupReference ?? undefined,
          summary,
          note: note ?? undefined,
          operatorId,
          operatorRole: normalizedOperatorRole ?? undefined,
          runbookPath: runbookPath ?? undefined,
          evidenceLinks,
          evidencePayload,
          startedAt: startedAt ?? undefined,
          completedAt: completedAt ?? undefined,
          observedAt
        }
      });

      await transaction.auditEvent.create({
        data: {
          actorType: "operator",
          actorId: operatorId,
          action: "release_readiness.evidence_recorded",
          targetType: "ReleaseReadinessEvidence",
          targetId: createdEvidence.id,
          metadata: {
            evidenceType: createdEvidence.evidenceType,
            environment: createdEvidence.environment,
            status: createdEvidence.status,
            releaseIdentifier,
            rollbackReleaseIdentifier,
            backupReference,
            runbookPath,
            summary,
            evidenceLinks,
            observedAt: createdEvidence.observedAt.toISOString(),
            completedAt: createdEvidence.completedAt?.toISOString() ?? null,
            operatorRole: normalizedOperatorRole
          } as Prisma.InputJsonValue
        }
      });

      return createdEvidence;
    });

    return {
      evidence: this.mapEvidenceProjection(evidence)
    };
  }

  async getEvidence(
    evidenceId: string
  ): Promise<ReleaseReadinessEvidenceMutationResult> {
    const evidence = await this.prismaService.releaseReadinessEvidence.findUnique({
      where: {
        id: evidenceId
      }
    });

    if (!evidence) {
      throw new NotFoundException("Release readiness evidence was not found.");
    }

    return {
      evidence: this.mapEvidenceProjection(evidence)
    };
  }

  async listEvidence(
    query: ListReleaseReadinessEvidenceDto
  ): Promise<ReleaseReadinessEvidenceList> {
    const limit = query.limit ?? 12;
    const where = this.buildEvidenceWhere(query);

    const [evidence, totalCount] = await Promise.all([
      this.prismaService.releaseReadinessEvidence.findMany({
        where,
        orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
        take: limit
      }),
      this.prismaService.releaseReadinessEvidence.count({
        where
      })
    ]);

    return {
      evidence: evidence.map((record) => this.mapEvidenceProjection(record)),
      limit,
      totalCount
    };
  }

  async getSummary(): Promise<ReleaseReadinessSummary> {
    const candidateEvidence = await this.prismaService.releaseReadinessEvidence.findMany({
      where: {
        evidenceType: {
          in: requiredReleaseReadinessChecks.map((check) => check.evidenceType)
        },
        environment: {
          in: [
            ReleaseReadinessEnvironment.staging,
            ReleaseReadinessEnvironment.production_like,
            ReleaseReadinessEnvironment.production
          ]
        }
      },
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }]
    });
    const recentEvidence = await this.prismaService.releaseReadinessEvidence.findMany({
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
      take: 10
    });

    const latestEvidenceByType = new Map<
      ReleaseReadinessEvidenceType,
      ReleaseReadinessEvidenceRecord
    >();

    for (const evidence of candidateEvidence) {
      if (!latestEvidenceByType.has(evidence.evidenceType)) {
        latestEvidenceByType.set(evidence.evidenceType, evidence);
      }
    }

    const requiredChecks = requiredReleaseReadinessChecks.map((check) => {
      const latestEvidence = latestEvidenceByType.get(check.evidenceType) ?? null;
      const status: "passed" | "failed" | "pending" =
        latestEvidence?.status === ReleaseReadinessEvidenceStatus.passed
          ? "passed"
          : latestEvidence?.status === ReleaseReadinessEvidenceStatus.failed
            ? "failed"
            : "pending";

      return {
        evidenceType: check.evidenceType,
        label: check.label,
        description: check.description,
        runbookPath: check.runbookPath,
        acceptedEnvironments: [...check.acceptedEnvironments],
        status,
        latestEvidence: latestEvidence
          ? this.mapEvidenceProjection(latestEvidence)
          : null
      };
    });

    const passedCheckCount = requiredChecks.filter(
      (check) => check.status === "passed"
    ).length;
    const failedCheckCount = requiredChecks.filter(
      (check) => check.status === "failed"
    ).length;
    const pendingCheckCount = requiredChecks.filter(
      (check) => check.status === "pending"
    ).length;

    return {
      generatedAt: new Date().toISOString(),
      overallStatus:
        failedCheckCount > 0
          ? "critical"
          : pendingCheckCount > 0
            ? "warning"
            : "healthy",
      summary: {
        requiredCheckCount: requiredChecks.length,
        passedCheckCount,
        failedCheckCount,
        pendingCheckCount
      },
      requiredChecks,
      recentEvidence: recentEvidence.map((record) =>
        this.mapEvidenceProjection(record)
      )
    };
  }

  async requestApproval(
    dto: CreateReleaseReadinessApprovalDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const releaseIdentifier = dto.releaseIdentifier.trim();
    const summaryText = dto.summary.trim();
    const requestNote = this.normalizeOptionalString(dto.requestNote);
    const rollbackReleaseIdentifier = this.normalizeOptionalString(
      dto.rollbackReleaseIdentifier
    );
    const normalizedOperatorRole = this.normalizeOptionalString(operatorRole);
    const checklist = this.buildApprovalChecklist(dto);

    const [existingPendingApproval, readinessSummary] = await Promise.all([
      this.prismaService.releaseReadinessApproval.findFirst({
        where: {
          releaseIdentifier,
          environment: dto.environment,
          status: ReleaseReadinessApprovalStatus.pending_approval
        },
        orderBy: [{ requestedAt: "desc" }]
      }),
      this.getSummary()
    ]);

    if (existingPendingApproval) {
      throw new ConflictException(
        "A pending launch approval already exists for this release identifier and environment."
      );
    }

    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const gate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.pending_approval
    );

    const approval = await this.prismaService.$transaction(async (transaction) => {
      const createdApproval = await transaction.releaseReadinessApproval.create({
        data: {
          releaseIdentifier,
          environment: dto.environment,
          rollbackReleaseIdentifier: rollbackReleaseIdentifier ?? undefined,
          summary: summaryText,
          requestNote: requestNote ?? undefined,
          requestedByOperatorId: operatorId,
          requestedByOperatorRole: normalizedOperatorRole ?? undefined,
          securityConfigurationComplete: checklist.securityConfigurationComplete,
          accessAndGovernanceComplete: checklist.accessAndGovernanceComplete,
          dataAndRecoveryComplete: checklist.dataAndRecoveryComplete,
          platformHealthComplete: checklist.platformHealthComplete,
          functionalProofComplete: checklist.functionalProofComplete,
          contractAndChainProofComplete:
            checklist.contractAndChainProofComplete,
          finalSignoffComplete: checklist.finalSignoffComplete,
          unresolvedRisksAccepted: checklist.unresolvedRisksAccepted,
          openBlockers: checklist.openBlockers,
          residualRiskNote: checklist.residualRiskNote ?? undefined,
          evidenceSnapshot: evidenceSnapshot as unknown as Prisma.InputJsonValue,
          blockerSnapshot: gate as unknown as Prisma.InputJsonValue
        }
      });

      await transaction.auditEvent.create({
        data: {
          actorType: "operator",
          actorId: operatorId,
          action: "release_readiness.approval_requested",
          targetType: "ReleaseReadinessApproval",
          targetId: createdApproval.id,
          metadata: {
            releaseIdentifier,
            environment: dto.environment,
            rollbackReleaseIdentifier,
            summary: summaryText,
            operatorRole: normalizedOperatorRole,
            gate
          } as Prisma.InputJsonValue
        }
      });

      return createdApproval;
    });

    return {
      approval: this.mapApprovalProjection(approval, readinessSummary)
    };
  }

  async approveApproval(
    approvalId: string,
    dto: ApproveReleaseReadinessApprovalDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const approvedOperatorRole = this.assertCanApprove(operatorRole);
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    if (approval.status !== ReleaseReadinessApprovalStatus.pending_approval) {
      throw new ConflictException(
        "Only pending launch approvals can be approved."
      );
    }

    const readinessSummary = await this.getSummary();
    const checklist = this.mapApprovalChecklist(approval);
    const gate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.pending_approval
    );

    if (!gate.approvalEligible) {
      throw new ConflictException(
        "Launch approval is blocked until checklist gaps, failed evidence, and open blockers are remediated."
      );
    }

    const approvalNote = this.normalizeOptionalString(dto.approvalNote);
    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const approvedGate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.approved
    );

    const updatedApproval = await this.prismaService.$transaction(
      async (transaction) => {
        const nextApproval = await transaction.releaseReadinessApproval.update({
          where: {
            id: approval.id
          },
          data: {
            status: ReleaseReadinessApprovalStatus.approved,
            approvedByOperatorId: operatorId,
            approvedByOperatorRole: approvedOperatorRole,
            approvalNote: approvalNote ?? undefined,
            approvedAt: new Date(),
            evidenceSnapshot: evidenceSnapshot as unknown as Prisma.InputJsonValue,
            blockerSnapshot: approvedGate as unknown as Prisma.InputJsonValue
          }
        });

        await transaction.auditEvent.create({
          data: {
            actorType: "operator",
            actorId: operatorId,
            action: "release_readiness.approval_approved",
            targetType: "ReleaseReadinessApproval",
            targetId: nextApproval.id,
            metadata: {
              releaseIdentifier: nextApproval.releaseIdentifier,
              environment: nextApproval.environment,
              approvedByOperatorRole: approvedOperatorRole,
              approvalNote,
              gate: approvedGate
            } as Prisma.InputJsonValue
          }
        });

        return nextApproval;
      }
    );

    return {
      approval: this.mapApprovalProjection(updatedApproval)
    };
  }

  async rejectApproval(
    approvalId: string,
    dto: RejectReleaseReadinessApprovalDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const rejectedOperatorRole = this.assertCanApprove(operatorRole);
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    if (approval.status !== ReleaseReadinessApprovalStatus.pending_approval) {
      throw new ConflictException(
        "Only pending launch approvals can be rejected."
      );
    }

    const readinessSummary = await this.getSummary();
    const checklist = this.mapApprovalChecklist(approval);
    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const rejectedGate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.rejected
    );
    const rejectionNote = dto.rejectionNote.trim();

    const updatedApproval = await this.prismaService.$transaction(
      async (transaction) => {
        const nextApproval = await transaction.releaseReadinessApproval.update({
          where: {
            id: approval.id
          },
          data: {
            status: ReleaseReadinessApprovalStatus.rejected,
            rejectedByOperatorId: operatorId,
            rejectedByOperatorRole: rejectedOperatorRole,
            rejectionNote,
            rejectedAt: new Date(),
            evidenceSnapshot: evidenceSnapshot as unknown as Prisma.InputJsonValue,
            blockerSnapshot: rejectedGate as unknown as Prisma.InputJsonValue
          }
        });

        await transaction.auditEvent.create({
          data: {
            actorType: "operator",
            actorId: operatorId,
            action: "release_readiness.approval_rejected",
            targetType: "ReleaseReadinessApproval",
            targetId: nextApproval.id,
            metadata: {
              releaseIdentifier: nextApproval.releaseIdentifier,
              environment: nextApproval.environment,
              rejectedByOperatorRole: rejectedOperatorRole,
              rejectionNote,
              gate: rejectedGate
            } as Prisma.InputJsonValue
          }
        });

        return nextApproval;
      }
    );

    return {
      approval: this.mapApprovalProjection(updatedApproval)
    };
  }

  async getApproval(
    approvalId: string
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const approval = await this.prismaService.releaseReadinessApproval.findUnique({
      where: {
        id: approvalId
      }
    });

    if (!approval) {
      throw new NotFoundException("Release readiness approval request was not found.");
    }

    const currentSummary =
      approval.status === ReleaseReadinessApprovalStatus.pending_approval
        ? await this.getSummary()
        : undefined;

    return {
      approval: this.mapApprovalProjection(approval, currentSummary)
    };
  }

  async listApprovals(
    query: ListReleaseReadinessApprovalsDto
  ): Promise<ReleaseReadinessApprovalList> {
    const limit = query.limit ?? 10;
    const where = this.buildApprovalWhere(query);

    const [approvals, totalCount, currentSummary] = await Promise.all([
      this.prismaService.releaseReadinessApproval.findMany({
        where,
        orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
        take: limit
      }),
      this.prismaService.releaseReadinessApproval.count({
        where
      }),
      this.getSummary()
    ]);

    return {
      approvals: approvals.map((record) =>
        this.mapApprovalProjection(record, currentSummary)
      ),
      limit,
      totalCount
    };
  }
}
