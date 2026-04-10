import { IsBoolean, IsIn, IsNumberString, IsOptional, IsString, Matches } from "class-validator";

const SUPPORTED_JURISDICTIONS = ["saudi_arabia", "uae", "usa"] as const;
const SUPPORTED_ASSETS = ["ETH", "USDC"] as const;

export class PreviewLoanQuoteDto {
  @IsIn(SUPPORTED_JURISDICTIONS)
  jurisdiction!: (typeof SUPPORTED_JURISDICTIONS)[number];

  @IsIn(SUPPORTED_ASSETS)
  borrowAssetSymbol!: (typeof SUPPORTED_ASSETS)[number];

  @IsIn(SUPPORTED_ASSETS)
  collateralAssetSymbol!: (typeof SUPPORTED_ASSETS)[number];

  @IsNumberString()
  borrowAmount!: string;

  @IsNumberString()
  collateralAmount!: string;

  @IsNumberString()
  @Matches(/^\d+$/)
  termMonths!: string;

  @IsOptional()
  @IsBoolean()
  autopayEnabled?: boolean;

  @IsOptional()
  @IsString()
  requestedByCustomerLocale?: string;
}
