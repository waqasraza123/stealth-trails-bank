import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength
} from "class-validator";
import {
  OPERATOR_CASE_NOTE_CONTENT_PATTERN,
  OPERATOR_CASE_NOTE_MAX_LENGTH
} from "./operator-case-input.validation";

export class HandoffReviewCaseDto {
  @IsString()
  @IsNotEmpty()
  nextOperatorId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  note?: string;
}
