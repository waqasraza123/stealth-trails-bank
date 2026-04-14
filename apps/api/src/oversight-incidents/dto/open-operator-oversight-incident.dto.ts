import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min
} from "class-validator";
import {
  OPERATOR_CASE_NOTE_CONTENT_PATTERN,
  OPERATOR_CASE_NOTE_MAX_LENGTH
} from "../../review-cases/dto/operator-case-input.validation";

export class OpenOperatorOversightIncidentDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  sinceDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(1000)
  threshold?: number;

  @IsOptional()
  @IsString()
  @MaxLength(OPERATOR_CASE_NOTE_MAX_LENGTH)
  @Matches(OPERATOR_CASE_NOTE_CONTENT_PATTERN)
  note?: string;
}
