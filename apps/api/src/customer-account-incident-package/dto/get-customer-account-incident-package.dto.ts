import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH } from "../../review-cases/dto/operator-case-input.validation";
import {
  INCIDENT_PACKAGE_RECENT_LIMIT_MAX,
  INCIDENT_PACKAGE_TIMELINE_LIMIT_MAX
} from "./customer-account-incident-package-input.validation";

export class GetCustomerAccountIncidentPackageDto {
  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  supabaseUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INCIDENT_PACKAGE_RECENT_LIMIT_MAX)
  recentLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INCIDENT_PACKAGE_TIMELINE_LIMIT_MAX)
  timelineLimit?: number;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
