import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { CheckoutDto, CouponValidationDto, CreateCouponDto } from "./dto/billing.dto";

type StripeResponse = { [key: string]: unknown; id?: string; url?: string; payment_intent?: string | null; invoice?: string | null; subscription?: string | null; amount_total?: number; currency?: string; metadata?: Record<string, string> };

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  listPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true, name: { in: ["Premium", "Diamond"] } }, orderBy: { priceCents: "asc" }, select: { id: true, name: true, durationHours: true, priceCents: true, currency: true } });
  }

  async subscription(userId: string) {
    const now = new Date();
    const [user, subscription] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
      this.prisma.subscription.findFirst({
        where: {
          userId, status: "ACTIVE", plan: { name: { in: ["Premium", "Diamond"] } },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          ],
        },
        include: { plan: true }, orderBy: [{ plan: { name: "asc" } }, { createdAt: "desc" }],
      }),
    ]);
    if (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) return { status: "ACTIVE", plan: "Diamond", startsAt: null, expiresAt: null, provider: "INTERNAL" };
    return user && subscription ? { status: subscription.status, plan: subscription.plan.name, centreId: subscription.centreId, startsAt: subscription.startsAt, expiresAt: subscription.expiresAt, provider: subscription.provider } : { status: "FREE", plan: "Free", centreId: null, startsAt: null, expiresAt: null, provider: null };
  }

  async entitlements(userId: string) {
    const subscription = await this.subscription(userId);
    const premium = subscription.status === "ACTIVE" && subscription.plan !== "Free";
    const aiChat = subscription.status === "ACTIVE" && ["Premium", "Diamond"].includes(subscription.plan);
    return { premium, plan: subscription.plan, status: subscription.status, expiresAt: subscription.expiresAt, features: { routeDetails: true, fullRouteMedia: premium, practiceSessions: true, progressHistory: true, savedRoutes: true, prioritySupport: premium, aiChat } };
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
    if (!["Premium", "Diamond"].includes(plan.name)) throw new BadRequestException("Unsupported plan");
    const current = await this.subscription(userId);
    if (current.status === "ACTIVE" && (current.plan === "Diamond" || current.plan === plan.name)) throw new BadRequestException("This access is already active on your account");
    if (plan.name === "Premium" && (!dto.centreId || !await this.prisma.examCentre.findFirst({ where: { id: dto.centreId, isPublished: true } }))) throw new BadRequestException("Choose your exam centre before buying Premium");
    if (dto.schoolId && !await this.prisma.drivingSchool.findFirst({ where: { id: dto.schoolId, createdByUserId: userId } })) throw new BadRequestException("School billing is limited to the school owner");
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!user) throw new BadRequestException("User not found");
    let amountCents = plan.priceCents;
    if (dto.couponCode) {
      const coupon = await this.findCoupon(dto.couponCode, plan.currency);
      const discount = coupon.percentOff ? Math.floor(plan.priceCents * coupon.percentOff / 100) : Math.min(coupon.amountOffCents ?? 0, plan.priceCents);
      amountCents = Math.max(0, plan.priceCents - discount);
    }
    const paymentId = randomUUID();
    await this.prisma.$executeRawUnsafe('INSERT INTO "Payment" ("id", "userId", "planId", "provider", "amountCents", "currency", "status", "metadata", "schoolId") VALUES ($1,$2,$3,\'STRIPE\',$4,$5,\'PENDING\',$6::jsonb,$7)', paymentId, userId, plan.id, amountCents, plan.currency, JSON.stringify({ couponCode: dto.couponCode ?? null, originalAmountCents: plan.priceCents, centreId: plan.name === "Premium" ? dto.centreId : null }), dto.schoolId ?? null);
    const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";
    const form = new URLSearchParams();
    form.set("mode", "payment"); form.set("success_url", process.env.STRIPE_SUCCESS_URL ?? `${webOrigin}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`); form.set("cancel_url", process.env.STRIPE_CANCEL_URL ?? `${webOrigin}/account?checkout=cancelled`); form.set("customer_email", user.email); form.set("client_reference_id", userId); form.set("invoice_creation[enabled]", "true");
    form.set("line_items[0][price_data][currency]", plan.currency.toLowerCase()); form.set("line_items[0][price_data][unit_amount]", String(amountCents)); form.set("line_items[0][price_data][product_data][name]", `RoutePilot ${plan.name} access`); form.set("line_items[0][quantity]", "1");
    form.set("metadata[paymentId]", paymentId); form.set("metadata[userId]", userId); form.set("metadata[planId]", plan.id); if (dto.couponCode) form.set("metadata[couponCode]", dto.couponCode.trim().toUpperCase());
    form.set("payment_intent_data[metadata][paymentId]", paymentId);
    try {
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": `checkout-${paymentId}` }, body: form });
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
    return this.prisma.$transaction(async tx => {
      await tx.paymentWebhookEvent.upsert({ where: { provider_eventId: { provider: "STRIPE", eventId: event.id! } }, create: { provider: "STRIPE", eventId: event.id!, eventType: event.type!, payload: event as Prisma.InputJsonValue }, update: {} });
      const rows = await tx.$queryRawUnsafe<Array<{ processedAt: Date | null }>>('SELECT "processedAt" FROM "PaymentWebhookEvent" WHERE "provider" = $1 AND "eventId" = $2 FOR UPDATE', "STRIPE", event.id);
      if (rows[0]?.processedAt) return { received: true, duplicate: true };
      const object = event.data?.object ?? {};
      if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type!)) await this.completeCheckout(tx, object);
      if (["payment_intent.payment_failed", "checkout.session.async_payment_failed"].includes(event.type!)) {
        const id = object.metadata?.paymentId;
        if (id) {
          const payment = await tx.payment.findUnique({ where: { id } });
          if (payment && payment.status !== "SUCCEEDED" && payment.status !== "REFUNDED") {
            const changed = await tx.payment.updateMany({ where: { id, status: { in: ["PENDING", "FAILED"] } }, data: { status: "FAILED" } });
            if (changed.count) await tx.notification.createMany({ data: [{ userId: payment.userId, type: "PAYMENT_FAILED", title: "Payment failed", body: "Your payment could not be completed. No new paid access was activated.", dedupeKey: `payment-failed:${id}` }], skipDuplicates: true });
          }
        }
      }
      if (event.type === "charge.refunded") await this.refundRecords(tx, object);
      if (event.type === "invoice.paid") await this.recordInvoice(tx, object);
      await tx.paymentWebhookEvent.update({ where: { provider_eventId: { provider: "STRIPE", eventId: event.id! } }, data: { processedAt: new Date() } });
      return { received: true };
    }, { timeout: 15000 });
  }

  async selectCentre(userId: string, centreId: string) {
    if (!await this.prisma.examCentre.findFirst({ where: { id: centreId, isPublished: true } })) throw new BadRequestException("Published centre not found");
    const now = new Date();
    const current = await this.prisma.subscription.findFirst({ where: { userId, status: "ACTIVE", plan: { name: "Premium" }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { createdAt: "desc" } });
    if (!current) throw new BadRequestException("Active Premium subscription required");
    if (current.centreId && current.centreId !== centreId) throw new BadRequestException("The purchased centre cannot be changed during this access period");
    const result = await this.prisma.subscription.updateMany({ where: { id: current.id, userId, status: "ACTIVE", centreId: null }, data: { centreId } });
    if (!result.count && current.centreId !== centreId) throw new BadRequestException("Centre already selected; refresh your account");
    return this.subscription(userId);
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
    if (refund.status === "succeeded") await this.prisma.$transaction(tx => this.refundRecords(tx, { id: refund.id, payment_intent: payment.providerPaymentId, amount_refunded: Number(refund.amount ?? payment.amountCents) }));
    else await this.prisma.refund.upsert({ where: { providerRefundId: refund.id }, create: { paymentId: payment.id, providerRefundId: refund.id, amountCents: Number(refund.amount ?? payment.amountCents), status: "PENDING" }, update: {} });
    return { success: true, refundId: refund.id };
  }

  private async findCoupon(code: string, currency: string) {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string; code: string; percentOff: number | null; amountOffCents: number | null; currency: string | null; maxRedemptions: number | null; redeemCount: number; expiresAt: Date | null }>>('SELECT "id", "code", "percentOff", "amountOffCents", "currency", "maxRedemptions", "redeemCount", "expiresAt" FROM "Coupon" WHERE UPPER("code") = UPPER($1) AND "active" = true LIMIT 1', code.trim());
    const coupon = rows[0];
    if (!coupon || (coupon.expiresAt && coupon.expiresAt <= new Date()) || (coupon.maxRedemptions !== null && coupon.redeemCount >= coupon.maxRedemptions)) throw new BadRequestException("Coupon is invalid or expired");
    if (coupon.currency && coupon.currency !== currency) throw new BadRequestException("Coupon currency does not match the plan");
    return coupon;
  }

  private async completeCheckout(tx: Prisma.TransactionClient, session: StripeResponse) {
    // Signed webhooks are necessary but not sufficient: asynchronous unpaid
    // checkout completion must not activate access.
    if (!["paid", "no_payment_required"].includes(String(session.payment_status))) return;
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "Payment" WHERE "checkoutSessionId" = $1 FOR UPDATE', session.id ?? "");
    if (!rows[0]) throw new BadRequestException("Checkout payment not found");
    const payment = await tx.payment.findUnique({ where: { id: rows[0].id }, include: { plan: true } });
    if (!payment || payment.status === "SUCCEEDED" || payment.status === "REFUNDED") return;
    if (session.amount_total !== payment.amountCents || String(session.currency).toUpperCase() !== payment.currency.toUpperCase()) throw new BadRequestException("Checkout amount or currency mismatch");
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const centreId = payment.plan.name === "Premium" && typeof metadata.centreId === "string" ? metadata.centreId : null;
    if (payment.plan.name === "Premium" && !centreId) throw new BadRequestException("Premium payment needs its purchased centre");
    const now = new Date();
    const subscription = await tx.subscription.create({ data: { userId: payment.userId, planId: payment.planId, centreId, status: "ACTIVE", provider: "STRIPE", providerRef: typeof session.payment_intent === "string" ? session.payment_intent : session.id, startsAt: now, expiresAt: new Date(now.getTime() + payment.plan.durationHours * 3600000) } });
    await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", checkoutSessionId: session.id, subscriptionId: subscription.id, providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : session.id } });
    if (typeof metadata.couponCode === "string") await tx.coupon.updateMany({ where: { code: metadata.couponCode.toUpperCase(), active: true }, data: { redeemCount: { increment: 1 } } });
    const attribution = await tx.referralAttribution.findUnique({ where: { referredUserId: payment.userId }, include: { code: true } });
    if (attribution && attribution.code.ownerUserId !== payment.userId) {
      const cents = Math.floor(payment.amountCents * attribution.code.commissionBps / 10000);
      if (cents > 0) await tx.commission.upsert({ where: { paymentId: payment.id }, update: {}, create: { referralCodeId: attribution.codeId, referredUserId: payment.userId, paymentId: payment.id, amountCents: payment.amountCents, commissionCents: cents } });
    }
    await tx.notification.createMany({ data: [{ userId: payment.userId, type: "PAYMENT_SUCCEEDED", title: "Your preparation access is active", body: `${payment.plan.name} is active until ${subscription.expiresAt!.toISOString().slice(0, 10)}.`, dedupeKey: `payment-paid:${payment.id}` }], skipDuplicates: true });
  }

  private async refundRecords(tx: Prisma.TransactionClient, object: StripeResponse) {
    if (typeof object.payment_intent !== "string") return;
    const payment = await tx.payment.findFirst({ where: { providerPaymentId: object.payment_intent } });
    if (!payment) return;
    const amount = Number(object.amount_refunded ?? object.amount ?? 0);
    const full = amount >= payment.amountCents;
    if (full) {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
      if (payment.subscriptionId) await tx.subscription.update({ where: { id: payment.subscriptionId }, data: { status: "REFUNDED" } });
    }
    await tx.commission.updateMany({ where: { paymentId: payment.id, status: "PENDING" }, data: { status: full ? "REVERSED" : "REFUND_REVIEW" } });
    await tx.commission.updateMany({ where: { paymentId: payment.id, status: "PAID" }, data: { status: "REFUND_REVIEW" } });
    if (object.id) await tx.refund.upsert({ where: { providerRefundId: object.id }, create: { paymentId: payment.id, providerRefundId: object.id, amountCents: amount, status: "SUCCEEDED" }, update: { amountCents: amount } });
    await tx.notification.createMany({ data: [{ userId: payment.userId, type: "REFUND", title: "Refund update", body: full ? "Your payment was refunded and paid access was revoked." : "A partial refund was recorded.", dedupeKey: `refund:${object.id}:${amount}` }], skipDuplicates: true });
  }

  private async recordInvoice(tx: Prisma.TransactionClient, invoice: StripeResponse) {
    const metadata = invoice.metadata ?? {}; const paymentIntent = typeof invoice.payment_intent === "string" ? invoice.payment_intent : ""; const paymentRows = await tx.$queryRawUnsafe<Array<{ id: string; userId: string }>>('SELECT "id", "userId" FROM "Payment" WHERE "id" = $1 OR "providerPaymentId" = $2 LIMIT 1', metadata.paymentId ?? "", paymentIntent); const payment = paymentRows[0]; if (!payment || !invoice.id) return;
    await tx.$executeRawUnsafe('INSERT INTO "Invoice" ("id", "userId", "paymentId", "providerInvoiceId", "number", "amountCents", "currency", "status", "invoiceUrl", "issuedAt", "paidAt") VALUES ($1,$2,$3,$4,$5,$6,$7,\'PAID\',$8,NOW(),NOW()) ON CONFLICT ("providerInvoiceId") DO UPDATE SET "status" = \'PAID\', "paidAt" = NOW(), "invoiceUrl" = EXCLUDED."invoiceUrl"', randomUUID(), payment.userId, payment.id, invoice.id, typeof invoice.number === "string" ? invoice.number : null, Number(invoice.amount_paid ?? invoice.amount_paid ?? 0), typeof invoice.currency === "string" ? invoice.currency : "eur", typeof invoice.hosted_invoice_url === "string" ? invoice.hosted_invoice_url : null);
  }

  private checkoutUnavailable(): never { throw new ServiceUnavailableException("Payment checkout is not configured. Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET before enabling live billing."); }
}
