import { IsOptional, IsString, MaxLength } from "class-validator";

export class SettleConfirmedDepositIntentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}
