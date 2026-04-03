import { IsOptional, IsString } from "class-validator";

export class StartOversightIncidentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
