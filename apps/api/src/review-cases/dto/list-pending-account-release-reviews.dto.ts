import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ListPendingAccountReleaseReviewsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

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
  requestedByOperatorId?: string;

  @IsOptional()
  @IsString()
  assignedOperatorId?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
