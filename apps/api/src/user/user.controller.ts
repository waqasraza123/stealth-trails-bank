import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
  ValidationPipe
} from "@nestjs/common";
import type { CustomerNotificationPreferences } from "@stealth-trails-bank/types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";
import { UserService } from "./user.service";

@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get(":id")
  async getUserById(
    @Param("id") id: string,
    @Req() req: { user: { id: string } }
  ): Promise<CustomJsonResponse> {
    const authenticatedUser = req.user;

    if (authenticatedUser.id !== id) {
      throw new UnauthorizedException(
        "You are not authorized to access this user"
      );
    }

    const user = await this.userService.getUserById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return {
      status: "success",
      message: "User retreived.",
      data: user
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/notification-preferences")
  async updateNotificationPreferences(
    @Param("id") id: string,
    @Body(new ValidationPipe()) dto: UpdateNotificationPreferencesDto,
    @Req() req: { user: { id: string } }
  ): Promise<
    CustomJsonResponse<{ notificationPreferences: CustomerNotificationPreferences }>
  > {
    const authenticatedUser = req.user;

    if (authenticatedUser.id !== id) {
      throw new UnauthorizedException(
        "You are not authorized to update this user"
      );
    }

    const notificationPreferences =
      await this.userService.updateNotificationPreferences(id, {
        depositEmails: dto.depositEmails,
        withdrawalEmails: dto.withdrawalEmails,
        loanEmails: dto.loanEmails,
        productUpdateEmails: dto.productUpdateEmails
      });

    return {
      status: "success",
      message: "Notification preferences updated successfully.",
      data: {
        notificationPreferences
      }
    };
  }
}
