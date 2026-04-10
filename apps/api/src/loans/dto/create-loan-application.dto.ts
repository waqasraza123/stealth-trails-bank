import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { PreviewLoanQuoteDto } from "./preview-loan-quote.dto";

export class CreateLoanApplicationDto extends PreviewLoanQuoteDto {
  @IsString()
  @MaxLength(2_000)
  disclosureAcknowledgement!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  supportNote?: string;

  @IsOptional()
  @IsBoolean()
  acceptServiceFeeDisclosure?: boolean;
}
