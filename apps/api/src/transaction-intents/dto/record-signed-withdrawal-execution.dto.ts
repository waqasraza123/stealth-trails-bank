import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min
} from "class-validator";
import { Type } from "class-transformer";
import {
  TRANSACTION_INTENT_EVM_ADDRESS_PATTERN,
  TRANSACTION_INTENT_SERIALIZED_TRANSACTION_PATTERN,
  TRANSACTION_INTENT_SERIALIZED_TRANSACTION_PATTERN_MESSAGE,
  TRANSACTION_INTENT_TX_HASH_PATTERN,
  TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
} from "./transaction-intent-execution.validation";

export class RecordSignedWithdrawalExecutionDto {
  @IsString()
  @Matches(TRANSACTION_INTENT_TX_HASH_PATTERN, {
    message: TRANSACTION_INTENT_TX_HASH_PATTERN_MESSAGE
  })
  readonly txHash!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly nonce!: number;

  @IsString()
  @Matches(TRANSACTION_INTENT_SERIALIZED_TRANSACTION_PATTERN, {
    message: TRANSACTION_INTENT_SERIALIZED_TRANSACTION_PATTERN_MESSAGE
  })
  readonly serializedTransaction!: string;

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
