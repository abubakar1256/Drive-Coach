import { Module } from "@nestjs/common";
import { ExamCentresController } from "./exam-centres.controller";
import { ExamCentresService } from "./exam-centres.service";
import { AuthModule } from "../auth/auth.module";
import { RoutesModule } from "../routes/routes.module";

@Module({ imports: [AuthModule, RoutesModule], controllers: [ExamCentresController], providers: [ExamCentresService] })
export class ExamCentresModule {}
