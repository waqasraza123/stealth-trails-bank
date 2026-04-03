import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min
} from "class-validator";

export class ListOversightAlertsDto {
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
  @Max(3650)
  sinceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(1000)
  customerThreshold?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(1000)
  operatorThreshold?: number;

  @IsOptional()
  @IsIn(["customer_manual_resolution_spike", "operator_manual_resolution_spike"])
  incidentType?:
    | "customer_manual_resolution_spike"
    | "operator_manual_resolution_spike";
}
