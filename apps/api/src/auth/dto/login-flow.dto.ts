import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class LoginFlowDto {
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  flowId: string = "";
}

export class VerifyLoginTotpDto extends LoginFlowDto {
  @IsString()
  @Matches(/^\d{6}$/u, { message: "Authenticator code must be exactly 6 digits." })
  code: string = "";
}

export class VerifyLoginRecoveryCodeDto extends LoginFlowDto {
  @IsString()
  @MinLength(10)
  @MaxLength(64)
  code: string = "";
}

export class UpgradeLoginPasswordDto extends LoginFlowDto {
  @IsString()
  @MinLength(15)
  @MaxLength(128)
  newPassword: string = "";
}
