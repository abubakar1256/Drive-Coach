import { Controller, Get, Header, NotFoundException, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { ExamCentresService } from "./exam-centres.service";

@Controller("exam-centres")
export class ExamCentresController {
  constructor(private readonly examCentresService: ExamCentresService) {}

  @Get()
  list() {
    return this.examCentresService.list();
  }

  @Get(":slug/access") @Header("Cache-Control", "private, no-store")
  @UseGuards(JwtAuthGuard)
  async access(@Param("slug") slug: string, @Req() req: AuthenticatedRequest) {
    const centre = await this.examCentresService.getBySlug(slug, req.user.sub);
    if (!centre) throw new NotFoundException("Exam centre not found");
    return centre;
  }

  @Get(":slug")
  async getBySlug(@Param("slug") slug: string) {
    const centre = await this.examCentresService.getBySlug(slug);
    if (!centre) throw new NotFoundException("Exam centre not found");
    return centre;
  }
}
