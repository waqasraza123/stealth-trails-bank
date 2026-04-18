import { IsOptional, IsString } from "class-validator";

export class RejectGovernedExecutionOverrideDto {
  @IsOptional()
  @IsString()
  readonly rejectionNote?: string;
}
