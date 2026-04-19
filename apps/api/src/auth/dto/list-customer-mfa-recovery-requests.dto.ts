import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListCustomerMfaRecoveryRequestsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["pending_approval", "approved", "executed", "rejected"], {
    message:
      "Customer MFA recovery request status must be pending_approval, approved, executed, or rejected.",
  })
  status?: "pending_approval" | "approved" | "executed" | "rejected";

  @IsOptional()
  @IsIn(["release_lockout", "reset_mfa"], {
    message:
      "Customer MFA recovery request type must be release_lockout or reset_mfa.",
  })
  requestType?: "release_lockout" | "reset_mfa";
}
