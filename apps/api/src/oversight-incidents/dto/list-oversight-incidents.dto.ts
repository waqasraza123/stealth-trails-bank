import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ListOversightIncidentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["open", "in_progress", "resolved", "dismissed"])
  status?: "open" | "in_progress" | "resolved" | "dismissed";

  @IsOptional()
  @IsIn(["customer_manual_resolution_spike", "operator_manual_resolution_spike"])
  incidentType?:
    | "customer_manual_resolution_spike"
    | "operator_manual_resolution_spike";

  @IsOptional()
  @IsString()
  assignedOperatorId?: string;

  @IsOptional()
  @IsString()
  subjectCustomerAccountId?: string;

  @IsOptional()
  @IsString()
  subjectOperatorId?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  reasonCode?: string;
}
