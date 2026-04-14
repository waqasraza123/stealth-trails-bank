import { IsNotEmpty, IsString, Matches, MaxLength } from "class-validator";
import {
  OPERATOR_CASE_NOTE_CONTENT_PATTERN,
  OPERATOR_CASE_NOTE_MAX_LENGTH
} from "./operator-case-input.validation";

export class AddReviewCaseNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(OPERATOR_CASE_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  note!: string;
}
