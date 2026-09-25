import { Module } from "@nestjs/common";
import { ExamCentresController } from "./exam-centres.controller";
import { ExamCentresService } from "./exam-centres.service";

@Module({ controllers: [ExamCentresController], providers: [ExamCentresService] })
export class ExamCentresModule {}
