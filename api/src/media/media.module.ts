import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { AdminModule } from "../admin/admin.module";
import { MediaController } from "./media.controller";
import { MediaService } from "./media.service";

@Module({ imports: [PrismaModule, AuthModule, AdminModule], controllers: [MediaController], providers: [MediaService] })
export class MediaModule {}
