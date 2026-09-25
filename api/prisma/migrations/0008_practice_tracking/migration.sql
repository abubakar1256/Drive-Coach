CREATE TABLE IF NOT EXISTS "PracticeTrackPoint" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION NOT NULL,
  "longitude" DOUBLE PRECISION NOT NULL,
  "speedKph" DOUBLE PRECISION,
  "accuracyM" DOUBLE PRECISION,
  "recordedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PracticeTrackPoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PracticeTrackPoint_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PracticeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "PracticeTrackPoint_sessionId_recordedAt_idx" ON "PracticeTrackPoint"("sessionId", "recordedAt");
