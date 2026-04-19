import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ReviewLedgerReplayApprovalDto {
  @IsString()
  @IsIn(["deposit", "withdrawal"])
  readonly intentType!: "deposit" | "withdrawal";

  @IsString()
  @IsIn(["approve", "reject"])
  readonly decision!: "approve" | "reject";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}
