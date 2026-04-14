import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { OPERATOR_CASE_NOTE_CONTENT_PATTERN } from "../../review-cases/dto/operator-case-input.validation";
import {
  releaseReadinessEnvironments,
  releaseReadinessEvidenceStatuses,
  releaseReadinessEvidenceTypes
} from "./create-release-readiness-evidence.dto";
import {
  RELEASE_READINESS_IDENTIFIER_MAX_LENGTH,
  RELEASE_READINESS_LIST_LIMIT_MAX,
  RELEASE_READINESS_SINCE_DAYS_MAX
} from "./release-readiness-input.validation";

export class ListReleaseReadinessEvidenceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RELEASE_READINESS_LIST_LIMIT_MAX)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RELEASE_READINESS_SINCE_DAYS_MAX)
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

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  releaseIdentifier?: string;
}
