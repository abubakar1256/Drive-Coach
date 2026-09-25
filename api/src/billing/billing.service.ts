import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { CheckoutDto, CouponValidationDto, CreateCouponDto } from "./dto/billing.dto";

type StripeResponse = { [key: string]: unknown; id?: string; url?: string; payment_intent?: string | null; invoice?: string | null; subscription?: string | null; amount_total?: number; currency?: string; metadata?: Record<string, string> };

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  listPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceCents: "asc" }, select: { id: true, name: true, durationHours: true, priceCents: true, currency: true } });
  }

  async subscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({ where: { userId, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, include: { plan: true }, orderBy: { createdAt: "desc" } });
    return subscription ? { status: subscription.status, plan: subscription.plan.name, startsAt: subscription.startsAt, expiresAt: subscription.expiresAt, provider: subscription.provider } : { status: "FREE", plan: "Free", startsAt: null, expiresAt: null, provider: null };
  }

  async entitlements(userId: string) {
    const subscription = await this.subscription(userId);
    const premium = subscription.status === "ACTIVE" && subscription.plan !== "Free";
    return { premium, plan: subscription.plan, status: subscription.status, features: { routeDetails: true, fullRouteMedia: premium, practiceSessions: true, progressHistory: true, savedRoutes: true, prioritySupport: premium } };
  }

  payments(userId: string) {
    return this.prisma.$queryRawUnsafe('SELECT p."id", p."amountCents", p."currency", p."status", p."provider", p."createdAt", pl."name" AS "planName" FROM "Payment" p JOIN "Plan" pl ON pl."id" = p."planId" WHERE p."userId" = $1 ORDER BY p."createdAt" DESC LIMIT 100', userId);
  }

  invoices(userId: string) {
    return this.prisma.$queryRawUnsafe('SELECT "id", "number", "amountCents", "currency", "status", "invoiceUrl", "issuedAt", "paidAt", "createdAt" FROM "Invoice" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 100', userId);
  }

  async validateCoupon(dto: CouponValidationDto) {
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId }, select: { id: true, priceCents: true, currency: true } });
    if (!plan) throw new BadRequestException("Plan not found");
    const coupon = await this.findCoupon(dto.code, plan.currency);
    const discount = coupon.percentOff ? Math.floor(plan.priceCents * coupon.percentOff / 100) : Math.min(coupon.amountOffCents ?? 0, plan.priceCents);
    return { valid: true, code: coupon.code, originalAmountCents: plan.priceCents, discountCents: discount, finalAmountCents: Math.max(0, plan.priceCents - discount), currency: plan.currency };
  }

  async createCoupon(dto: CreateCouponDto) {
    if ((dto.percentOff ?? 0) > 100 || (dto.percentOff ?? 0) < 0) throw new BadRequestException("percentOff must be between 0 and 100");
    if ((dto.amountOffCents ?? 0) < 0) throw new BadRequestException("amountOffCents cannot be negative");
    if (!dto.percentOff && !dto.amountOffCents) throw new BadRequestException("Add percentOff or amountOffCents");
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>('INSERT INTO "Coupon" ("id", "code", "percentOff", "amountOffCents", "currency", "maxRedemptions", "expiresAt") VALUES ($1,UPPER($2),$3,$4,$5,$6,$7) RETURNING "id", "code", "percentOff", "amountOffCents", "currency", "maxRedemptions", "expiresAt", "active"', randomUUID(), dto.code.trim(), dto.percentOff ?? null, dto.amountOffCents ?? null, dto.currency?.toUpperCase() ?? null, dto.maxRedemptions ?? null, dto.expiresAt ? new Date(dto.expiresAt) : null);
    return rows[0];
  }

  async checkout(userId: string, dto: CheckoutDto) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return this.checkoutUnavailable();
    const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId }, select: { id: true, name: true, durationHours: true, priceCents: true, currency: true, isActive: true } });
    if (!plan?.isActive) throw new BadRequestException("Plan not found or inactive");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new BadRequestException("User not found");
    let amountCents = plan.priceCents;
    if (dto.couponCode) {
      const coupon = await this.findCoupon(dto.couponCode, plan.currency);
      const discount = coupon.percentOff ? Math.floor(plan.priceCents * coupon.percentOff / 100) : Math.min(coupon.amountOffCents ?? 0, plan.priceCents);
      amountCents = Math.max(0, plan.priceCents - discount);
    }
    const paymentId = randomUUID();
    await this.prisma.$executeRawUnsafe('INSERT INTO "Payment" ("id", "userId", "planId", "provider", "amountCents", "currency", "status", "metadata") VALUES ($1,$2,$3,\'STRIPE\',$4,$5,\'PENDING\',$6::jsonb)', paymentId, userId, plan.id, amountCents, plan.currency, JSON.stringify({ couponCode: dto.couponCode ?? null, originalAmountCents: plan.priceCents }));
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    const form = new URLSearchParams();
    form.set("mode", "payment"); form.set("success_url", process.env.STRIPE_SUCCESS_URL ?? `${webOrigin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`); form.set("cancel_url", process.env.STRIPE_CANCEL_URL ?? `${webOrigin}/account?checkout=cancelled`); form.set("customer_email", user.email); form.set("client_reference_id", userId); form.set("invoice_creation[enabled]", "true");
    form.set("line_items[0][price_data][currency]", plan.currency.toLowerCase()); form.set("line_items[0][price_data][unit_amount]", String(amountCents)); form.set("line_items[0][price_data][product_data][name]", `RoutePilot ${plan.name} access`); form.set("line_items[0][quantity]", "1");
    form.set("metadata[paymentId]", paymentId); form.set("metadata[userId]", userId); form.set("metadata[planId]", plan.id); if (dto.couponCode) form.set("metadata[couponCode]", dto.couponCode.trim().toUpperCase());
    try {
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
      const session = await response.json() as StripeResponse & { error?: { message?: string } };
      if (!response.ok || !session.id || !session.url) throw new Error(session.error?.message ?? "Stripe did not return a checkout session");
      await this.prisma.$executeRawUnsafe('UPDATE "Payment" SET "checkoutSessionId" = $1, "updatedAt" = NOW() WHERE "id" = $2', session.id, paymentId);
      return { checkoutUrl: session.url, sessionId: session.id, paymentId };
    } catch (error) {
      await this.prisma.$executeRawUnsafe('UPDATE "Payment" SET "status" = \'FAILED\', "updatedAt" = NOW() WHERE "id" = $1', paymentId);
      throw new ServiceUnavailableException(error instanceof Error ? `Payment provider unavailable: ${error.message}` : "Payment provider unavailable");
    }
  }

  verifyWebhookSignature(payload: Buffer, signature: string | undefined) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const parts = signature.split(",").reduce<Record<string, string[]>>((result, item) => { const [key, value] = item.split("=", 2); if (key && value) (result[key] ??= []).push(value); return result; }, {});
    const timestamp = parts.t?.[0]; const signatures = parts.v1 ?? [];
    if (!timestamp || !signatures.length || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
    const expected = createHmac("sha256", secret).update(`${timestamp}.${payload.toString("utf8")}`).digest();
    return signatures.some((value) => { try { const actual = Buffer.from(value, "hex"); return actual.length === expected.length && timingSafeEqual(actual, expected); } catch { return false; } });
  }

  async handleWebhook(event: { id?: string; type?: string; data?: { object?: StripeResponse } }) {
    if (!event.id || !event.type) throw new BadRequestException("Invalid Stripe event");
    const existing = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "PaymentWebhookEvent" WHERE "provider" = \'STRIPE\' AND "eventId" = $1 LIMIT 1', event.id);
    if (existing[0]) return { received: true, duplicate: true };
    await this.prisma.$executeRawUnsafe('INSERT INTO "PaymentWebhookEvent" ("id", "provider", "eventId", "eventType", "payload", "processedAt") VALUES ($1,\'STRIPE\',$2,$3,$4::jsonb,NOW())', randomUUID(), event.id, event.type, JSON.stringify(event));
    const object = event.data?.object ?? {};
    if (event.type === "checkout.session.completed") await this.completeCheckout(object);
    if (event.type === "payment_intent.payment_failed") await this.failPayment(typeof object.payment_intent === "string" ? object.payment_intent : object.id);
    if (event.type === "charge.refunded") await this.markRefunded(typeof object.payment_intent === "string" ? object.payment_intent : object.id, object.id, Number(object.amount ?? object.amount_refunded ?? 0));
    if (event.type === "invoice.paid") await this.recordInvoice(object);
    return { received: true };
  }

  async refundPayment(paymentId: string) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) return this.checkoutUnavailable();
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; providerPaymentId: string | null; amountCents: number; status: string }>>('SELECT "id", "providerPaymentId", "amountCents", "status" FROM "Payment" WHERE "id" = $1', paymentId);
    const payment = rows[0]; if (!payment) throw new BadRequestException("Payment not found"); if (!payment.providerPaymentId) throw new BadRequestException("Payment has no Stripe payment intent yet"); if (payment.status === "REFUNDED") throw new BadRequestException("Payment is already refunded");
    const form = new URLSearchParams({ payment_intent: payment.providerPaymentId, amount: String(payment.amountCents) });
    const response = await fetch("https://api.stripe.com/v1/refunds", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const refund = await response.json() as StripeResponse & { amount?: number; status?: string; error?: { message?: string } };
    if (!response.ok || !refund.id) throw new BadRequestException(refund.error?.message ?? "Stripe refund failed");
    await this.markRefunded(payment.providerPaymentId, refund.id, Number(refund.amount ?? payment.amountCents));
    return { success: true, refundId: refund.id };
  }

  private async findCoupon(code: string, currency: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; percentOff: number | null; amountOffCents: number | null; currency: string | null; maxRedemptions: number | null; redeemCount: number; expiresAt: Date | null }>>('SELECT "id", "code", "percentOff", "amountOffCents", "currency", "maxRedemptions", "redeemCount", "expiresAt" FROM "Coupon" WHERE UPPER("code") = UPPER($1) AND "active" = true LIMIT 1', code.trim());
    const coupon = rows[0];
    if (!coupon || (coupon.expiresAt && coupon.expiresAt <= new Date()) || (coupon.maxRedemptions !== null && coupon.redeemCount >= coupon.maxRedemptions)) throw new BadRequestException("Coupon is invalid or expired");
    if (coupon.currency && coupon.currency !== currency) throw new BadRequestException("Coupon currency does not match the plan");
    return coupon;
  }

  private async completeCheckout(session: StripeResponse) {
    const metadata = session.metadata ?? {};
    const paymentRows = await this.prisma.$queryRawUnsafe<Array<{ id: string; userId: string; planId: string; subscriptionId: string | null }>>('SELECT "id", "userId", "planId", "subscriptionId" FROM "Payment" WHERE "id" = $1 OR "checkoutSessionId" = $2 LIMIT 1', metadata.paymentId ?? "", session.id ?? "");
    const payment = paymentRows[0]; if (!payment) return;
    const plans = await this.prisma.$queryRawUnsafe<Array<{ durationHours: number }>>('SELECT "durationHours" FROM "Plan" WHERE "id" = $1', payment.planId); const durationHours = plans[0]?.durationHours ?? 24;
    const providerPaymentId = typeof session.payment_intent === "string" ? session.payment_intent : session.id ?? null;
    const subscriptionId = payment.subscriptionId ?? randomUUID();
    await this.prisma.$executeRawUnsafe('UPDATE "Payment" SET "status" = \'SUCCEEDED\', "providerPaymentId" = COALESCE("providerPaymentId", $1), "checkoutSessionId" = COALESCE("checkoutSessionId", $2), "updatedAt" = NOW() WHERE "id" = $3', providerPaymentId, session.id ?? null, payment.id);
    if (payment.subscriptionId) await this.prisma.$executeRawUnsafe('UPDATE "Subscription" SET "status" = \'ACTIVE\', "provider" = \'STRIPE\', "providerRef" = $1, "startsAt" = NOW(), "expiresAt" = NOW() + ($2 * INTERVAL \'1 hour\'), "updatedAt" = NOW() WHERE "id" = $3', session.subscription ?? providerPaymentId, durationHours, subscriptionId);
    else await this.prisma.$executeRawUnsafe('INSERT INTO "Subscription" ("id", "userId", "planId", "status", "provider", "providerRef", "startsAt", "expiresAt") VALUES ($1,$2,$3,\'ACTIVE\',\'STRIPE\',$4,NOW(),NOW() + ($5 * INTERVAL \'1 hour\'))', subscriptionId, payment.userId, payment.planId, session.subscription ?? providerPaymentId, durationHours);
    await this.prisma.$executeRawUnsafe('UPDATE "Payment" SET "subscriptionId" = $1 WHERE "id" = $2', subscriptionId, payment.id);
    const couponCode = metadata.couponCode; if (couponCode) await this.prisma.$executeRawUnsafe('UPDATE "Coupon" SET "redeemCount" = "redeemCount" + 1 WHERE UPPER("code") = UPPER($1) AND "active" = true', couponCode);
  }

  private async failPayment(providerPaymentId: string | undefined) { if (providerPaymentId) await this.prisma.$executeRawUnsafe('UPDATE "Payment" SET "status" = \'FAILED\', "updatedAt" = NOW() WHERE "providerPaymentId" = $1', providerPaymentId); }

  private async markRefunded(providerPaymentId: string | undefined, refundId: string | undefined, amountCents: number) {
    if (!providerPaymentId) return;
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; subscriptionId: string | null }>>('SELECT "id", "subscriptionId" FROM "Payment" WHERE "providerPaymentId" = $1', providerPaymentId); const payment = rows[0]; if (!payment) return;
    await this.prisma.$executeRawUnsafe('UPDATE "Payment" SET "status" = \'REFUNDED\', "updatedAt" = NOW() WHERE "id" = $1', payment.id);
    if (payment.subscriptionId) await this.prisma.$executeRawUnsafe('UPDATE "Subscription" SET "status" = \'REFUNDED\', "updatedAt" = NOW() WHERE "id" = $1', payment.subscriptionId);
    await this.prisma.$executeRawUnsafe('INSERT INTO "Refund" ("id", "paymentId", "providerRefundId", "amountCents", "status") VALUES ($1,$2,$3,$4,\'SUCCEEDED\') ON CONFLICT ("providerRefundId") DO NOTHING', randomUUID(), payment.id, refundId ?? null, amountCents);
  }

  private async recordInvoice(invoice: StripeResponse) {
    const metadata = invoice.metadata ?? {}; const paymentIntent = typeof invoice.payment_intent === "string" ? invoice.payment_intent : ""; const paymentRows = await this.prisma.$queryRawUnsafe<Array<{ id: string; userId: string }>>('SELECT "id", "userId" FROM "Payment" WHERE "id" = $1 OR "providerPaymentId" = $2 LIMIT 1', metadata.paymentId ?? "", paymentIntent); const payment = paymentRows[0]; if (!payment || !invoice.id) return;
    await this.prisma.$executeRawUnsafe('INSERT INTO "Invoice" ("id", "userId", "paymentId", "providerInvoiceId", "number", "amountCents", "currency", "status", "invoiceUrl", "issuedAt", "paidAt") VALUES ($1,$2,$3,$4,$5,$6,$7,\'PAID\',$8,NOW(),NOW()) ON CONFLICT ("providerInvoiceId") DO UPDATE SET "status" = \'PAID\', "paidAt" = NOW(), "invoiceUrl" = EXCLUDED."invoiceUrl"', randomUUID(), payment.userId, payment.id, invoice.id, typeof invoice.number === "string" ? invoice.number : null, Number(invoice.amount_paid ?? invoice.amount_paid ?? 0), typeof invoice.currency === "string" ? invoice.currency : "eur", typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null);
  }

  private checkoutUnavailable(): never { throw new ServiceUnavailableException("Payment checkout is not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET before enabling live billing."); }
}
