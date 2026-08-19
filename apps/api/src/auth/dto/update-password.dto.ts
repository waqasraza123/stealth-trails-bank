import { IsString, MaxLength, MinLength } from "class-validator";

export class UpdatePasswordDto {
  @IsString()
  @MinLength(1, { message: "Current password is required." })
  currentPassword: string = "";

  @IsString()
  @MinLength(15, { message: "New password must be at least 15 characters long." })
  @MaxLength(128, { message: "New password must be no more than 128 characters long." })
  newPassword: string = "";
}
