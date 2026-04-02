import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListMyTransactionHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["deposit", "withdrawal"])
  intentType?: "deposit" | "withdrawal";

  @IsOptional()
  @IsIn([
    "requested",
    "review_required",
    "approved",
    "queued",
    "broadcast",
    "confirmed",
    "settled",
    "failed",
    "cancelled",
    "manually_resolved"
  ])
  status?:
    | "requested"
    | "review_required"
    | "approved"
    | "queued"
    | "broadcast"
    | "confirmed"
    | "settled"
    | "failed"
    | "cancelled"
    | "manually_resolved";

  @IsOptional()
  @IsString()
  assetSymbol?: string;
}
