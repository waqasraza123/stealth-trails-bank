import { IsEmail, IsString, Matches, MaxLength } from "class-validator";

export class ResendEmailVerificationDto {
  @IsEmail()
  @MaxLength(254)
  email: string = "";
}

export class VerifyPrimaryEmailDto extends ResendEmailVerificationDto {
  @IsString()
  @Matches(/^\d{8}$/u, { message: "Verification code must be exactly 8 digits." })
  code: string = "";
}
