import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import {
  OPERATOR_CASE_NOTE_CONTENT_PATTERN,
  OPERATOR_CASE_NOTE_MAX_LENGTH
} from "../../review-cases/dto/operator-case-input.validation";

export class ApproveCustomerAccountIncidentPackageReleaseDto {
  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  approvalNote?: string;
}
