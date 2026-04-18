import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class RecordGovernedExecutorExecutionSuccessDto {
  @IsString()
  dispatchReference!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  transactionChainId!: number;

  @IsString()
  transactionToAddress!: string;

  @IsString()
  blockchainTransactionHash!: string;

  @IsOptional()
  @IsString()
  executionNote?: string;

  @IsOptional()
  @IsString()
  externalExecutionReference?: string;

  @IsOptional()
  @IsString()
  contractLoanId?: string;

  @IsOptional()
  @IsString()
  contractAddress?: string;

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
