import { IsOptional, IsString } from "class-validator";

export class RejectSolvencyPolicyResumeRequestDto {
  @IsOptional()
  @IsString()
  rejectionNote?: string;
}
