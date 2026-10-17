import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { AdminModule } from "../admin/admin.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";
import { RoutesModule } from "../routes/routes.module";

@Module({ imports: [PrismaModule, AuthModule, AdminModule, RoutesModule], controllers: [MediaController], providers: [MediaService] })
export class MediaModule {}
