import { ArrayMaxSize, ArrayMinSize, IsArray, IsString } from "class-validator";

export class MarkNotificationsReadDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  ids: string[] = [];
}
