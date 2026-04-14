import { ReleaseReadinessEvidenceType } from "@prisma/client";
import {
  describeReleaseReadinessEvidenceMetadataRequirements,
  listReleaseReadinessEvidenceMetadataRequirements,
  validateReleaseReadinessEvidenceMetadata
} from "./release-readiness-evidence-requirements";

describe("release-readiness-evidence-requirements", () => {
  it("requires launch candidate metadata for external-only proofs", () => {
    expect(
      listReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.secret_handling_review
      )
    ).toEqual(["releaseIdentifier"]);
    expect(
      describeReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.secret_handling_review
      )
    ).toEqual(["release identifier"]);
  });

  it("requires rollback metadata for rollback drill evidence", () => {
    expect(
      listReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.api_rollback_drill
      )
    ).toEqual(["releaseIdentifier", "rollbackReleaseIdentifier"]);
  });

  it("requires backup metadata for restore drill evidence", () => {
    expect(
      listReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.database_restore_drill
      )
    ).toEqual(["releaseIdentifier", "backupReference"]);
  });

  it("allows repo-owned automated proofs without release metadata", () => {
    expect(
      listReleaseReadinessEvidenceMetadataRequirements(
        ReleaseReadinessEvidenceType.backend_integration_suite
      )
    ).toEqual([]);
    expect(
      validateReleaseReadinessEvidenceMetadata({
        evidenceType: ReleaseReadinessEvidenceType.backend_integration_suite
      })
    ).toEqual([]);
  });

  it("reports each missing required field", () => {
    expect(
      validateReleaseReadinessEvidenceMetadata({
        evidenceType: ReleaseReadinessEvidenceType.worker_rollback_drill,
        releaseIdentifier: "launch-2026.04.14.1"
      })
    ).toEqual(["rollbackReleaseIdentifier"]);
  });
});
