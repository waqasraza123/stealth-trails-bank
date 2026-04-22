import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ArchiveNotificationsDto } from "./dto/archive-notifications.dto";
import { ListNotificationsDto } from "./dto/list-notifications.dto";
import { MarkNotificationsReadDto } from "./dto/mark-notifications-read.dto";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";
import { NotificationsService } from "./notifications.service";

@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("me")
  async listMyNotifications(
    @Query(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    query: ListNotificationsDto,
    @Request() request: { user: { id: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.listCustomerNotifications(
      request.user.id,
      query,
    );

    return {
      status: "success",
      message: "Notifications retrieved successfully.",
      data: result,
    };
  }

  @Get("me/unread-count")
  async getUnreadCount(
    @Request() request: { user: { id: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.getCustomerUnreadSummary(
      request.user.id,
    );

    return {
      status: "success",
      message: "Notification unread summary retrieved successfully.",
      data: result,
    };
  }

  @Post("me/mark-read")
  async markRead(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: MarkNotificationsReadDto,
    @Request() request: { user: { id: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.markCustomerNotificationsRead(
      request.user.id,
      dto.ids,
    );

    return {
      status: "success",
      message: "Notifications marked as read successfully.",
      data: result,
    };
  }

  @Post("me/mark-all-read")
  async markAllRead(
    @Request() request: { user: { id: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.markAllCustomerNotificationsRead(
      request.user.id,
    );

    return {
      status: "success",
      message: "All notifications marked as read successfully.",
      data: result,
    };
  }

  @Post("me/archive")
  async archive(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ArchiveNotificationsDto,
    @Request() request: { user: { id: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.archiveCustomerNotifications(
      request.user.id,
      dto.ids,
    );

    return {
      status: "success",
      message: "Notifications archived successfully.",
      data: result,
    };
  }

  @Get("me/preferences")
  async getPreferences(
    @Request() request: { user: { id: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.getCustomerPreferences(
      request.user.id,
    );

    return {
      status: "success",
      message: "Notification preferences retrieved successfully.",
      data: {
        notificationPreferences: result,
      },
    };
  }

  @Patch("me/preferences")
  async updatePreferences(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateNotificationPreferencesDto,
    @Request() request: { user: { id: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.updateCustomerPreferences(
      request.user.id,
      {
        audience: "customer",
        entries: dto.entries.map((entry) => ({
          category: entry.category,
          channels: entry.channels.map((channel) => ({
            channel: channel.channel,
            enabled: channel.enabled,
            mandatory: channel.mandatory ?? false,
          })),
        })),
        updatedAt: null,
      },
    );

    return {
      status: "success",
      message: "Notification preferences updated successfully.",
      data: {
        notificationPreferences: result,
      },
    };
  }
}
