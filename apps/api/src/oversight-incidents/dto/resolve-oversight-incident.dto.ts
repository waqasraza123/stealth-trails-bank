import { IsOptional, IsString } from "class-validator";

export class ResolveOversightIncidentDto {
  @IsOptional()
  @IsString()
  note?: string;
}
