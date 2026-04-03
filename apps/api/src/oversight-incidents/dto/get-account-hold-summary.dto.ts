import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class GetAccountHoldSummaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  sinceDays?: number;

  @IsOptional()
  @IsIn([
    "customer_manual_resolution_spike",
    "operator_manual_resolution_spike"
  ])
  incidentType?:
    | "customer_manual_resolution_spike"
    | "operator_manual_resolution_spike";

  @IsOptional()
  @IsString()
  restrictionReasonCode?: string;

  @IsOptional()
  @IsString()
  appliedByOperatorId?: string;

  @IsOptional()
  @IsString()
  releasedByOperatorId?: string;

  @IsOptional()
  @IsIn(["not_requested", "pending", "approved", "denied"])
  releaseDecisionStatus?: "not_requested" | "pending" | "approved" | "denied";
}
