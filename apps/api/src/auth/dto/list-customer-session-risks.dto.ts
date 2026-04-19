import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class ListCustomerSessionRisksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsIn(["web", "mobile", "unknown"], {
    message:
      "Customer session risk platform must be web, mobile, or unknown.",
  })
  clientPlatform?: "web" | "mobile" | "unknown";

  @IsOptional()
  @IsIn(["not_started", "pending", "expired"], {
    message:
      "Customer session risk challenge state must be not_started, pending, or expired.",
  })
  challengeState?: "not_started" | "pending" | "expired";
}
