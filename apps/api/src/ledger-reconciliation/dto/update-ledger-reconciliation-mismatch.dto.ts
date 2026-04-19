import { IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateLedgerReconciliationMismatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  approvalRequestId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
