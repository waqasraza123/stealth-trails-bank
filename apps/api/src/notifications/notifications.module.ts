import { Global, Module } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsInternalController } from "./notifications-internal.controller";
import { NotificationsRealtimeService } from "./notifications.realtime.service";
import { NotificationsService } from "./notifications.service";

@Global()
@Module({
  controllers: [NotificationsController, NotificationsInternalController],
  providers: [PrismaService, NotificationsRealtimeService, NotificationsService],
  exports: [NotificationsRealtimeService, NotificationsService],
})
export class NotificationsModule {}
