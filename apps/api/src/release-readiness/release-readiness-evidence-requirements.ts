import { ReleaseReadinessEvidenceType } from "@prisma/client";
import { externalOnlyReleaseReadinessChecks } from "./release-readiness-checks";

export type ReleaseReadinessEvidenceMetadataField =
  | "releaseIdentifier"
  | "rollbackReleaseIdentifier"
  | "backupReference";

type ReleaseReadinessEvidenceMetadataInput = {
  evidenceType: ReleaseReadinessEvidenceType;
  releaseIdentifier?: string | null;
  rollbackReleaseIdentifier?: string | null;
  backupReference?: string | null;
};

const releaseIdentifierRequiredEvidenceTypes = new Set<ReleaseReadinessEvidenceType>(
  externalOnlyReleaseReadinessChecks.map((check) => check.evidenceType)
);

const rollbackReleaseIdentifierRequiredEvidenceTypes = new Set<
  ReleaseReadinessEvidenceType
>([
  ReleaseReadinessEvidenceType.api_rollback_drill,
  ReleaseReadinessEvidenceType.worker_rollback_drill
]);

const backupReferenceRequiredEvidenceTypes = new Set<ReleaseReadinessEvidenceType>([
  ReleaseReadinessEvidenceType.database_restore_drill
]);

const metadataFieldLabels: Record<ReleaseReadinessEvidenceMetadataField, string> = {
  releaseIdentifier: "release identifier",
  rollbackReleaseIdentifier: "rollback release identifier",
  backupReference: "backup reference"
};

export function listReleaseReadinessEvidenceMetadataRequirements(
  evidenceType: ReleaseReadinessEvidenceType
): ReleaseReadinessEvidenceMetadataField[] {
  const requirements: ReleaseReadinessEvidenceMetadataField[] = [];

  if (releaseIdentifierRequiredEvidenceTypes.has(evidenceType)) {
    requirements.push("releaseIdentifier");
  }

  if (rollbackReleaseIdentifierRequiredEvidenceTypes.has(evidenceType)) {
    requirements.push("rollbackReleaseIdentifier");
  }

  if (backupReferenceRequiredEvidenceTypes.has(evidenceType)) {
    requirements.push("backupReference");
  }

  return requirements;
}

export function describeReleaseReadinessEvidenceMetadataRequirements(
  evidenceType: ReleaseReadinessEvidenceType
): string[] {
  return listReleaseReadinessEvidenceMetadataRequirements(evidenceType).map(
    (field) => metadataFieldLabels[field]
  );
}

export function validateReleaseReadinessEvidenceMetadata(
  input: ReleaseReadinessEvidenceMetadataInput
): ReleaseReadinessEvidenceMetadataField[] {
  const missingFields: ReleaseReadinessEvidenceMetadataField[] = [];

  for (const field of listReleaseReadinessEvidenceMetadataRequirements(
    input.evidenceType
  )) {
    const value = input[field];

    if (typeof value !== "string" || value.trim().length === 0) {
      missingFields.push(field);
    }
  }

  return missingFields;
}
