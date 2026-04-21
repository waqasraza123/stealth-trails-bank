import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import {
  TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH,
  TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH,
} from "../../transaction-intents/dto/transaction-intent-request.validation";

export class RequestRetirementVaultRuleChangeDto {
  @IsString()
  @MinLength(TRANSACTION_INTENT_ASSET_SYMBOL_MIN_LENGTH)
  @MaxLength(TRANSACTION_INTENT_ASSET_SYMBOL_MAX_LENGTH)
  readonly assetSymbol!: string;

  @IsOptional()
  @IsString()
  readonly unlockAt?: string;

  @IsOptional()
  @IsBoolean()
  readonly strictMode?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  readonly reasonCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly reasonNote?: string;
}
