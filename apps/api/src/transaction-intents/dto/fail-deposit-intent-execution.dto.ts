import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import {
  TRANSACTION_INTENT_EVM_ADDRESS_PATTERN,
  TRANSACTION_INTENT_FAILURE_CODE_MAX_LENGTH,
  TRANSACTION_INTENT_FAILURE_CODE_MIN_LENGTH,
  TRANSACTION_INTENT_FAILURE_REASON_MAX_LENGTH,
  TRANSACTION_INTENT_FAILURE_REASON_MIN_LENGTH,
  TRANSACTION_INTENT_TX_HASH_PATTERN,
  TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
} from "./transaction-intent-execution.validation";

export class FailDepositIntentExecutionDto {
  @IsString()
  @MinLength(TRANSACTION_INTENT_FAILURE_CODE_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_FAILURE_CODE_MAX_LENGTH)
  readonly failureCode!: string;

  @IsString()
  @MinLength(TRANSACTION_INTENT_FAILURE_REASON_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_FAILURE_REASON_MAX_LENGTH)
  readonly failureReason!: string;

  @IsOptional()
  @IsString()
  @Matches(TRANSACTION_INTENT_TX_HASH_PATTERN, {
    message: TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
  })
  readonly txHash?: string;

  @IsOptional()
  @IsString()
  @Matches(TRANSACTION_INTENT_EVM_ADDRESS_PATTERN, {
    message: "fromAddress must be a valid EVM address."
  })
  readonly fromAddress?: string;

  @IsOptional()
  @IsString()
  @Matches(TRANSACTION_INTENT_EVM_ADDRESS_PATTERN, {
    message: "toAddress must be a valid EVM address."
  })
  readonly toAddress?: string;
}
