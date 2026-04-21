import { Type } from "class-transformer";
import {
  RetirementVaultReleaseRequestStatus,
  RetirementVaultRuleChangeRequestStatus,
  RetirementVaultStatus,
} from "@prisma/client";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListInternalRetirementVaultsDto {
  @IsOptional()
  @IsEnum(RetirementVaultStatus)
  readonly status?: RetirementVaultStatus;

  @IsOptional()
  @IsEnum(RetirementVaultReleaseRequestStatus)
  readonly releaseRequestStatus?: RetirementVaultReleaseRequestStatus;

  @IsOptional()
  @IsEnum(RetirementVaultRuleChangeRequestStatus)
  readonly ruleChangeRequestStatus?: RetirementVaultRuleChangeRequestStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly limit?: number;
}
