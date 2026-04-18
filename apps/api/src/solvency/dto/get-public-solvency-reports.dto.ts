import { Transform } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class GetPublicSolvencyReportsDto {
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === "" ? undefined : Number(value)
  )
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
