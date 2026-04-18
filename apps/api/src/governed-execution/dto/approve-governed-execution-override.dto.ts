import { IsOptional, IsString } from "class-validator";

export class ApproveGovernedExecutionOverrideDto {
  @IsOptional()
  @IsString()
  readonly approvalNote?: string;
}
