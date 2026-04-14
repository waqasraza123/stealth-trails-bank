import { Transform } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from "class-validator";
import { OPERATOR_LOAN_SEARCH_MAX_LENGTH } from "./operator-loan-input.validation";

const LOAN_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "awaiting_funding",
  "active",
  "grace_period",
  "delinquent",
  "defaulted",
  "liquidating",
  "closed"
] as const;

export class ListOperatorLoanApplicationsDto {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(LOAN_STATUSES)
  status?: (typeof LOAN_STATUSES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_LOAN_SEARCH_MAX_LENGTH)
  search?: string;
}
