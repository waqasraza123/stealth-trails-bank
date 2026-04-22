import { Type } from "class-transformer";
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { notificationCategories } from "../notification-preferences.util";

export class ListNotificationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsEnum(notificationCategories)
  category?: (typeof notificationCategories)[number];
}
