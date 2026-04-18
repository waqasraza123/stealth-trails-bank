import { IsOptional, IsString, MaxLength } from "class-validator";

export class DispatchGovernedExecutionRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  dispatchReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  dispatchNote?: string;
}
