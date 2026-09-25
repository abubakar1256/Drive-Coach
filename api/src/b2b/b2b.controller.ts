import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { B2bService } from "./b2b.service";
import { CreateSchoolDto, InviteStudentDto } from "./dto/b2b.dto";

@Controller("b2b")
@UseGuards(JwtAuthGuard)
export class B2bController {
  constructor(private readonly b2b: B2bService) {}
  @Get("me") me(@Req() req: AuthenticatedRequest) { return this.b2b.me(req.user.sub); }
  @Post("schools") createSchool(@Req() req: AuthenticatedRequest, @Body() dto: CreateSchoolDto) { return this.b2b.createSchool(req.user.sub, dto); }
  @Post("enrollments/invite") invite(@Req() req: AuthenticatedRequest, @Body() dto: InviteStudentDto) { return this.b2b.invite(req.user.sub, dto); }
  @Post("enrollments/:id/accept") accept(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.b2b.accept(req.user.sub, id); }
}
