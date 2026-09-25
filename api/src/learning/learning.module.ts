import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";

@Module({ imports: [PrismaModule, AuthModule], controllers: [LearningController], providers: [LearningService] })
export class LearningModule {}
