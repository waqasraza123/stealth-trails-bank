import { IsOptional, IsString, Matches } from "class-validator";

export class ConfirmDepositIntentDto {
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: "txHash must be a valid 32-byte hex transaction hash."
  })
  readonly txHash?: string;
}
