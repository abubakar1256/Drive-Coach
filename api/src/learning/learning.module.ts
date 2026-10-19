import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";
import { RoutesModule } from "../routes/routes.module";
import { BillingModule } from "../billing/billing.module";
import { PreparationController } from "./preparation.controller";
import { PreparationService } from "./preparation.service";

@Module({ imports: [PrismaModule, AuthModule, RoutesModule, BillingModule], controllers: [LearningController, PreparationController], providers: [LearningService, PreparationService] })
export class LearningModule {}
