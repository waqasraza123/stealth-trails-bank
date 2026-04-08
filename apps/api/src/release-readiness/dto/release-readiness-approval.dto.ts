import { IsOptional, IsString, MaxLength } from "class-validator";

export const releaseReadinessApprovalStatuses = [
  "pending_approval",
  "approved",
  "rejected"
] as const;

export class ApproveReleaseReadinessApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  approvalNote?: string;
}

export class RejectReleaseReadinessApprovalDto {
  @IsString()
  @MaxLength(4000)
  rejectionNote!: string;
}
