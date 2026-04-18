import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class RequestSolvencyPolicyResumeDto {
  @IsString()
  @MinLength(1)
  snapshotId: string = "";

  @IsDateString()
  expectedPolicyUpdatedAt: string = "";

  @IsOptional()
  @IsString()
  requestNote?: string;
}
