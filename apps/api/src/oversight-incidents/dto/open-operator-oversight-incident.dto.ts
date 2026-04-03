import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

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
  note?: string;
}
