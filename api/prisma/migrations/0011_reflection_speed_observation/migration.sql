ALTER TABLE "SelfReflection"
  ADD COLUMN IF NOT EXISTS "observedSpeedKph" INTEGER,
  ADD COLUMN IF NOT EXISTS "speedLimitKph" INTEGER;

ALTER TABLE "SelfReflection"
  ADD CONSTRAINT "SelfReflection_observedSpeedKph_check"
  CHECK ("observedSpeedKph" IS NULL OR ("observedSpeedKph" >= 0 AND "observedSpeedKph" <= 300));

ALTER TABLE "SelfReflection"
  ADD CONSTRAINT "SelfReflection_speedLimitKph_check"
  CHECK ("speedLimitKph" IS NULL OR ("speedLimitKph" >= 0 AND "speedLimitKph" <= 200));
