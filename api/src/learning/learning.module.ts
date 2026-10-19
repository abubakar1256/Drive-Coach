import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { LearningController } from "./learning.controller";
import { LearningService } from "./learning.service";
import { RoutesModule } from "../routes/routes.module";
import { BillingModule } from "../billing/billing.module";
import { PreparationController } from "./preparation.controller";
import { PreparationService } from "./preparation.service";
import { PersonalizedPracticeService } from "./personalized-practice.service";
import { PersonalizationController } from "./personalization.controller";
import { PreparationCoverageController } from "./preparation-coverage.controller";

@Module({ imports: [PrismaModule, AuthModule, RoutesModule, BillingModule], controllers: [LearningController, PreparationController, PersonalizationController, PreparationCoverageController], providers: [LearningService, PreparationService, PersonalizedPracticeService], exports:[PreparationService,PersonalizedPracticeService] })
export class LearningModule {}
