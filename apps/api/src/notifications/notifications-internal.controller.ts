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
import { InternalOperatorBearerGuard } from "../auth/guards/internal-operator-bearer.guard";
import { CustomJsonResponse } from "../types/CustomJsonResponse";
import { ArchiveNotificationsDto } from "./dto/archive-notifications.dto";
import { ListNotificationsDto } from "./dto/list-notifications.dto";
import { MarkNotificationsReadDto } from "./dto/mark-notifications-read.dto";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";
import { supportedNotificationChannels } from "./notification-preferences.util";
import { NotificationsService } from "./notifications.service";

@UseGuards(InternalOperatorBearerGuard)
@Controller("notifications/internal")
export class NotificationsInternalController {
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
    @Request() request: { internalOperator: { operatorId: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.listOperatorNotifications(
      request.internalOperator.operatorId,
      query,
    );

    return {
      status: "success",
      message: "Operator notifications retrieved successfully.",
      data: result,
    };
  }

  @Get("me/unread-count")
  async getUnreadCount(
    @Request() request: { internalOperator: { operatorId: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.getOperatorUnreadSummary(
      request.internalOperator.operatorId,
    );

    return {
      status: "success",
      message: "Operator notification unread summary retrieved successfully.",
      data: result,
    };
  }

  @Post("me/mark-read")
  async markRead(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: MarkNotificationsReadDto,
    @Request() request: { internalOperator: { operatorId: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.markOperatorNotificationsRead(
      request.internalOperator.operatorId,
      dto.ids,
    );

    return {
      status: "success",
      message: "Operator notifications marked as read successfully.",
      data: result,
    };
  }

  @Post("me/mark-all-read")
  async markAllRead(
    @Request() request: { internalOperator: { operatorId: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.markAllOperatorNotificationsRead(
      request.internalOperator.operatorId,
    );

    return {
      status: "success",
      message: "All operator notifications marked as read successfully.",
      data: result,
    };
  }

  @Post("me/archive")
  async archive(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: ArchiveNotificationsDto,
    @Request() request: { internalOperator: { operatorId: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.archiveOperatorNotifications(
      request.internalOperator.operatorId,
      dto.ids,
    );

    return {
      status: "success",
      message: "Operator notifications archived successfully.",
      data: result,
    };
  }

  @Get("me/preferences")
  async getPreferences(
    @Request() request: { internalOperator: { operatorId: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.getOperatorPreferences(
      request.internalOperator.operatorId,
    );

    return {
      status: "success",
      message: "Operator notification preferences retrieved successfully.",
      data: {
        notificationPreferences: result,
      },
    };
  }

  @Patch("me/preferences")
  async updatePreferences(
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    dto: UpdateNotificationPreferencesDto,
    @Request() request: { internalOperator: { operatorId: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.updateOperatorPreferences(
      request.internalOperator.operatorId,
      {
        audience: "operator",
        supportedChannels: [...supportedNotificationChannels],
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
      message: "Operator notification preferences updated successfully.",
      data: {
        notificationPreferences: result,
      },
    };
  }

  @Post("me/socket-session")
  async createSocketSession(
    @Request() request: { internalOperator: { operatorId: string } },
  ): Promise<CustomJsonResponse> {
    const result = await this.notificationsService.createOperatorSocketSession(
      request.internalOperator.operatorId,
    );

    return {
      status: "success",
      message: "Operator notification socket session created successfully.",
      data: result,
    };
  }
}
