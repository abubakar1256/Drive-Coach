import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { AdminGuard } from "../admin/admin.guard";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/auth.guard";
import { BillingService } from "./billing.service";
import { CheckoutDto, CouponValidationDto, CreateCouponDto } from "./dto/billing.dto";

@Controller()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get("plans")
  listPlans() { return this.billingService.listPlans(); }

  @Get("me/subscription")
  @UseGuards(JwtAuthGuard)
  subscription(@Req() request: AuthenticatedRequest) { return this.billingService.subscription(request.user.sub); }

  @Get("me/entitlements")
  @UseGuards(JwtAuthGuard)
  entitlements(@Req() request: AuthenticatedRequest) { return this.billingService.entitlements(request.user.sub); }

  @Get("me/payments")
  @UseGuards(JwtAuthGuard)
  payments(@Req() request: AuthenticatedRequest) { return this.billingService.payments(request.user.sub); }

  @Get("me/invoices")
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

  @Post("coupons/validate")
  @UseGuards(JwtAuthGuard)
  validateCoupon(@Body() dto: CouponValidationDto) { return this.billingService.validateCoupon(dto); }

  @Post("admin/coupons")
  @UseGuards(JwtAuthGuard, AdminGuard)
  createCoupon(@Body() dto: CreateCouponDto) { return this.billingService.createCoupon(dto); }

  @Post("admin/payments/:id/refund")
  @UseGuards(JwtAuthGuard, AdminGuard)
  refund(@Param("id") id: string) { return this.billingService.refundPayment(id); }
}
