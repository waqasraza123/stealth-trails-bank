import { IsOptional, IsString, MaxLength } from "class-validator";
import { TRANSACTION_INTENT_NOTE_MAX_LENGTH } from "./transaction-intent-execution.validation";

export class SettleConfirmedDepositIntentDto {
  @IsOptional()
  @IsString()
  @MaxLength(TRANSACTION_INTENT_NOTE_MAX_LENGTH)
  readonly note?: string;
}
