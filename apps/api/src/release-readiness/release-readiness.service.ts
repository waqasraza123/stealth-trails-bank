import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { loadReleaseReadinessApprovalRuntimeConfig } from "@stealth-trails-bank/config/api";
import {
  Prisma,
  ReleaseReadinessApprovalStatus,
  ReleaseReadinessEnvironment,
  ReleaseReadinessEvidenceStatus,
  ReleaseReadinessEvidenceType
} from "@prisma/client";
import {
  assertOperatorRoleAuthorized,
  normalizeOperatorRole
} from "../auth/internal-operator-role-policy";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReleaseReadinessApprovalDto } from "./dto/create-release-readiness-approval.dto";
import { CreateReleaseReadinessEvidenceDto } from "./dto/create-release-readiness-evidence.dto";
import { ListReleaseLaunchClosurePacksDto } from "./dto/list-release-launch-closure-packs.dto";
import { ListReleaseReadinessApprovalsDto } from "./dto/list-release-readiness-approvals.dto";
import { ListReleaseReadinessEvidenceDto } from "./dto/list-release-readiness-evidence.dto";
import {
  releaseReadinessChecklistSections,
  requiredReleaseReadinessChecks
} from "./release-readiness-checks";
import {
  describeReleaseReadinessEvidenceMetadataRequirements,
  validateReleaseReadinessEvidenceMetadata
} from "./release-readiness-evidence-requirements";
import {
  ApproveReleaseReadinessApprovalDto,
  RejectReleaseReadinessApprovalDto
} from "./dto/release-readiness-approval.dto";
import {
  previewLaunchClosurePack,
  renderLaunchClosureStatusSummary,
  renderLaunchClosureValidationSummary,
  validateLaunchClosureManifest,
  type LaunchClosureManifest
} from "./launch-closure-pack";

type ReleaseReadinessEvidenceRecord =
  Prisma.ReleaseReadinessEvidenceGetPayload<{}>;
type ReleaseReadinessApprovalRecord =
  Prisma.ReleaseReadinessApprovalGetPayload<{}>;
type ReleaseLaunchClosurePackRecord =
  Prisma.ReleaseLaunchClosurePackGetPayload<{}>;

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
  releaseIdentifier: string | null;
  environment: ReleaseReadinessEnvironment | null;
  approvalPolicy: {
    requestAllowedOperatorRoles: string[];
    approverAllowedOperatorRoles: string[];
    maximumEvidenceAgeHours: number;
    currentOperator: {
      operatorId: string | null;
      operatorRole: string | null;
      canRequestApproval: boolean;
      canApproveOrReject: boolean;
    };
  };
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

type ReleaseReadinessSummaryScope = {
  releaseIdentifier?: string | null;
  environment?: ReleaseReadinessEnvironment | null;
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
    latestEvidenceReleaseIdentifier: string | null;
    latestEvidenceRollbackReleaseIdentifier: string | null;
    latestEvidenceBackupReference: string | null;
  }>;
};

type ReleaseReadinessApprovalMetadataMismatch = {
  evidenceType: ReleaseReadinessEvidenceType;
  reason: string;
};

type ReleaseReadinessApprovalGate = {
  overallStatus: "ready" | "blocked" | "approved" | "rejected";
  approvalEligible: boolean;
  missingChecklistItems: string[];
  missingEvidenceTypes: ReleaseReadinessEvidenceType[];
  failedEvidenceTypes: ReleaseReadinessEvidenceType[];
  staleEvidenceTypes: ReleaseReadinessEvidenceType[];
  metadataMismatches: ReleaseReadinessApprovalMetadataMismatch[];
  maximumEvidenceAgeHours: number;
  openBlockers: string[];
  generatedAt: string;
};

type ReleaseReadinessApprovalProjection = {
  id: string;
  supersedesApprovalId: string | null;
  supersededByApprovalId: string | null;
  releaseIdentifier: string;
  environment: ReleaseReadinessEnvironment;
  launchClosurePack: {
    id: string;
    version: number;
    artifactChecksumSha256: string;
  } | null;
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
  supersededByOperatorId: string | null;
  supersededByOperatorRole: string | null;
  checklist: ReleaseReadinessApprovalChecklist;
  evidenceSnapshot: ReleaseReadinessApprovalEvidenceSnapshot;
  gate: ReleaseReadinessApprovalGate;
  launchClosureDrift: {
    changed: boolean;
    critical: boolean;
    blockingReasons: string[];
    currentOverallStatus: LaunchClosureStatusProjection["overallStatus"];
    summaryDelta: {
      passedCheckCount: number;
      failedCheckCount: number;
      pendingCheckCount: number;
    };
    missingEvidenceTypesAdded: ReleaseReadinessEvidenceType[];
    missingEvidenceTypesResolved: ReleaseReadinessEvidenceType[];
    failedEvidenceTypesAdded: ReleaseReadinessEvidenceType[];
    failedEvidenceTypesResolved: ReleaseReadinessEvidenceType[];
    staleEvidenceTypesAdded: ReleaseReadinessEvidenceType[];
    staleEvidenceTypesResolved: ReleaseReadinessEvidenceType[];
    openBlockersAdded: string[];
    openBlockersResolved: string[];
    newerPackAvailable: boolean;
    latestPack: {
      id: string;
      version: number;
      artifactChecksumSha256: string;
    } | null;
  } | null;
  requestedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  supersededAt: string | null;
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

type ReleaseLaunchClosurePackProjection = {
  id: string;
  releaseIdentifier: string;
  environment: ReleaseReadinessEnvironment;
  version: number;
  generatedByOperatorId: string;
  generatedByOperatorRole: string | null;
  artifactChecksumSha256: string;
  artifactPayload: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
};

type ReleaseLaunchClosurePackMutationResult = {
  pack: ReleaseLaunchClosurePackProjection;
};

type ReleaseLaunchClosurePackList = {
  packs: ReleaseLaunchClosurePackProjection[];
  limit: number;
  totalCount: number;
};

type StoredLaunchClosurePackResult = {
  validation: {
    errors: string[];
    warnings: string[];
  };
  summaryMarkdown: string;
  outputSubpath: string;
  files: Array<{
    relativePath: string;
    content: string;
  }>;
  pack: ReleaseLaunchClosurePackProjection;
};

type LaunchClosureOperationalCheck = {
  evidenceType: ReleaseReadinessEvidenceType;
  label: string;
  status: "passed" | "failed" | "pending" | "stale";
  acceptedEnvironments: ReleaseReadinessEnvironment[];
  latestEvidence: ReleaseReadinessEvidenceProjection | null;
};

type LaunchClosureStatusProjection = {
  generatedAt: string;
  releaseIdentifier: string | null;
  environment: ReleaseReadinessEnvironment | null;
  overallStatus: "ready" | "blocked" | "approved" | "rejected" | "in_progress";
  maximumEvidenceAgeHours: number;
  externalChecks: LaunchClosureOperationalCheck[];
  latestApproval: ReleaseReadinessApprovalProjection | null;
  summaryMarkdown: string;
};

const rollbackScopedEvidenceTypes = new Set<ReleaseReadinessEvidenceType>([
  ReleaseReadinessEvidenceType.api_rollback_drill,
  ReleaseReadinessEvidenceType.worker_rollback_drill
]);

@Injectable()
export class ReleaseReadinessService {
  private readonly requestAllowedOperatorRoles: string[];
  private readonly approvalAllowedOperatorRoles: string[];
  private readonly maxEvidenceAgeHours: number;

  constructor(private readonly prismaService: PrismaService) {
    const config = loadReleaseReadinessApprovalRuntimeConfig();
    this.requestAllowedOperatorRoles = [
      ...config.releaseReadinessApprovalRequestAllowedOperatorRoles
    ];
    this.approvalAllowedOperatorRoles = [
      ...config.releaseReadinessApprovalApproverAllowedOperatorRoles
    ];
    this.maxEvidenceAgeHours = config.releaseReadinessApprovalMaxEvidenceAgeHours;
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

  private assertCanRequest(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.requestAllowedOperatorRoles,
      "Operator role is not authorized to request launch readiness approval."
    );
  }

  private assertCanApprove(operatorRole?: string): string {
    return assertOperatorRoleAuthorized(
      operatorRole,
      this.approvalAllowedOperatorRoles,
      "Operator role is not authorized to approve or reject launch readiness."
    );
  }

  private isOperatorRoleAllowed(
    operatorRole: string | undefined | null,
    allowedOperatorRoles: readonly string[]
  ): boolean {
    const normalizedOperatorRole = normalizeOperatorRole(operatorRole);

    return Boolean(
      normalizedOperatorRole &&
        allowedOperatorRoles.includes(normalizedOperatorRole)
    );
  }

  private buildApprovalPolicy(
    operatorId?: string | null,
    operatorRole?: string | null
  ): ReleaseReadinessSummary["approvalPolicy"] {
    const normalizedOperatorRole = normalizeOperatorRole(operatorRole);

    return {
      requestAllowedOperatorRoles: [...this.requestAllowedOperatorRoles],
      approverAllowedOperatorRoles: [...this.approvalAllowedOperatorRoles],
      maximumEvidenceAgeHours: this.maxEvidenceAgeHours,
      currentOperator: {
        operatorId: operatorId?.trim() || null,
        operatorRole: normalizedOperatorRole,
        canRequestApproval: this.isOperatorRoleAllowed(
          normalizedOperatorRole,
          this.requestAllowedOperatorRoles
        ),
        canApproveOrReject: this.isOperatorRoleAllowed(
          normalizedOperatorRole,
          this.approvalAllowedOperatorRoles
        )
      }
    };
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

    if (query.releaseIdentifier) {
      where.releaseIdentifier = {
        equals: query.releaseIdentifier.trim(),
        mode: Prisma.QueryMode.insensitive
      };
    }

    if (query.sinceDays) {
      where.observedAt = {
        gte: new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000)
      };
    }

    return where;
  }

  private normalizeSummaryScope(
    scope?: ReleaseReadinessSummaryScope
  ): ReleaseReadinessSummaryScope {
    return {
      releaseIdentifier: this.normalizeOptionalString(scope?.releaseIdentifier),
      environment: scope?.environment ?? null
    };
  }

  private buildSummaryEvidenceWhere(
    scope?: ReleaseReadinessSummaryScope
  ): Prisma.ReleaseReadinessEvidenceWhereInput {
    const normalizedScope = this.normalizeSummaryScope(scope);
    const where: Prisma.ReleaseReadinessEvidenceWhereInput = {
      evidenceType: {
        in: requiredReleaseReadinessChecks.map((check) => check.evidenceType)
      }
    };

    if (normalizedScope.releaseIdentifier) {
      where.releaseIdentifier = normalizedScope.releaseIdentifier;
    }

    if (normalizedScope.environment) {
      where.environment = normalizedScope.environment;
    }

    return where;
  }

  private buildRecentEvidenceWhere(
    scope?: ReleaseReadinessSummaryScope
  ): Prisma.ReleaseReadinessEvidenceWhereInput {
    const normalizedScope = this.normalizeSummaryScope(scope);
    const where: Prisma.ReleaseReadinessEvidenceWhereInput = {};

    if (normalizedScope.releaseIdentifier) {
      where.releaseIdentifier = normalizedScope.releaseIdentifier;
    }

    if (normalizedScope.environment) {
      where.environment = normalizedScope.environment;
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
        equals: query.releaseIdentifier.trim(),
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
        latestEvidenceStatus: check.latestEvidence?.status ?? null,
        latestEvidenceReleaseIdentifier: check.latestEvidence?.releaseIdentifier ?? null,
        latestEvidenceRollbackReleaseIdentifier:
          check.latestEvidence?.rollbackReleaseIdentifier ?? null,
        latestEvidenceBackupReference: check.latestEvidence?.backupReference ?? null
      }))
    };
  }

  private buildApprovalMetadataMismatches(
    summary: ReleaseReadinessSummary,
    rollbackReleaseIdentifier: string | null
  ): ReleaseReadinessApprovalMetadataMismatch[] {
    const mismatches: ReleaseReadinessApprovalMetadataMismatch[] = [];

    for (const check of summary.requiredChecks) {
      const latestEvidence = check.latestEvidence;

      if (!latestEvidence) {
        continue;
      }

      const missingMetadata = validateReleaseReadinessEvidenceMetadata({
        evidenceType: check.evidenceType,
        releaseIdentifier: latestEvidence.releaseIdentifier,
        rollbackReleaseIdentifier: latestEvidence.rollbackReleaseIdentifier,
        backupReference: latestEvidence.backupReference
      });

      if (missingMetadata.length > 0) {
        mismatches.push({
          evidenceType: check.evidenceType,
          reason: `Latest ${check.evidenceType} evidence is missing ${describeReleaseReadinessEvidenceMetadataRequirements(
            check.evidenceType
          ).join(", ")}.`
        });
        continue;
      }

      if (
        rollbackScopedEvidenceTypes.has(check.evidenceType) &&
        !rollbackReleaseIdentifier
      ) {
        mismatches.push({
          evidenceType: check.evidenceType,
          reason: `Approval is missing rollback release identifier required for ${check.evidenceType}.`
        });
        continue;
      }

      if (
        rollbackScopedEvidenceTypes.has(check.evidenceType) &&
        latestEvidence.rollbackReleaseIdentifier !== rollbackReleaseIdentifier
      ) {
        mismatches.push({
          evidenceType: check.evidenceType,
          reason: `Latest ${check.evidenceType} evidence targets rollback release ${
            latestEvidence.rollbackReleaseIdentifier ?? "none"
          } instead of ${rollbackReleaseIdentifier}.`
        });
      }
    }

    return mismatches;
  }

  private evaluateApprovalGate(
    summary: ReleaseReadinessSummary,
    checklist: ReleaseReadinessApprovalChecklist,
    status: ReleaseReadinessApprovalStatus,
    rollbackReleaseIdentifier: string | null
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
    const staleEvidenceTypes = summary.requiredChecks
      .filter((check) => {
        if (check.status !== "passed" || !check.latestEvidence?.observedAt) {
          return false;
        }

        const observedAt = new Date(check.latestEvidence.observedAt);

        return (
          Date.now() - observedAt.getTime() >
          this.maxEvidenceAgeHours * 60 * 60 * 1000
        );
      })
      .map((check) => check.evidenceType);
    const metadataMismatches = this.buildApprovalMetadataMismatches(
      summary,
      rollbackReleaseIdentifier
    );
    const openBlockers = [...checklist.openBlockers];
    const approvalEligible =
      missingChecklistItems.length === 0 &&
      missingEvidenceTypes.length === 0 &&
      failedEvidenceTypes.length === 0 &&
      metadataMismatches.length === 0 &&
      staleEvidenceTypes.length === 0 &&
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
      staleEvidenceTypes,
      metadataMismatches,
      maximumEvidenceAgeHours: this.maxEvidenceAgeHours,
      openBlockers,
      generatedAt: summary.generatedAt
    };
  }

  private mapStoredApprovalEvidenceSnapshot(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalEvidenceSnapshot {
    const snapshot =
      record.evidenceSnapshot as unknown as Partial<ReleaseReadinessApprovalEvidenceSnapshot>;

    return {
      generatedAt: snapshot.generatedAt ?? record.updatedAt.toISOString(),
      overallStatus: snapshot.overallStatus ?? "warning",
      summary: snapshot.summary ?? {
        requiredCheckCount: 0,
        passedCheckCount: 0,
        failedCheckCount: 0,
        pendingCheckCount: 0
      },
      requiredChecks: (snapshot.requiredChecks ?? []).map((check) => ({
        evidenceType: check.evidenceType,
        status: check.status,
        latestEvidenceObservedAt: check.latestEvidenceObservedAt ?? null,
        latestEvidenceEnvironment: check.latestEvidenceEnvironment ?? null,
        latestEvidenceStatus: check.latestEvidenceStatus ?? null,
        latestEvidenceReleaseIdentifier: check.latestEvidenceReleaseIdentifier ?? null,
        latestEvidenceRollbackReleaseIdentifier:
          check.latestEvidenceRollbackReleaseIdentifier ?? null,
        latestEvidenceBackupReference: check.latestEvidenceBackupReference ?? null
      }))
    };
  }

  private mapStoredApprovalGate(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalGate {
    const gate =
      record.blockerSnapshot as unknown as Partial<ReleaseReadinessApprovalGate>;

    return {
      overallStatus: gate.overallStatus ?? "blocked",
      approvalEligible: gate.approvalEligible ?? false,
      missingChecklistItems: gate.missingChecklistItems ?? [],
      missingEvidenceTypes: gate.missingEvidenceTypes ?? [],
      failedEvidenceTypes: gate.failedEvidenceTypes ?? [],
      staleEvidenceTypes: gate.staleEvidenceTypes ?? [],
      metadataMismatches: gate.metadataMismatches ?? [],
      maximumEvidenceAgeHours:
        gate.maximumEvidenceAgeHours ?? this.maxEvidenceAgeHours,
      openBlockers: gate.openBlockers ?? [],
      generatedAt: gate.generatedAt ?? record.updatedAt.toISOString()
    };
  }

  private mapStoredLaunchClosureDrift(
    record: ReleaseReadinessApprovalRecord
  ): ReleaseReadinessApprovalProjection["launchClosureDrift"] {
    const drift =
      record.decisionDriftSnapshot as unknown as Partial<
        NonNullable<ReleaseReadinessApprovalProjection["launchClosureDrift"]>
      > | null;

    if (!drift) {
      return null;
    }

    return {
      changed: drift.changed ?? false,
      critical: drift.critical ?? false,
      blockingReasons: drift.blockingReasons ?? [],
      currentOverallStatus: drift.currentOverallStatus ?? "blocked",
      summaryDelta: {
        passedCheckCount: drift.summaryDelta?.passedCheckCount ?? 0,
        failedCheckCount: drift.summaryDelta?.failedCheckCount ?? 0,
        pendingCheckCount: drift.summaryDelta?.pendingCheckCount ?? 0
      },
      missingEvidenceTypesAdded: drift.missingEvidenceTypesAdded ?? [],
      missingEvidenceTypesResolved: drift.missingEvidenceTypesResolved ?? [],
      failedEvidenceTypesAdded: drift.failedEvidenceTypesAdded ?? [],
      failedEvidenceTypesResolved: drift.failedEvidenceTypesResolved ?? [],
      staleEvidenceTypesAdded: drift.staleEvidenceTypesAdded ?? [],
      staleEvidenceTypesResolved: drift.staleEvidenceTypesResolved ?? [],
      openBlockersAdded: drift.openBlockersAdded ?? [],
      openBlockersResolved: drift.openBlockersResolved ?? [],
      newerPackAvailable: drift.newerPackAvailable ?? false,
      latestPack: drift.latestPack ?? null
    };
  }

  private listAddedItems<T extends string>(baseline: T[], current: T[]): T[] {
    const baselineSet = new Set(baseline);

    return [...new Set(current.filter((item) => !baselineSet.has(item)))];
  }

  private listResolvedItems<T extends string>(baseline: T[], current: T[]): T[] {
    const currentSet = new Set(current);

    return [...new Set(baseline.filter((item) => !currentSet.has(item)))];
  }

  private buildLaunchClosureDrift(
    record: ReleaseReadinessApprovalRecord,
    currentSummary?: ReleaseReadinessSummary,
    latestPack?: ReleaseLaunchClosurePackRecord | null
  ): ReleaseReadinessApprovalProjection["launchClosureDrift"] {
    if (!currentSummary) {
      return null;
    }

    const storedSnapshot = this.mapStoredApprovalEvidenceSnapshot(record);
    const storedGate = this.mapStoredApprovalGate(record);
    const checklist = this.mapApprovalChecklist(record);
    const currentGate = this.evaluateApprovalGate(
      currentSummary,
      checklist,
      record.status === ReleaseReadinessApprovalStatus.pending_approval
        ? ReleaseReadinessApprovalStatus.pending_approval
        : record.status,
      record.rollbackReleaseIdentifier ?? null
    );
    const currentOverallStatus: LaunchClosureStatusProjection["overallStatus"] =
      record.status === ReleaseReadinessApprovalStatus.approved
        ? "approved"
        : record.status === ReleaseReadinessApprovalStatus.rejected
          ? "rejected"
          : currentGate.approvalEligible
            ? "ready"
            : "blocked";
    const latestPackProjection =
      latestPack && latestPack.id !== record.launchClosurePackId
        ? {
            id: latestPack.id,
            version: latestPack.version,
            artifactChecksumSha256: latestPack.artifactChecksumSha256
          }
        : latestPack &&
            latestPack.version !== record.launchClosurePackVersion
          ? {
              id: latestPack.id,
              version: latestPack.version,
              artifactChecksumSha256: latestPack.artifactChecksumSha256
            }
          : latestPack &&
              latestPack.artifactChecksumSha256 !==
                record.launchClosurePackChecksumSha256
            ? {
                id: latestPack.id,
                version: latestPack.version,
                artifactChecksumSha256: latestPack.artifactChecksumSha256
              }
            : null;
    const summaryDelta = {
      passedCheckCount:
        currentSummary.summary.passedCheckCount -
        storedSnapshot.summary.passedCheckCount,
      failedCheckCount:
        currentSummary.summary.failedCheckCount -
        storedSnapshot.summary.failedCheckCount,
      pendingCheckCount:
        currentSummary.summary.pendingCheckCount -
        storedSnapshot.summary.pendingCheckCount
    };
    const missingEvidenceTypesAdded = this.listAddedItems(
      storedGate.missingEvidenceTypes,
      currentGate.missingEvidenceTypes
    );
    const missingEvidenceTypesResolved = this.listResolvedItems(
      storedGate.missingEvidenceTypes,
      currentGate.missingEvidenceTypes
    );
    const failedEvidenceTypesAdded = this.listAddedItems(
      storedGate.failedEvidenceTypes,
      currentGate.failedEvidenceTypes
    );
    const failedEvidenceTypesResolved = this.listResolvedItems(
      storedGate.failedEvidenceTypes,
      currentGate.failedEvidenceTypes
    );
    const staleEvidenceTypesAdded = this.listAddedItems(
      storedGate.staleEvidenceTypes,
      currentGate.staleEvidenceTypes
    );
    const staleEvidenceTypesResolved = this.listResolvedItems(
      storedGate.staleEvidenceTypes,
      currentGate.staleEvidenceTypes
    );
    const openBlockersAdded = this.listAddedItems(
      storedGate.openBlockers,
      currentGate.openBlockers
    );
    const openBlockersResolved = this.listResolvedItems(
      storedGate.openBlockers,
      currentGate.openBlockers
    );
    const changed =
      summaryDelta.passedCheckCount !== 0 ||
      summaryDelta.failedCheckCount !== 0 ||
      summaryDelta.pendingCheckCount !== 0 ||
      missingEvidenceTypesAdded.length > 0 ||
      missingEvidenceTypesResolved.length > 0 ||
      failedEvidenceTypesAdded.length > 0 ||
      failedEvidenceTypesResolved.length > 0 ||
      staleEvidenceTypesAdded.length > 0 ||
      staleEvidenceTypesResolved.length > 0 ||
      openBlockersAdded.length > 0 ||
      openBlockersResolved.length > 0 ||
      latestPackProjection !== null ||
      currentOverallStatus !== storedGate.overallStatus;
    const blockingReasons = [
      ...(latestPackProjection
        ? [
            `A newer launch-closure pack (${latestPackProjection.id}) is available for this release scope.`
          ]
        : []),
      ...missingEvidenceTypesAdded.map(
        (evidenceType) => `Missing evidence was introduced for ${evidenceType}.`
      ),
      ...failedEvidenceTypesAdded.map(
        (evidenceType) => `Failed evidence is now present for ${evidenceType}.`
      ),
      ...staleEvidenceTypesAdded.map(
        (evidenceType) => `Evidence became stale for ${evidenceType}.`
      ),
      ...openBlockersAdded.map(
        (blocker) => `A new open blocker was introduced: ${blocker}.`
      ),
      ...(currentOverallStatus === "blocked"
        ? [
            "Current live launch-closure posture is blocked and no longer matches the bound approval artifact."
          ]
        : [])
    ];
    const critical = blockingReasons.length > 0;

    return {
      changed,
      critical,
      blockingReasons,
      currentOverallStatus,
      summaryDelta,
      missingEvidenceTypesAdded,
      missingEvidenceTypesResolved,
      failedEvidenceTypesAdded,
      failedEvidenceTypesResolved,
      staleEvidenceTypesAdded,
      staleEvidenceTypesResolved,
      openBlockersAdded,
      openBlockersResolved,
      newerPackAvailable: latestPackProjection !== null,
      latestPack: latestPackProjection
    };
  }

  private assertApprovalDriftDoesNotBlock(
    drift: ReleaseReadinessApprovalProjection["launchClosureDrift"]
  ): void {
    if (!drift?.critical) {
      return;
    }

    throw new ConflictException(
      `Launch approval is blocked until the bound launch-closure pack is refreshed for current live posture. ${drift.blockingReasons.join(
        " "
      )}`
    );
  }

  private mapApprovalProjection(
    record: ReleaseReadinessApprovalRecord,
    currentSummary?: ReleaseReadinessSummary,
    latestPack?: ReleaseLaunchClosurePackRecord | null
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
        ? this.evaluateApprovalGate(
            currentSummary,
            checklist,
            record.status,
            record.rollbackReleaseIdentifier ?? null
          )
        : this.mapStoredApprovalGate(record);

    return {
      id: record.id,
      supersedesApprovalId: record.supersedesApprovalId ?? null,
      supersededByApprovalId: record.supersededByApprovalId ?? null,
      releaseIdentifier: record.releaseIdentifier,
      environment: record.environment,
      launchClosurePack: record.launchClosurePackId &&
        record.launchClosurePackVersion !== null &&
        record.launchClosurePackChecksumSha256
        ? {
            id: record.launchClosurePackId,
            version: record.launchClosurePackVersion,
            artifactChecksumSha256: record.launchClosurePackChecksumSha256
          }
        : null,
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
      supersededByOperatorId: record.supersededByOperatorId ?? null,
      supersededByOperatorRole: record.supersededByOperatorRole ?? null,
      checklist,
      evidenceSnapshot,
      gate,
      launchClosureDrift:
        record.status === ReleaseReadinessApprovalStatus.pending_approval
          ? this.buildLaunchClosureDrift(record, currentSummary, latestPack)
          : this.mapStoredLaunchClosureDrift(record),
      requestedAt: record.requestedAt.toISOString(),
      approvedAt: record.approvedAt?.toISOString() ?? null,
      rejectedAt: record.rejectedAt?.toISOString() ?? null,
      supersededAt: record.supersededAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private buildChecksum(value: Prisma.JsonValue): string {
    return createHash("sha256")
      .update(JSON.stringify(value))
      .digest("hex");
  }

  private mapLaunchClosurePackProjection(
    record: ReleaseLaunchClosurePackRecord
  ): ReleaseLaunchClosurePackProjection {
    return {
      id: record.id,
      releaseIdentifier: record.releaseIdentifier,
      environment: record.environment,
      version: record.version,
      generatedByOperatorId: record.generatedByOperatorId,
      generatedByOperatorRole: record.generatedByOperatorRole ?? null,
      artifactChecksumSha256: record.artifactChecksumSha256,
      artifactPayload: record.artifactPayload,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString()
    };
  }

  private buildLaunchClosurePackWhere(
    query: ListReleaseLaunchClosurePacksDto
  ): Prisma.ReleaseLaunchClosurePackWhereInput {
    const where: Prisma.ReleaseLaunchClosurePackWhereInput = {};

    if (query.releaseIdentifier) {
      where.releaseIdentifier = {
        equals: query.releaseIdentifier.trim(),
        mode: Prisma.QueryMode.insensitive
      };
    }

    if (query.environment) {
      where.environment = query.environment;
    }

    if (query.sinceDays) {
      where.createdAt = {
        gte: new Date(Date.now() - query.sinceDays * 24 * 60 * 60 * 1000)
      };
    }

    return where;
  }

  private async getLatestLaunchClosurePackForScope(
    releaseIdentifier: string,
    environment: ReleaseReadinessEnvironment
  ): Promise<ReleaseLaunchClosurePackRecord | null> {
    return this.prismaService.releaseLaunchClosurePack.findFirst({
      where: {
        releaseIdentifier,
        environment
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }]
    });
  }

  async recordEvidence(
    dto: CreateReleaseReadinessEvidenceDto,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessEvidenceMutationResult> {
    const normalizedOperatorRole = normalizeOperatorRole(operatorRole);
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
    const missingMetadata = validateReleaseReadinessEvidenceMetadata({
      evidenceType: dto.evidenceType,
      releaseIdentifier,
      rollbackReleaseIdentifier,
      backupReference
    });
    const startedAt = this.normalizeOptionalDate(dto.startedAt);
    const completedAt = this.normalizeOptionalDate(dto.completedAt);
    const observedAt = this.normalizeOptionalDate(dto.observedAt) ?? new Date();
    const evidenceLinks = this.normalizeEvidenceLinks(dto.evidenceLinks);
    const evidencePayload =
      (dto.evidencePayload as Prisma.InputJsonValue | undefined) ?? undefined;

    if (missingMetadata.length > 0) {
      throw new BadRequestException(
        `Release readiness evidence for ${dto.evidenceType} requires ${describeReleaseReadinessEvidenceMetadataRequirements(
          dto.evidenceType
        ).join(", ")}.`
      );
    }

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

  async getSummary(
    scope?: ReleaseReadinessSummaryScope,
    operatorContext?: {
      operatorId?: string | null;
      operatorRole?: string | null;
    }
  ): Promise<ReleaseReadinessSummary> {
    const normalizedScope = this.normalizeSummaryScope(scope);
    const candidateEvidence = await this.prismaService.releaseReadinessEvidence.findMany({
      where: this.buildSummaryEvidenceWhere(normalizedScope),
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }]
    });
    const recentEvidence = await this.prismaService.releaseReadinessEvidence.findMany({
      where: this.buildRecentEvidenceWhere(normalizedScope),
      orderBy: [{ observedAt: "desc" }, { createdAt: "desc" }],
      take: 10
    });

    const latestEvidenceByType = new Map<
      ReleaseReadinessEvidenceType,
      ReleaseReadinessEvidenceRecord
    >();

    for (const evidence of candidateEvidence) {
      const check = requiredReleaseReadinessChecks.find(
        (candidateCheck) => candidateCheck.evidenceType === evidence.evidenceType
      );

      if (
        check &&
        check.acceptedEnvironments.includes(evidence.environment) &&
        !latestEvidenceByType.has(evidence.evidenceType)
      ) {
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
      releaseIdentifier: normalizedScope.releaseIdentifier ?? null,
      environment: normalizedScope.environment ?? null,
      approvalPolicy: this.buildApprovalPolicy(
        operatorContext?.operatorId,
        operatorContext?.operatorRole
      ),
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

  async getLaunchClosureStatus(
    scope?: ReleaseReadinessSummaryScope,
    operatorContext?: {
      operatorId?: string | null;
      operatorRole?: string | null;
    }
  ): Promise<LaunchClosureStatusProjection> {
    const summary = await this.getSummary(scope, operatorContext);
    const [latestApprovalRecord, latestPack] = summary.releaseIdentifier
      ? await Promise.all([
          this.prismaService.releaseReadinessApproval.findFirst({
          where: {
            releaseIdentifier: summary.releaseIdentifier,
            ...(summary.environment ? { environment: summary.environment } : {})
          },
          orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }]
        }),
          summary.environment
            ? this.getLatestLaunchClosurePackForScope(
                summary.releaseIdentifier,
                summary.environment
              )
            : Promise.resolve(null)
        ])
      : [null, null];
    const latestApproval = latestApprovalRecord
      ? this.mapApprovalProjection(latestApprovalRecord, summary, latestPack)
      : null;

    const externalChecks: LaunchClosureOperationalCheck[] =
      summary.requiredChecks
        .filter((check) =>
          !check.acceptedEnvironments.includes(
            ReleaseReadinessEnvironment.development
          ) &&
          !check.acceptedEnvironments.includes(ReleaseReadinessEnvironment.ci)
        )
        .map((check) => {
          const isStale =
            check.status === "passed" &&
            check.latestEvidence?.observedAt &&
            Date.now() - new Date(check.latestEvidence.observedAt).getTime() >
              this.maxEvidenceAgeHours * 60 * 60 * 1000;

          return {
            evidenceType: check.evidenceType,
            label: check.label,
            status: isStale ? "stale" : check.status,
            acceptedEnvironments: [...check.acceptedEnvironments],
            latestEvidence: check.latestEvidence
          };
        });

    const hasBlockingChecks = externalChecks.some(
      (check) =>
        check.status === "failed" ||
        check.status === "pending" ||
        check.status === "stale"
    );
    const overallStatus: LaunchClosureStatusProjection["overallStatus"] =
      latestApproval?.status === ReleaseReadinessApprovalStatus.approved
        ? "approved"
        : latestApproval?.status === ReleaseReadinessApprovalStatus.rejected
          ? "rejected"
          : latestApproval?.gate.approvalEligible
            ? "ready"
            : hasBlockingChecks ||
                latestApproval?.gate.overallStatus === "blocked"
              ? "blocked"
              : summary.releaseIdentifier
                ? "in_progress"
                : "blocked";

    return {
      generatedAt: summary.generatedAt,
      releaseIdentifier: summary.releaseIdentifier,
      environment: summary.environment,
      overallStatus,
      maximumEvidenceAgeHours: this.maxEvidenceAgeHours,
      externalChecks,
      latestApproval,
      summaryMarkdown: renderLaunchClosureStatusSummary({
        releaseIdentifier: summary.releaseIdentifier,
        environment: summary.environment as
          | "staging"
          | "production_like"
          | "production"
          | null,
        overallStatus,
        maximumEvidenceAgeHours: this.maxEvidenceAgeHours,
        externalChecks: externalChecks.map((check) => ({
          evidenceType: check.evidenceType,
          status: check.status,
          acceptedEnvironments: check.acceptedEnvironments,
          latestEvidenceObservedAt: check.latestEvidence?.observedAt ?? null,
          latestEvidenceEnvironment: check.latestEvidence?.environment ?? null
        })),
        latestApproval: latestApproval
          ? {
              status: latestApproval.status,
              gateOverallStatus: latestApproval.gate.overallStatus,
              missingEvidenceTypes: latestApproval.gate.missingEvidenceTypes,
              failedEvidenceTypes: latestApproval.gate.failedEvidenceTypes,
              staleEvidenceTypes: latestApproval.gate.staleEvidenceTypes,
              openBlockers: latestApproval.gate.openBlockers
            }
          : null
      })
    };
  }

  async storeLaunchClosurePack(
    manifest: LaunchClosureManifest,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<StoredLaunchClosurePackResult> {
    const validation = validateLaunchClosureManifest(manifest);

    if (validation.errors.length > 0) {
      throw new BadRequestException(validation.errors.join(" "));
    }

    const statusSnapshot = await this.getLaunchClosureStatus({
      releaseIdentifier: manifest.releaseIdentifier,
      environment: manifest.environment
    });
    const preview = previewLaunchClosurePack(manifest, {
      generatedAt: statusSnapshot.generatedAt,
      releaseIdentifier: statusSnapshot.releaseIdentifier,
      environment: manifest.environment,
      overallStatus: statusSnapshot.overallStatus,
      maximumEvidenceAgeHours: statusSnapshot.maximumEvidenceAgeHours,
      externalChecks: statusSnapshot.externalChecks.map((check) => ({
        evidenceType: check.evidenceType,
        status: check.status,
        acceptedEnvironments: check.acceptedEnvironments,
        latestEvidenceObservedAt: check.latestEvidence?.observedAt ?? null,
        latestEvidenceEnvironment: check.latestEvidence?.environment ?? null
      })),
      latestApproval: statusSnapshot.latestApproval
        ? {
            status: statusSnapshot.latestApproval.status,
            summary: statusSnapshot.latestApproval.summary,
            requestNote: statusSnapshot.latestApproval.requestNote,
            residualRiskNote:
              statusSnapshot.latestApproval.checklist.residualRiskNote,
            rollbackReleaseIdentifier:
              statusSnapshot.latestApproval.rollbackReleaseIdentifier,
            checklist: {
              securityConfigurationComplete:
                statusSnapshot.latestApproval.checklist
                  .securityConfigurationComplete,
              accessAndGovernanceComplete:
                statusSnapshot.latestApproval.checklist
                  .accessAndGovernanceComplete,
              dataAndRecoveryComplete:
                statusSnapshot.latestApproval.checklist.dataAndRecoveryComplete,
              platformHealthComplete:
                statusSnapshot.latestApproval.checklist.platformHealthComplete,
              functionalProofComplete:
                statusSnapshot.latestApproval.checklist.functionalProofComplete,
              contractAndChainProofComplete:
                statusSnapshot.latestApproval.checklist
                  .contractAndChainProofComplete,
              finalSignoffComplete:
                statusSnapshot.latestApproval.checklist.finalSignoffComplete,
              unresolvedRisksAccepted:
                statusSnapshot.latestApproval.checklist.unresolvedRisksAccepted
            },
            gateOverallStatus: statusSnapshot.latestApproval.gate.overallStatus,
            missingEvidenceTypes:
              statusSnapshot.latestApproval.gate.missingEvidenceTypes,
            failedEvidenceTypes:
              statusSnapshot.latestApproval.gate.failedEvidenceTypes,
            staleEvidenceTypes:
              statusSnapshot.latestApproval.gate.staleEvidenceTypes,
            openBlockers: statusSnapshot.latestApproval.gate.openBlockers
          }
        : null
    });
    const summaryMarkdown = renderLaunchClosureValidationSummary(manifest);
    const artifactPayload = {
      manifest,
      validation,
      summaryMarkdown,
      outputSubpath: preview.outputSubpath,
      files: preview.files
    } as Prisma.JsonValue;
    const artifactChecksumSha256 = this.buildChecksum(artifactPayload);
    const normalizedOperatorRole = normalizeOperatorRole(operatorRole);

    const pack = await this.prismaService.$transaction(async (transaction) => {
      const latestPack = await transaction.releaseLaunchClosurePack.findFirst({
        where: {
          releaseIdentifier: manifest.releaseIdentifier,
          environment: manifest.environment
        },
        orderBy: [{ version: "desc" }]
      });
      const nextVersion = (latestPack?.version ?? 0) + 1;

      const createdPack = await transaction.releaseLaunchClosurePack.create({
        data: {
          releaseIdentifier: manifest.releaseIdentifier,
          environment: manifest.environment,
          version: nextVersion,
          generatedByOperatorId: operatorId,
          generatedByOperatorRole: normalizedOperatorRole ?? undefined,
          artifactChecksumSha256,
          artifactPayload: artifactPayload as Prisma.InputJsonValue
        }
      });

      await transaction.auditEvent.create({
        data: {
          actorType: "operator",
          actorId: operatorId,
          action: "release_readiness.launch_closure_pack_generated",
          targetType: "ReleaseLaunchClosurePack",
          targetId: createdPack.id,
          metadata: {
            releaseIdentifier: createdPack.releaseIdentifier,
            environment: createdPack.environment,
            version: createdPack.version,
            artifactChecksumSha256,
            operatorRole: normalizedOperatorRole
          } as Prisma.InputJsonValue
        }
      });

      return createdPack;
    });

    return {
      validation,
      summaryMarkdown,
      outputSubpath: preview.outputSubpath,
      files: preview.files,
      pack: this.mapLaunchClosurePackProjection(pack)
    };
  }

  async getLaunchClosurePack(
    packId: string
  ): Promise<ReleaseLaunchClosurePackMutationResult> {
    const pack = await this.prismaService.releaseLaunchClosurePack.findUnique({
      where: {
        id: packId
      }
    });

    if (!pack) {
      throw new NotFoundException("Launch-closure pack was not found.");
    }

    return {
      pack: this.mapLaunchClosurePackProjection(pack)
    };
  }

  async listLaunchClosurePacks(
    query: ListReleaseLaunchClosurePacksDto
  ): Promise<ReleaseLaunchClosurePackList> {
    const limit = query.limit ?? 12;
    const where = this.buildLaunchClosurePackWhere(query);

    const [packs, totalCount] = await Promise.all([
      this.prismaService.releaseLaunchClosurePack.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        take: limit
      }),
      this.prismaService.releaseLaunchClosurePack.count({
        where
      })
    ]);

    return {
      packs: packs.map((record) => this.mapLaunchClosurePackProjection(record)),
      limit,
      totalCount
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
    const normalizedOperatorRole = this.assertCanRequest(operatorRole);
    const checklist = this.buildApprovalChecklist(dto);

    if (!rollbackReleaseIdentifier) {
      throw new BadRequestException(
        "Launch approval requests require rollback release identifier."
      );
    }

    const [existingPendingApproval, launchClosurePack, readinessSummary] =
      await Promise.all([
      this.prismaService.releaseReadinessApproval.findFirst({
        where: {
          releaseIdentifier,
          environment: dto.environment,
          status: ReleaseReadinessApprovalStatus.pending_approval
        },
        orderBy: [{ requestedAt: "desc" }]
      }),
      this.prismaService.releaseLaunchClosurePack.findUnique({
        where: {
          id: dto.launchClosurePackId.trim()
        }
      }),
      this.getSummary({
        releaseIdentifier
      })
    ]);

    if (existingPendingApproval) {
      throw new ConflictException(
        "A pending launch approval already exists for this release identifier and environment."
      );
    }

    if (!launchClosurePack) {
      throw new NotFoundException("Launch-closure pack was not found.");
    }

    if (
      launchClosurePack.releaseIdentifier !== releaseIdentifier ||
      launchClosurePack.environment !== dto.environment
    ) {
      throw new BadRequestException(
        "Launch approval requests must reference a launch-closure pack for the same release identifier and environment."
      );
    }

    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const gate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.pending_approval,
      rollbackReleaseIdentifier
    );

    const approval = await this.prismaService.$transaction(async (transaction) => {
      const createdApproval = await transaction.releaseReadinessApproval.create({
        data: {
          releaseIdentifier,
          environment: dto.environment,
          launchClosurePackId: launchClosurePack.id,
          launchClosurePackVersion: launchClosurePack.version,
          launchClosurePackChecksumSha256:
            launchClosurePack.artifactChecksumSha256,
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
            launchClosurePackId: launchClosurePack.id,
            launchClosurePackVersion: launchClosurePack.version,
            launchClosurePackChecksumSha256:
              launchClosurePack.artifactChecksumSha256,
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

    if (approval.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Launch approval requires a different approver than the requester."
      );
    }

    const readinessSummary = await this.getSummary({
      releaseIdentifier: approval.releaseIdentifier
    });
    const checklist = this.mapApprovalChecklist(approval);
    const gate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.pending_approval,
      approval.rollbackReleaseIdentifier ?? null
    );
    const latestPack = await this.getLatestLaunchClosurePackForScope(
      approval.releaseIdentifier,
      approval.environment
    );
    const launchClosureDrift = this.buildLaunchClosureDrift(
      approval,
      readinessSummary,
      latestPack
    );

    if (!gate.approvalEligible) {
      throw new ConflictException(
        "Launch approval is blocked until checklist gaps, failed or stale evidence, and open blockers are remediated."
      );
    }

    this.assertApprovalDriftDoesNotBlock(launchClosureDrift);

    const approvalNote = this.normalizeOptionalString(dto.approvalNote);
    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const approvedGate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.approved,
      approval.rollbackReleaseIdentifier ?? null
    );
    const decisionDriftCapturedAt = new Date();

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
            blockerSnapshot: approvedGate as unknown as Prisma.InputJsonValue,
            decisionDriftSnapshot:
              launchClosureDrift as unknown as Prisma.InputJsonValue,
            decisionDriftCapturedAt
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
              gate: approvedGate,
              launchClosureDrift,
              decisionDriftCapturedAt: decisionDriftCapturedAt.toISOString()
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

  async rebindApprovalToLaunchClosurePack(
    approvalId: string,
    launchClosurePackId: string,
    operatorId: string,
    operatorRole: string | undefined
  ): Promise<ReleaseReadinessApprovalMutationResult> {
    const normalizedOperatorRole = this.assertCanRequest(operatorRole);
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
        "Only pending launch approvals can be rebound to a new launch-closure pack."
      );
    }

    const nextPackId = launchClosurePackId.trim();

    if (approval.launchClosurePackId === nextPackId) {
      throw new ConflictException(
        "Launch approval already references the requested launch-closure pack."
      );
    }

    const [launchClosurePack, readinessSummary] = await Promise.all([
      this.prismaService.releaseLaunchClosurePack.findUnique({
        where: {
          id: nextPackId
        }
      }),
      this.getSummary({
        releaseIdentifier: approval.releaseIdentifier,
        environment: approval.environment
      })
    ]);

    if (!launchClosurePack) {
      throw new NotFoundException("Launch-closure pack was not found.");
    }

    if (
      launchClosurePack.releaseIdentifier !== approval.releaseIdentifier ||
      launchClosurePack.environment !== approval.environment
    ) {
      throw new BadRequestException(
        "Launch approval rebind requires a launch-closure pack for the same release identifier and environment."
      );
    }

    const checklist = this.mapApprovalChecklist(approval);
    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const gate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.pending_approval,
      approval.rollbackReleaseIdentifier ?? null
    );

    const updatedApproval = await this.prismaService.$transaction(
      async (transaction) => {
        const supersededAt = new Date();
        const rebindableApproval =
          await transaction.releaseReadinessApproval.findUnique({
            where: {
              id: approval.id
            }
          });

        if (!rebindableApproval) {
          throw new NotFoundException(
            "Release readiness approval request was not found."
          );
        }

        if (
          rebindableApproval.status !==
          ReleaseReadinessApprovalStatus.pending_approval
        ) {
          throw new ConflictException(
            "Only pending launch approvals can be rebound to a new launch-closure pack."
          );
        }

        if (rebindableApproval.supersededByApprovalId) {
          throw new ConflictException(
            "Launch approval already has a replacement approval in its lineage."
          );
        }

        const lineageReplacement =
          await transaction.releaseReadinessApproval.findFirst({
            where: {
              supersedesApprovalId: approval.id
            }
          });

        if (lineageReplacement) {
          throw new ConflictException(
            "Launch approval lineage already contains a replacement approval."
          );
        }

        const nextApproval = await transaction.releaseReadinessApproval.create({
          data: {
            releaseIdentifier: approval.releaseIdentifier,
            environment: approval.environment,
            supersedesApprovalId: approval.id,
            launchClosurePackId: launchClosurePack.id,
            launchClosurePackVersion: launchClosurePack.version,
            launchClosurePackChecksumSha256:
              launchClosurePack.artifactChecksumSha256,
            rollbackReleaseIdentifier:
              approval.rollbackReleaseIdentifier ?? undefined,
            status: ReleaseReadinessApprovalStatus.pending_approval,
            summary: approval.summary,
            requestNote: approval.requestNote ?? undefined,
            requestedByOperatorId: approval.requestedByOperatorId,
            requestedByOperatorRole:
              approval.requestedByOperatorRole ?? undefined,
            securityConfigurationComplete:
              approval.securityConfigurationComplete,
            accessAndGovernanceComplete:
              approval.accessAndGovernanceComplete,
            dataAndRecoveryComplete: approval.dataAndRecoveryComplete,
            platformHealthComplete: approval.platformHealthComplete,
            functionalProofComplete: approval.functionalProofComplete,
            contractAndChainProofComplete:
              approval.contractAndChainProofComplete,
            finalSignoffComplete: approval.finalSignoffComplete,
            unresolvedRisksAccepted: approval.unresolvedRisksAccepted,
            openBlockers: [...approval.openBlockers],
            residualRiskNote: approval.residualRiskNote ?? undefined,
            evidenceSnapshot: evidenceSnapshot as unknown as Prisma.InputJsonValue,
            blockerSnapshot: gate as unknown as Prisma.InputJsonValue
          }
        });

        await transaction.releaseReadinessApproval.update({
          where: {
            id: approval.id
          },
          data: {
            status: ReleaseReadinessApprovalStatus.superseded,
            supersededByOperatorId: operatorId,
            supersededByOperatorRole: normalizedOperatorRole,
            supersededByApprovalId: nextApproval.id,
            supersededAt
          }
        });

        await transaction.auditEvent.create({
          data: {
            actorType: "operator",
            actorId: operatorId,
            action: "release_readiness.approval_pack_rebound",
            targetType: "ReleaseReadinessApproval",
            targetId: approval.id,
            metadata: {
              releaseIdentifier: approval.releaseIdentifier,
              environment: approval.environment,
              supersededApprovalId: approval.id,
              supersededByApprovalId: nextApproval.id,
              supersededAt: supersededAt.toISOString(),
              previousLaunchClosurePackId: approval.launchClosurePackId,
              previousLaunchClosurePackVersion: approval.launchClosurePackVersion,
              previousLaunchClosurePackChecksumSha256:
                approval.launchClosurePackChecksumSha256,
              nextApprovalId: nextApproval.id,
              nextApprovalSupersedesApprovalId: approval.id,
              nextLaunchClosurePackId: launchClosurePack.id,
              nextLaunchClosurePackVersion: launchClosurePack.version,
              nextLaunchClosurePackChecksumSha256:
                launchClosurePack.artifactChecksumSha256,
              operatorRole: normalizedOperatorRole,
              gate
            } as Prisma.InputJsonValue
          }
        });

        return nextApproval;
      }
    );

    return {
      approval: this.mapApprovalProjection(
        updatedApproval,
        readinessSummary,
        launchClosurePack
      )
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

    if (approval.requestedByOperatorId === operatorId) {
      throw new ForbiddenException(
        "Launch approval requires a different approver than the requester."
      );
    }

    const readinessSummary = await this.getSummary({
      releaseIdentifier: approval.releaseIdentifier
    });
    const checklist = this.mapApprovalChecklist(approval);
    const evidenceSnapshot = this.buildApprovalEvidenceSnapshot(readinessSummary);
    const rejectedGate = this.evaluateApprovalGate(
      readinessSummary,
      checklist,
      ReleaseReadinessApprovalStatus.rejected,
      approval.rollbackReleaseIdentifier ?? null
    );
    const latestPack = await this.getLatestLaunchClosurePackForScope(
      approval.releaseIdentifier,
      approval.environment
    );
    const launchClosureDrift = this.buildLaunchClosureDrift(
      approval,
      readinessSummary,
      latestPack
    );
    const rejectionNote = dto.rejectionNote.trim();
    const decisionDriftCapturedAt = new Date();

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
            blockerSnapshot: rejectedGate as unknown as Prisma.InputJsonValue,
            decisionDriftSnapshot:
              launchClosureDrift as unknown as Prisma.InputJsonValue,
            decisionDriftCapturedAt
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
              gate: rejectedGate,
              launchClosureDrift,
              decisionDriftCapturedAt: decisionDriftCapturedAt.toISOString()
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

    const [currentSummary, latestPack] =
      approval.status === ReleaseReadinessApprovalStatus.pending_approval
        ? await Promise.all([
            this.getSummary({
              releaseIdentifier: approval.releaseIdentifier,
              environment: approval.environment
            }),
            this.getLatestLaunchClosurePackForScope(
              approval.releaseIdentifier,
              approval.environment
            )
          ])
        : [undefined, null];

    return {
      approval: this.mapApprovalProjection(approval, currentSummary, latestPack)
    };
  }

  async listApprovals(
    query: ListReleaseReadinessApprovalsDto
  ): Promise<ReleaseReadinessApprovalList> {
    const limit = query.limit ?? 10;
    const where = this.buildApprovalWhere(query);

    const [approvals, totalCount] = await Promise.all([
      this.prismaService.releaseReadinessApproval.findMany({
        where,
        orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }],
        take: limit
      }),
      this.prismaService.releaseReadinessApproval.count({
        where
      })
    ]);

    const pendingApprovalScopeKeys = [
      ...new Set(
        approvals
          .filter(
            (approval) =>
              approval.status === ReleaseReadinessApprovalStatus.pending_approval
          )
          .map(
            (approval) =>
              `${approval.releaseIdentifier}:${approval.environment}`
          )
      )
    ];
    const currentSummaries = new Map<string, ReleaseReadinessSummary>();
    const latestPacks = new Map<string, ReleaseLaunchClosurePackRecord | null>();

    await Promise.all(
      pendingApprovalScopeKeys.map(async (scopeKey) => {
        const matchingApproval = approvals.find(
          (approval) =>
            approval.status === ReleaseReadinessApprovalStatus.pending_approval &&
            `${approval.releaseIdentifier}:${approval.environment}` === scopeKey
        );

        if (!matchingApproval) {
          return;
        }

        const [summary, latestPack] = await Promise.all([
          this.getSummary({
            releaseIdentifier: matchingApproval.releaseIdentifier,
            environment: matchingApproval.environment
          }),
          this.getLatestLaunchClosurePackForScope(
            matchingApproval.releaseIdentifier,
            matchingApproval.environment
          )
        ]);
        currentSummaries.set(scopeKey, summary);
        latestPacks.set(scopeKey, latestPack);
      })
    );

    return {
      approvals: approvals.map((record) =>
        this.mapApprovalProjection(
          record,
          record.status === ReleaseReadinessApprovalStatus.pending_approval
            ? currentSummaries.get(
                `${record.releaseIdentifier}:${record.environment}`
              )
            : undefined,
          record.status === ReleaseReadinessApprovalStatus.pending_approval
            ? latestPacks.get(`${record.releaseIdentifier}:${record.environment}`) ??
              null
            : null
        )
      ),
      limit,
      totalCount
    };
  }
}
