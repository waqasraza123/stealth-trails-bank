import { Injectable, NotFoundException } from "@nestjs/common";
import {
  Prisma,
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceStatus,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReleaseReadinessEvidenceDto } from "./dto/create-release-readiness-evidence.dto";
import { ListReleaseReadinessEvidenceDto } from "./dto/list-release-readiness-evidence.dto";

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

type ReleaseReadinessEvidenceRecord =
  Prisma.ReleaseReadinessEvidenceGetPayload<{}>;

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

@Injectable()
export class ReleaseReadinessService {
  constructor(private readonly prismaService: PrismaService) {}

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
}
