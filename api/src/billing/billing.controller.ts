import { BadRequestException, Body, Controller, Get, Header, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminGuard } from "../admin/admin.guard";
import { FinanceGuard } from "../admin/finance.guard";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { BillingService } from "./billing.service";
import { CheckoutDto, CouponValidationDto, CreateCouponDto, SelectCentreDto } from "./dto/billing.dto";
import { CreatePracticeSessionDto } from "../learning/dto/learning.dto";

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("plans") @Header("Cache-Control", "no-store")
  listPlans() { return this.billingService.listPlans(); }

  @Get("me/trial") @UseGuards(JwtAuthGuard) @Header("Cache-Control", "private, no-store")
  trial(@Req() request: AuthenticatedRequest) { return this.billingService.trial(request.user.sub); }

  @Post("me/trial") @UseGuards(JwtAuthGuard)
  startTrial(@Req() request: AuthenticatedRequest, @Body() dto: CreatePracticeSessionDto) { return this.billingService.startTrial(request.user.sub, dto.routeId); }

  @Get("me/subscription") @Header("Cache-Control", "private, no-store")
  @UseGuards(JwtAuthGuard)
  subscription(@Req() request: AuthenticatedRequest) { return this.billingService.subscription(request.user.sub); }

  @Get("me/entitlements") @Header("Cache-Control", "private, no-store")
  @UseGuards(JwtAuthGuard)
  entitlements(@Req() request: AuthenticatedRequest) { return this.billingService.entitlements(request.user.sub); }

  @Get("me/payments") @Header("Cache-Control", "private, no-store")
  @UseGuards(JwtAuthGuard)
  payments(@Req() request: AuthenticatedRequest) { return this.billingService.payments(request.user.sub); }

  @Get("me/invoices") @Header("Cache-Control", "private, no-store")
  @UseGuards(JwtAuthGuard)
  invoices(@Req() request: AuthenticatedRequest) { return this.billingService.invoices(request.user.sub); }

  @Post("webhooks/stripe")
  async stripeWebhook(@Req() request: Request & { rawBody?: Buffer }, @Headers("stripe-signature") signature: string | undefined) {
    if (!request.rawBody || !this.billingService.verifyWebhookSignature(request.rawBody, signature)) throw new BadRequestException("Invalid Stripe webhook signature");
    let event: unknown; try { event = JSON.parse(request.rawBody.toString("utf8")); } catch { throw new BadRequestException("Invalid Stripe webhook payload"); }
    return this.billingService.handleWebhook(event as Parameters<BillingService["handleWebhook"]>[0]);
  }

  @Post("checkout")
  @UseGuards(JwtAuthGuard)
  checkout(@Req() request: AuthenticatedRequest, @Body() dto: CheckoutDto) { return this.billingService.checkout(request.user.sub, dto); }

  @Post("me/subscription/centre")
  @UseGuards(JwtAuthGuard)
  selectCentre(@Req() req: AuthenticatedRequest, @Body() dto: SelectCentreDto) { return this.billingService.selectCentre(req.user.sub, dto.centreId); }

  @Post("coupons/validate")
  @UseGuards(JwtAuthGuard)
  validateCoupon(@Body() dto: CouponValidationDto) { return this.billingService.validateCoupon(dto); }

  @Post("admin/coupons")
  @UseGuards(JwtAuthGuard, FinanceGuard)
  createCoupon(@Body() dto: CreateCouponDto) { return this.billingService.createCoupon(dto); }

  @Post("admin/payments/:id/refund")
  @UseGuards(JwtAuthGuard, FinanceGuard)
  refund(@Param("id") id: string) { return this.billingService.refundPayment(id); }
}
