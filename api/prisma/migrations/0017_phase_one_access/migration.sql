-- Additive migration: keep plan IDs/names, money, purchased centre and expiry
-- unchanged so old receipts, subscriptions and pending Stripe payments survive.
BEGIN;
ALTER TABLE "Plan" ADD COLUMN "tier" TEXT;
UPDATE "Plan" SET "tier" = 'Basic' WHERE "name" IN ('Basic', 'Premium');
UPDATE "Plan" SET "tier" = 'Premium' WHERE "name" = 'Diamond';
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_tier_check" CHECK ("tier" IS NULL OR "tier" IN ('Basic', 'Premium'));

CREATE TABLE "RouteTrial" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "routeId" TEXT NOT NULL REFERENCES "Route"("id") ON DELETE RESTRICT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RouteTrial_24_hours" CHECK ("expiresAt" = "startedAt" + INTERVAL '24 hours')
);
CREATE INDEX "RouteTrial_routeId_idx" ON "RouteTrial"("routeId");

-- Prices explicitly approved by the owner. Retire only the old offers from
-- new checkout; their IDs, amounts, duration and subscriptions stay intact.
UPDATE "Plan" SET "isActive" = false WHERE "name" IN ('Basic', 'Premium', 'Diamond');
INSERT INTO "Plan" ("id", "name", "tier", "durationHours", "priceCents", "currency", "isActive") VALUES
 ('basic_1day', 'Basic 1 day', 'Basic', 24, 200, 'EUR', true),
 ('basic_1week', 'Basic 1 week', 'Basic', 168, 400, 'EUR', true),
 ('basic_1month', 'Basic 1 month', 'Basic', 720, 600, 'EUR', true),
 ('basic_3months', 'Basic 3 months', 'Basic', 2160, 800, 'EUR', true),
 ('premium_1day', 'Premium 1 day', 'Premium', 24, 300, 'EUR', true),
 ('premium_1week', 'Premium 1 week', 'Premium', 168, 600, 'EUR', true),
 ('premium_1month', 'Premium 1 month', 'Premium', 720, 900, 'EUR', true),
 ('premium_3months', 'Premium 3 months', 'Premium', 2160, 1200, 'EUR', true)
ON CONFLICT ("name") DO NOTHING;
COMMIT;
