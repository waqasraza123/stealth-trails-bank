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
import { INCIDENT_PACKAGE_RELEASE_REPORTING_LIMIT_MAX } from "./customer-account-incident-package-input.validation";
import {
  incidentPackageExportModes,
  type IncidentPackageExportMode
} from "./get-customer-account-compliance-export.dto";
import {
  incidentPackageReleaseTargets,
  type IncidentPackageReleaseTarget
} from "./create-customer-account-incident-package-release-request.dto";

export class ListPendingCustomerAccountIncidentPackageReleasesDto {
  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_FILTER_VALUE_MAX_LENGTH)
  requestedByOperatorId?: string;

  @IsOptional()
  @IsIn(incidentPackageExportModes)
  mode?: IncidentPackageExportMode;

  @IsOptional()
  @IsIn(incidentPackageReleaseTargets)
  releaseTarget?: IncidentPackageReleaseTarget;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INCIDENT_PACKAGE_RELEASE_REPORTING_LIMIT_MAX)
  limit?: number;
}
