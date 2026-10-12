import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";
import { RoutesModule } from "../routes/routes.module";

@Module({ imports: [PrismaModule, AuthModule, RoutesModule], controllers: [LearningController], providers: [LearningService] })
export class LearningModule {}
