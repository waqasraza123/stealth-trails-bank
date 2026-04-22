import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaService } from "../prisma/prisma.service";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [NotificationsModule],
  controllers: [UserController],
  providers: [UserService, PrismaService],
})
export class UserModule {}
