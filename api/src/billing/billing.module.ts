import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminModule } from "../admin/admin.module";
import { PrismaModule } from "../prisma.module";
import { BillingController } from "./billing.controller";
import { BillingService } from "./billing.service";

@Module({ imports: [PrismaModule, AuthModule, AdminModule], controllers: [BillingController], providers: [BillingService] })
export class BillingModule {}
