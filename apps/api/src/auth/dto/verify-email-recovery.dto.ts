import { IsString, Matches, MinLength } from "class-validator";

export class VerifyEmailRecoveryDto {
  @IsString()
  @MinLength(1, { message: "Challenge id is required." })
  challengeId: string = "";

  @IsString()
  @Matches(/^\d{6}$/u, {
    message: "Verification code must be a 6-digit number.",
  })
  code: string = "";
}
