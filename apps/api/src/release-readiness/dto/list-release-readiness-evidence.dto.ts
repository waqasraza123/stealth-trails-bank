import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";
import {
  releaseReadinessEnvironments,
  releaseReadinessEvidenceStatuses,
  releaseReadinessEvidenceTypes
} from "./create-release-readiness-evidence.dto";

export class ListReleaseReadinessEvidenceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  sinceDays?: number;

  @IsOptional()
  @IsIn(releaseReadinessEvidenceTypes)
  evidenceType?: (typeof releaseReadinessEvidenceTypes)[number];

  @IsOptional()
  @IsIn(releaseReadinessEnvironments)
  environment?: (typeof releaseReadinessEnvironments)[number];

  @IsOptional()
  @IsIn(releaseReadinessEvidenceStatuses)
  status?: (typeof releaseReadinessEvidenceStatuses)[number];
}
