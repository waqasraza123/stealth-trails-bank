import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import {
  TRANSACTION_INTENT_NOTE_MAX_LENGTH,
  TRANSACTION_INTENT_TX_HASH_PATTERN,
  TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
} from "./transaction-intent-execution.validation";

export class ConfirmDepositIntentDto {
  @IsOptional()
  @IsString()
  @Matches(TRANSACTION_INTENT_TX_HASH_PATTERN, {
    message: TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
  })
  readonly txHash?: string;

  @IsOptional()
  @IsString()
  @MaxLength(TRANSACTION_INTENT_NOTE_MAX_LENGTH)
  readonly note?: string;
}
