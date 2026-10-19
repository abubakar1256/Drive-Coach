import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { PersonalizedPracticeService } from "./personalized-practice.service";
import { HometownGenerationDto, HometownReflectionDto, PrivateSessionDto } from "./dto/personalization.dto";
import { CreateTrackPointDto } from "./dto/track.dto";
import { searchHometowns } from "./belgian-places";

@Controller("me/preparation")
@UseGuards(JwtAuthGuard)
export class PersonalizationController {
  constructor(private readonly practice: PersonalizedPracticeService) {}
  @Get("recommendations") @Header("Cache-Control","private, no-store")
  recommendations(@Req() r:AuthenticatedRequest) { return this.practice.recommendations(r.user.sub); }
  @Get("towns") @Header("Cache-Control","private, no-store")
  towns(@Query("q") query:string) { return searchHometowns(typeof query==="string"?query:""); }
  @Get("hometown-routes") @Header("Cache-Control","private, no-store")
  list(@Req() r:AuthenticatedRequest) { return this.practice.list(r.user.sub); }
  @Post("hometown-routes") @Header("Cache-Control","private, no-store")
  generate(@Req() r:AuthenticatedRequest,@Body() d:HometownGenerationDto) { return this.practice.generate(r.user.sub,d); }
  @Get("hometown-routes/:id") @Header("Cache-Control","private, no-store")
  route(@Req() r:AuthenticatedRequest,@Param("id") id:string) { return this.practice.getRoute(r.user.sub,id); }
  @Delete("hometown-routes/:id") @Header("Cache-Control","private, no-store")
  remove(@Req() r:AuthenticatedRequest,@Param("id") id:string,@Body() d:PrivateSessionDto) { return this.practice.remove(r.user.sub,id,d); }
  @Post("hometown-routes/:id/sessions") @Header("Cache-Control","private, no-store")
  start(@Req() r:AuthenticatedRequest,@Param("id") id:string,@Body() d:PrivateSessionDto) { return this.practice.start(r.user.sub,id,d); }
  @Post("hometown-sessions/:id/track") @Header("Cache-Control","private, no-store")
  track(@Req() r:AuthenticatedRequest,@Param("id") id:string,@Body() d:CreateTrackPointDto) { return this.practice.track(r.user.sub,id,d); }
  @Patch("hometown-sessions/:id/end") @Header("Cache-Control","private, no-store")
  end(@Req() r:AuthenticatedRequest,@Param("id") id:string,@Body() d:PrivateSessionDto) { return this.practice.end(r.user.sub,id,d); }
  @Post("hometown-sessions/:id/reflection") @Header("Cache-Control","private, no-store")
  reflect(@Req() r:AuthenticatedRequest,@Param("id") id:string,@Body() d:HometownReflectionDto) { return this.practice.reflect(r.user.sub,id,d); }
}
