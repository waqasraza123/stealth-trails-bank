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
import { OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH } from "../../review-cases/dto/operator-case-input.validation";
import {
  INCIDENT_PACKAGE_EXPORT_SINCE_DAYS_MAX,
  INCIDENT_PACKAGE_RECENT_LIMIT_MAX,
  INCIDENT_PACKAGE_TIMELINE_LIMIT_MAX
} from "./customer-account-incident-package-input.validation";

export const incidentPackageExportModes = [
  "internal_full",
  "redaction_ready",
  "compliance_focused"
] as const;

export type IncidentPackageExportMode =
  (typeof incidentPackageExportModes)[number];

export class GetCustomerAccountComplianceExportDto {
  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  supabaseUserId?: string;

  @IsOptional()
  @IsIn(incidentPackageExportModes)
  mode?: IncidentPackageExportMode;

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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INCIDENT_PACKAGE_EXPORT_SINCE_DAYS_MAX)
  sinceDays?: number;
}
