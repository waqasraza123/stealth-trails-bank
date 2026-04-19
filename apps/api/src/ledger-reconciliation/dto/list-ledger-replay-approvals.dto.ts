import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListLedgerReplayApprovalsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["pending_approval", "approved", "rejected", "executed"])
  status?: "pending_approval" | "approved" | "rejected" | "executed";

  @IsOptional()
  @IsIn(["deposit", "withdrawal"])
  intentType?: "deposit" | "withdrawal";
}
