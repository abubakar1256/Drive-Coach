CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "userId" TEXT,
  "centreSlug" TEXT,
  "routeSlug" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_createdAt_idx" ON "AnalyticsEvent"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_centreSlug_createdAt_idx" ON "AnalyticsEvent"("centreSlug", "createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_routeSlug_createdAt_idx" ON "AnalyticsEvent"("routeSlug", "createdAt");
