import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class RequestLedgerReconciliationReplayApprovalDto {
  @IsString()
  @IsIn(["confirm", "settle"])
  readonly replayAction!: "confirm" | "settle";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  readonly note?: string;
}
