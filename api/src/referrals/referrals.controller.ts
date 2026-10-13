import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { ClaimReferralDto, CreateReferralCodeDto, PayoutDto } from "./dto/referral.dto";
import { FinanceGuard } from "../admin/finance.guard";
import { ReferralsService } from "./referrals.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}
  @Get("me/referrals") me(@Req() req: AuthenticatedRequest) { return this.referrals.me(req.user.sub); }
  @Get("referrals/schools/:schoolId/current") currentSchoolCode(@Req() req: AuthenticatedRequest, @Param("schoolId") schoolId: string) { return this.referrals.currentSchoolCode(req.user.sub, schoolId); }
  @Post("referrals/codes") create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReferralCodeDto) { return this.referrals.createCode(req.user.sub, dto); }
  @Post("referrals/claim") claim(@Req() req: AuthenticatedRequest, @Body() dto: ClaimReferralDto) { return this.referrals.claim(req.user.sub, dto); }
  @Post("admin/commissions/:id/payout")
  @UseGuards(FinanceGuard)
  payout(@Req() req: AuthenticatedRequest, @Param("id") id: string, @Body() dto: PayoutDto) { return this.referrals.recordPayout(req.user.sub, id, dto.reference); }
}
