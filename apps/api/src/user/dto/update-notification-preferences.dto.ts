import { IsBoolean } from "class-validator";

export class UpdateNotificationPreferencesDto {
  @IsBoolean()
  depositEmails: boolean = true;

  @IsBoolean()
  withdrawalEmails: boolean = true;

  @IsBoolean()
  loanEmails: boolean = true;

  @IsBoolean()
  productUpdateEmails: boolean = false;
}
