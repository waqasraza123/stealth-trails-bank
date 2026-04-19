import { IsOptional, IsString, MaxLength } from "class-validator";

export class RevokeCustomerSessionRiskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
