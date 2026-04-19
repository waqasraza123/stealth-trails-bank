import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ApproveCustomerMfaRecoveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class RejectCustomerMfaRecoveryDto {
  @IsString()
  @MinLength(1, { message: "Rejection note is required." })
  @MaxLength(2000)
  note: string = "";
}

export class ExecuteCustomerMfaRecoveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
