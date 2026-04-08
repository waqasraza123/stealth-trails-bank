import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { releaseReadinessEnvironments } from "./create-release-readiness-evidence.dto";
import { releaseReadinessApprovalStatuses } from "./release-readiness-approval.dto";

export class ListReleaseReadinessApprovalsDto {
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
  @IsIn(releaseReadinessApprovalStatuses)
  status?: (typeof releaseReadinessApprovalStatuses)[number];

  @IsOptional()
  @IsIn(releaseReadinessEnvironments)
  environment?: (typeof releaseReadinessEnvironments)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  releaseIdentifier?: string;
}
