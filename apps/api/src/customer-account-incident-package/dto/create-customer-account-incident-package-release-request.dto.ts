import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import {
  OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH,
  OPERATOR_CASE_NOTE_CONTENT_PATTERN,
  OPERATOR_CASE_NOTE_MAX_LENGTH,
  OPERATOR_CASE_REASON_CODE_MAX_LENGTH,
  OPERATOR_CASE_REASON_CODE_PATTERN
} from "../../review-cases/dto/operator-case-input.validation";
import {
  INCIDENT_PACKAGE_EXPORT_SINCE_DAYS_MAX,
  INCIDENT_PACKAGE_RECENT_LIMIT_MAX,
  INCIDENT_PACKAGE_TIMELINE_LIMIT_MAX
} from "./customer-account-incident-package-input.validation";
import {
  incidentPackageExportModes,
  type IncidentPackageExportMode
} from "./get-customer-account-compliance-export.dto";

export const incidentPackageReleaseTargets = [
  "internal_casefile",
  "compliance_handoff",
  "regulator_response",
  "external_counsel"
] as const;

export type IncidentPackageReleaseTarget =
  (typeof incidentPackageReleaseTargets)[number];

export class CreateCustomerAccountIncidentPackageReleaseRequestDto {
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

  @IsIn(incidentPackageReleaseTargets)
  releaseTarget!: IncidentPackageReleaseTarget;

  @IsString()
  @MaxLength(OPERATOR_CASE_REASON_CODE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_REASON_CODE_PATTERN)
  releaseReasonCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  requestNote?: string;

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
