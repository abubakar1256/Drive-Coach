import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { RoutesController } from "./routes.controller";
import { RoutesService } from "./routes.service";
import { DrivingRouteService } from "./driving-route.service";
import { RouteAccessService } from "./route-access.service";
import { PracticeLoopService } from "./practice-loop.service";

@Module({ imports: [PrismaModule, AuthModule], controllers: [RoutesController], providers: [RoutesService, DrivingRouteService, RouteAccessService, PracticeLoopService], exports: [RoutesService, DrivingRouteService, RouteAccessService, PracticeLoopService] })
export class RoutesModule {}
