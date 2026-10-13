import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { B2bService } from "./b2b.service";
import { AssignRouteDto, CreateSchoolDto, InstructorFeedbackDto, InviteInstructorDto, InviteStudentDto } from "./dto/b2b.dto";

@Controller("b2b")
@UseGuards(JwtAuthGuard)
export class B2bController {
  constructor(private readonly b2b: B2bService) {}
  @Get("me") me(@Req() req: AuthenticatedRequest) { return this.b2b.me(req.user.sub); }
  @Post("schools") createSchool(@Req() req: AuthenticatedRequest, @Body() dto: CreateSchoolDto) { return this.b2b.createSchool(req.user.sub, dto); }
  @Post("enrollments/invite") invite(@Req() req: AuthenticatedRequest, @Body() dto: InviteStudentDto) { return this.b2b.invite(req.user.sub, dto); }
  @Post("enrollments/:id/accept") accept(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.b2b.accept(req.user.sub, id); }
  @Get("assignments") assignments(@Req() req: AuthenticatedRequest) { return this.b2b.assignments(req.user.sub); }
  @Get("feedback") myFeedback(@Req() req: AuthenticatedRequest) { return this.b2b.myFeedback(req.user.sub); }
  @Get("enrollments/:id/history") history(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.b2b.studentHistory(req.user.sub, id); }
  @Post("enrollments/:id/assignments") assign(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: AssignRouteDto) { return this.b2b.assign(req.user.sub, id, dto); }
  @Post("enrollments/:id/feedback") feedback(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: InstructorFeedbackDto) { return this.b2b.feedback(req.user.sub, id, dto); }
  @Post("schools/:id/instructors") inviteInstructor(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: InviteInstructorDto) { return this.b2b.inviteInstructor(req.user.sub, id, dto.email); }
  @Post("instructor/accept") acceptInstructor(@Req() req: AuthenticatedRequest) { return this.b2b.acceptInstructor(req.user.sub); }
  @Post("enrollments/:id/revoke") revoke(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.b2b.revokeEnrollment(req.user.sub, id); }
  @Post("schools/:id/instructors/:instructorId/remove") removeInstructor(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Param("instructorId") instructorId: string) { return this.b2b.removeInstructor(req.user.sub, id, instructorId); }
  @Get("schools/:id/billing") billing(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.b2b.schoolBilling(req.user.sub, id); }
}
