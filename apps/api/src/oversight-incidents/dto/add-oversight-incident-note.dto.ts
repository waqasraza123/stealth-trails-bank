import { IsNotEmpty, IsString } from "class-validator";

export class AddOversightIncidentNoteDto {
  @IsString()
  @IsNotEmpty()
  note!: string;
}
