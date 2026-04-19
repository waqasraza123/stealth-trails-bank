import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class ExecuteLedgerReplayApprovalDto {
  @IsString()
  @IsIn(["deposit", "withdrawal"])
  readonly intentType!: "deposit" | "withdrawal";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}
