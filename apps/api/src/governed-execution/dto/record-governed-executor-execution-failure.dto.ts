import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class RecordGovernedExecutorExecutionFailureDto {
  @IsString()
  dispatchReference!: string;

  @IsString()
  failureReason!: string;

  @IsOptional()
  @IsString()
  executionNote?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transactionChainId?: number;

  @IsOptional()
  @IsString()
  transactionToAddress?: string;

  @IsOptional()
  @IsString()
  blockchainTransactionHash?: string;

  @IsOptional()
  @IsString()
  externalExecutionReference?: string;

  @IsString()
  notedAt!: string;

  @IsString()
  canonicalReceiptText!: string;

  @IsString()
  receiptHash!: string;

  @IsString()
  receiptChecksumSha256!: string;

  @IsString()
  receiptSignature!: string;

  @IsString()
  receiptSignerAddress!: string;

  @IsString()
  receiptSignatureAlgorithm!: string;
}
