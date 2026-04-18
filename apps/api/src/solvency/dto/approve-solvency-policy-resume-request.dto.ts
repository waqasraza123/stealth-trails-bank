import { IsOptional, IsString } from "class-validator";

export class ApproveSolvencyPolicyResumeRequestDto {
  @IsOptional()
  @IsString()
  approvalNote?: string;
}
