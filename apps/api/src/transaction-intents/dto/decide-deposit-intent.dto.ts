import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf
} from "class-validator";

export class DecideDepositIntentDto {
  @IsString()
  @IsIn(["approved", "denied"])
  readonly decision!: "approved" | "denied";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;

  @ValidateIf((value: DecideDepositIntentDto) => value.decision === "denied")
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  readonly denialReason?: string;
}
