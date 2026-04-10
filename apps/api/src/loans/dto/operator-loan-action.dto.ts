import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class OperatorLoanActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  policyOverride?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  reasonCode?: string;
}
