import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import {
  notificationCategories,
  supportedNotificationChannels,
} from "../notification-preferences.util";

class UpdateNotificationChannelPreferenceDto {
  @IsEnum(supportedNotificationChannels)
  channel: (typeof supportedNotificationChannels)[number] = "in_app";

  @IsBoolean()
  enabled: boolean = true;

  @IsOptional()
  @IsBoolean()
  mandatory?: boolean;
}

class UpdateNotificationPreferenceEntryDto {
  @IsEnum(notificationCategories)
  category: (typeof notificationCategories)[number] = "security";

  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => UpdateNotificationChannelPreferenceDto)
  channels: UpdateNotificationChannelPreferenceDto[] = [];
}

export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsString()
  audience?: "customer" | "operator";

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateNotificationPreferenceEntryDto)
  entries: UpdateNotificationPreferenceEntryDto[] = [];
}
