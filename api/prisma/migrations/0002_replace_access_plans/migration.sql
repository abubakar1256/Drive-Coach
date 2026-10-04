UPDATE "Plan"
SET "isActive" = false
WHERE "name" NOT IN ('Premium', 'Diamond');

INSERT INTO "Plan" ("id", "name", "durationHours", "priceCents", "currency", "isActive")
VALUES
  ('plan_premium', 'Premium', 2160, 1499, 'EUR', true),
  ('plan_diamond', 'Diamond', 2160, 1999, 'EUR', true)
ON CONFLICT ("name") DO UPDATE SET
  "durationHours" = EXCLUDED."durationHours",
  "priceCents" = EXCLUDED."priceCents",
  "currency" = EXCLUDED."currency",
  "isActive" = EXCLUDED."isActive";
