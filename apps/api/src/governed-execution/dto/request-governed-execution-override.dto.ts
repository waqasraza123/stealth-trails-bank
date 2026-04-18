import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from "class-validator";

export class RequestGovernedExecutionOverrideDto {
  @IsOptional()
  @IsBoolean()
  readonly allowUnsafeWithdrawalExecution?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly allowDirectLoanFunding?: boolean;

  @IsOptional()
  @IsBoolean()
  readonly allowDirectStakingWrites?: boolean;

  @IsString()
  readonly reasonCode!: string;

  @IsOptional()
  @IsString()
  readonly requestNote?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(72)
  readonly expiresInHours!: number;
}
