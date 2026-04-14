import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from "class-validator";
import {
  OPERATOR_CASE_NOTE_CONTENT_PATTERN,
  OPERATOR_CASE_NOTE_MAX_LENGTH,
  OPERATOR_CASE_REASON_CODE_PATTERN
} from "../../review-cases/dto/operator-case-input.validation";
import { OPERATOR_LOAN_REASON_CODE_MAX_LENGTH } from "./operator-loan-input.validation";

export class OperatorLoanActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  note?: string;

  @IsOptional()
  @IsBoolean()
  policyOverride?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_LOAN_REASON_CODE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_REASON_CODE_PATTERN)
  reasonCode?: string;
}
