import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";

@Module({ imports: [PrismaModule, AuthModule], controllers: [RoutesController], providers: [RoutesService] })
export class RoutesModule {}
