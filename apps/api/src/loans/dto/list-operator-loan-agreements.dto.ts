import { Transform } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

const AGREEMENT_STATUSES = [
  "awaiting_funding",
  "active",
  "grace_period",
  "delinquent",
  "defaulted",
  "liquidating",
  "closed"
] as const;

export class ListOperatorLoanAgreementsDto {
  @IsOptional()
  @Transform(({ value }) => (value ? Number(value) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(AGREEMENT_STATUSES)
  status?: (typeof AGREEMENT_STATUSES)[number];
}
