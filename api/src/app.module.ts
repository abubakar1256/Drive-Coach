import { Module } from "@nestjs/common";
import { ExamCentresModule } from "./exam-centres/exam-centres.module";
import { AuthModule } from "./auth/auth.module";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma.module";
import { RoutesModule } from "./routes/routes.module";
import { AdminModule } from "./admin/admin.module";
import { LearningModule } from "./learning/learning.module";
import { BillingModule } from "./billing/billing.module";
import { MediaModule } from "./media/media.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { B2bModule } from "./b2b/b2b.module";
import { ReferralsModule } from "./referrals/referrals.module";
import { AnalyticsModule } from "./analytics/analytics.module";

@Module({ controllers: [HealthController], imports: [PrismaModule, ExamCentresModule, RoutesModule, AuthModule, AdminModule, LearningModule, BillingModule, MediaModule, NotificationsModule, B2bModule, ReferralsModule, AnalyticsModule] })
export class AppModule {}
