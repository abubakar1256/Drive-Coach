BEGIN;
CREATE TABLE "PreparationProfile" (
 "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "preferredName" TEXT CHECK ("preferredName" IS NULL OR char_length(btrim("preferredName")) BETWEEN 1 AND 80),
 "age" INTEGER CHECK ("age" IS NULL OR "age" BETWEEN 1 AND 120),
 "centreId" TEXT REFERENCES "ExamCentre"("id") ON DELETE SET NULL ON UPDATE CASCADE,
 "homeTown" TEXT CHECK ("homeTown" IS NULL OR char_length(btrim("homeTown")) BETWEEN 2 AND 80),
 "preferredLevel" TEXT NOT NULL DEFAULT 'BEGINNER' CHECK ("preferredLevel" IN ('BEGINNER','INTERMEDIATE','DIFFICULT')),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" >= 1),
 "revision" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PreparationProfile_centreId_idx" ON "PreparationProfile"("centreId");
-- Additive private preferences only. No backfill, access grant, route mutation,
-- price change, trial reset or legacy-account onboarding requirement.
COMMIT;
