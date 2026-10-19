import { Body, Controller, Delete, Get, Header, Patch, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard, type AuthenticatedRequest } from "../auth/auth.guard";
import { PreparationService } from "./preparation.service";
import { PreparationVersionDto, UpdatePreparationDto } from "./dto/preparation.dto";

@Controller("me/preparation-profile")
@UseGuards(JwtAuthGuard)
export class PreparationController {
  constructor(private readonly preparation: PreparationService) {}
  @Get() @Header("Cache-Control", "private, no-store")
  get(@Req() req: AuthenticatedRequest) { return this.preparation.get(req.user.sub); }
  @Patch() @Header("Cache-Control", "private, no-store")
  save(@Req() req: AuthenticatedRequest, @Body() dto: UpdatePreparationDto) { return this.preparation.save(req.user.sub, dto); }
  @Delete() @Header("Cache-Control", "private, no-store")
  clear(@Req() req: AuthenticatedRequest, @Body() dto: PreparationVersionDto) { return this.preparation.clear(req.user.sub, dto); }
}
