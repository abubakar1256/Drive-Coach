import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { ReferralsController } from "./referrals.controller";
import { ReferralsService } from "./referrals.service";
import { FinanceGuard } from "../admin/finance.guard";

@Module({ imports: [PrismaModule, AuthModule], controllers: [ReferralsController], providers: [ReferralsService, FinanceGuard] })
export class ReferralsModule {}
