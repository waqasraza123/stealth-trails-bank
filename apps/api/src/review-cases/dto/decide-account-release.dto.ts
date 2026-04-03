import { IsIn, IsOptional, IsString } from "class-validator";

export class DecideAccountReleaseDto {
  @IsIn(["approved", "denied"])
  decision!: "approved" | "denied";

  @IsOptional()
  @IsString()
  note?: string;
}
