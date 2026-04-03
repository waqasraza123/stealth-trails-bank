import { IsOptional, IsString } from "class-validator";

export class RequestAccountReleaseDto {
  @IsOptional()
  @IsString()
  note?: string;
}
