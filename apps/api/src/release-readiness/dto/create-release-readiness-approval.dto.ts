import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength
} from "class-validator";
import { releaseReadinessEnvironments } from "./create-release-readiness-evidence.dto";

export class CreateReleaseReadinessApprovalDto {
  @IsString()
  @MaxLength(200)
  releaseIdentifier!: string;

  @IsIn(releaseReadinessEnvironments)
  environment!: (typeof releaseReadinessEnvironments)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  rollbackReleaseIdentifier?: string;

  @IsString()
  @MaxLength(1000)
  summary!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
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
  @MaxLength(500, { each: true })
  openBlockers?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  residualRiskNote?: string;
}
