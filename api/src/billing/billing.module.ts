import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminModule } from "../admin/admin.module";
import { PrismaModule } from "../prisma.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";
import { FinanceGuard } from "../admin/finance.guard";

@Module({ imports: [PrismaModule, AuthModule, AdminModule], controllers: [BillingController], providers: [BillingService, FinanceGuard], exports: [BillingService] })
export class BillingModule {}
