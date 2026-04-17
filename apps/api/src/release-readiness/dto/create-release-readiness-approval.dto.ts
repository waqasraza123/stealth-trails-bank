import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from "class-validator";
import { OPERATOR_CASE_NOTE_CONTENT_PATTERN } from "../../review-cases/dto/operator-case-input.validation";
import { releaseReadinessEnvironments } from "./create-release-readiness-evidence.dto";
import {
  RELEASE_READINESS_IDENTIFIER_MAX_LENGTH,
  RELEASE_READINESS_NOTE_MAX_LENGTH,
  RELEASE_READINESS_OPEN_BLOCKER_MAX_LENGTH,
  RELEASE_READINESS_SUMMARY_MAX_LENGTH
} from "./release-readiness-input.validation";

export class CreateReleaseReadinessApprovalDto {
  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  releaseIdentifier!: string;

  @IsIn(releaseReadinessEnvironments)
  environment!: (typeof releaseReadinessEnvironments)[number];

  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  launchClosurePackId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_IDENTIFIER_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  rollbackReleaseIdentifier?: string;

  @IsString()
  @MaxLength(RELEASE_READINESS_SUMMARY_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  requestNote?: string;

  @IsBoolean()
  securityConfigurationComplete!: boolean;

  @IsBoolean()
  accessAndGovernanceComplete!: boolean;

  @IsBoolean()
  dataAndRecoveryComplete!: boolean;

  @IsBoolean()
  platformHealthComplete!: boolean;

  @IsBoolean()
  functionalProofComplete!: boolean;

  @IsBoolean()
  contractAndChainProofComplete!: boolean;

  @IsBoolean()
  finalSignoffComplete!: boolean;

  @IsBoolean()
  unresolvedRisksAccepted!: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(25)
  @IsString({ each: true })
  @MaxLength(RELEASE_READINESS_OPEN_BLOCKER_MAX_LENGTH, { each: true })
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN, { each: true })
  openBlockers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(RELEASE_READINESS_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  residualRiskNote?: string;
}
