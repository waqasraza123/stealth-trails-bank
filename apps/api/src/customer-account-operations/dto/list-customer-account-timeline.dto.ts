import { Type } from "class-transformer";
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class ListCustomerAccountTimelineDto {
  @IsOptional()
  @IsString()
  customerAccountId?: string;

  @IsOptional()
  @IsString()
  supabaseUserId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
