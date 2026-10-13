import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { RoutesModule } from "../routes/routes.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({ imports: [PrismaModule, AuthModule, RoutesModule, NotificationsModule], controllers: [AdminController], providers: [AdminGuard, AdminService], exports: [AdminGuard] })
export class AdminModule {}
