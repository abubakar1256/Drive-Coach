import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ExamCentresService } from "./exam-centres.service";

@Controller("exam-centres")
export class ExamCentresController {
  constructor(private readonly examCentresService: ExamCentresService) {}

  @Get()
  list() {
    return this.examCentresService.list();
  }

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const centre = await this.examCentresService.getBySlug(slug);
    if (!centre) throw new NotFoundException("Exam centre not found");
    return centre;
  }
}
