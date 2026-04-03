import { IsOptional, IsString } from "class-validator";

export class DismissOversightIncidentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
