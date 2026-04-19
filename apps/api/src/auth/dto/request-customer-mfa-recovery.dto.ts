import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class RequestCustomerMfaRecoveryDto {
  @IsString()
  @IsIn(["release_lockout", "reset_mfa"], {
    message:
      "Customer MFA recovery request type must be release_lockout or reset_mfa.",
  })
  requestType: "release_lockout" | "reset_mfa" = "release_lockout";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
