import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from "class-validator";
import { OPERATOR_CASE_NOTE_CONTENT_PATTERN } from "../../review-cases/dto/operator-case-input.validation";
import { releaseReadinessEnvironments } from "./create-release-readiness-evidence.dto";
import { RELEASE_READINESS_IDENTIFIER_MAX_LENGTH } from "./release-readiness-input.validation";

export class GetReleaseReadinessSummaryDto {
  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  releaseIdentifier?: string;

  @IsOptional()
  @IsIn(releaseReadinessEnvironments)
  environment?: (typeof releaseReadinessEnvironments)[number];
}
