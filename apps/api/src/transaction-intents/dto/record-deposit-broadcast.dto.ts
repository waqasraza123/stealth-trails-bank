import { IsOptional, IsString, Matches } from "class-validator";
import {
  TRANSACTION_INTENT_EVM_ADDRESS_PATTERN,
  TRANSACTION_INTENT_TX_HASH_PATTERN,
  TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
} from "./transaction-intent-execution.validation";

export class RecordDepositBroadcastDto {
  @IsString()
  @Matches(TRANSACTION_INTENT_TX_HASH_PATTERN, {
    message: TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
  })
  readonly txHash!: string;

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
