import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class GetOversightIncidentWorkspaceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  recentLimit?: number;
}
