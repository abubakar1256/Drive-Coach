import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma.module";
import { B2bController } from "./b2b.controller";
import { B2bService } from "./b2b.service";

@Module({ imports: [PrismaModule, AuthModule], controllers: [B2bController], providers: [B2bService] })
export class B2bModule {}
