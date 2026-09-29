ALTER TABLE "Route" ADD COLUMN "sourceLabel" TEXT;
ALTER TABLE "Route" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "Route" ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED';

CREATE TABLE "OfficialPassagePoint" (
  "id" TEXT NOT NULL,
  "centreId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "municipality" TEXT NOT NULL,
  "junction" TEXT NOT NULL,
  "sourceLabel" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "sourceRevision" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficialPassagePoint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OfficialPassagePoint_centreId_sequence_key" ON "OfficialPassagePoint"("centreId", "sequence");
CREATE INDEX "OfficialPassagePoint_centreId_verificationStatus_idx" ON "OfficialPassagePoint"("centreId", "verificationStatus");
ALTER TABLE "OfficialPassagePoint" ADD CONSTRAINT "OfficialPassagePoint_centreId_fkey" FOREIGN KEY ("centreId") REFERENCES "ExamCentre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
