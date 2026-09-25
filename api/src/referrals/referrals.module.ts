import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { ReferralsController } from "./referrals.controller";
import { ReferralsService } from "./referrals.service";

@Module({ imports: [PrismaModule, AuthModule], controllers: [ReferralsController], providers: [ReferralsService] })
export class ReferralsModule {}
