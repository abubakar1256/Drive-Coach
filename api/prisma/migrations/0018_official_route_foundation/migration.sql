BEGIN;
ALTER TABLE "Route" ADD COLUMN "foundation" JSONB;
ALTER TABLE "OfficialPassagePoint" ADD COLUMN "sourceFingerprint" TEXT, ADD COLUMN "sourceCheckedAt" TIMESTAMP(3), ADD COLUMN "duplicateOfSequence" INTEGER;
CREATE TABLE "CentreDeparture" (
 "centreId" TEXT PRIMARY KEY REFERENCES "ExamCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "latitude" DOUBLE PRECISION NOT NULL CHECK ("latitude" BETWEEN -90 AND 90),
 "longitude" DOUBLE PRECISION NOT NULL CHECK ("longitude" BETWEEN -180 AND 180),
 "label" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL, "notes" TEXT NOT NULL,
 "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
 "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
 CONSTRAINT "departure_review" CHECK ("verificationStatus" != 'VERIFIED' OR ("reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL))
);
-- No route geometry, publication, financial record or subscription is changed.
COMMIT;
