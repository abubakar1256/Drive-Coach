import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { CreatePracticeSessionDto, CreateReflectionDto, UpdatePracticeSessionDto, SaveDriveReviewDto } from "./dto/learning.dto";
import { CreateTrackPointDto } from "./dto/track.dto";
import { LearningService } from "./learning.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get("me/dashboard") dashboard(@Req() req: AuthenticatedRequest) { return this.learning.dashboard(req.user.sub); }
  @Get("me/favorites") favorites(@Req() req: AuthenticatedRequest) { return this.learning.listFavorites(req.user.sub); }
  @Post("me/favorites/:routeId") addFavorite(@Req() req: AuthenticatedRequest, @Param("routeId") routeId: string) { return this.learning.addFavorite(req.user.sub, routeId); }
  @Delete("me/favorites/:routeId") removeFavorite(@Req() req: AuthenticatedRequest, @Param("routeId") routeId: string) { return this.learning.removeFavorite(req.user.sub, routeId); }
  @Get("me/practice-sessions") sessions(@Req() req: AuthenticatedRequest) { return this.learning.listSessions(req.user.sub); }
  @Get("practice-sessions/:id/report") @Header("Cache-Control", "private, no-store") report(@Req() req: AuthenticatedRequest, @Param("id") id: string) { return this.learning.driveReport(req.user.sub, id); }
  @Post("practice-sessions/:id/review") review(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: SaveDriveReviewDto) { return this.learning.saveDriveReview(req.user.sub, id, dto); }
  @Get("me/route-assistant") routeAssistant(@Req() req: AuthenticatedRequest, @Query("routeId") routeId: string) { return this.learning.routeAssistant(req.user.sub, routeId); }
  @Get("me/drive-coach") driveCoach(@Req() req: AuthenticatedRequest, @Query("routeId") routeId?: string, @Query("mode") mode?: string) { return this.learning.driveCoach(req.user.sub, routeId, mode); }
  @Get("me/drive-coach/trigger") trigger(@Req() req: AuthenticatedRequest, @Query("routePointId") routePointId: string, @Query("distanceM") distanceM: string, @Query("sessionId") sessionId?: string, @Query("mode") mode?: string) { return this.learning.triggerVoiceTip(req.user.sub, routePointId, Number(distanceM), sessionId, mode); }
  @Get("me/route-recommendation") routeRecommendation(@Req() req: AuthenticatedRequest, @Query("routeId") routeId: string) { return this.learning.routeRecommendation(req.user.sub, routeId); }
  @Post("practice-sessions") start(@Req() req: AuthenticatedRequest, @Body() dto: CreatePracticeSessionDto) { return this.learning.startSession(req.user.sub, dto); }
  @Post("practice-sessions/:id/repeat") @Header("Cache-Control","private, no-store") repeat(@Req() req: AuthenticatedRequest,@Param("id") id:string,@Body() dto:CreatePracticeSessionDto) { return this.learning.repeatSession(req.user.sub,id,dto.routeId); }
  @Patch("practice-sessions/:id") update(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: UpdatePracticeSessionDto) { return this.learning.updateSession(req.user.sub, id, dto); }
  @Post("practice-sessions/:id/reflection") reflection(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: CreateReflectionDto) { return this.learning.saveReflection(req.user.sub, id, dto); }
  @Post("practice-sessions/:id/track") track(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: CreateTrackPointDto) { return this.learning.recordTrackPoint(req.user.sub, id, dto); }
}
