BEGIN;
CREATE TABLE "PreparationCoverage" (
 "routeId" TEXT PRIMARY KEY REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "routeVersion" INTEGER NOT NULL, "fingerprint" TEXT NOT NULL, "skills" TEXT[] NOT NULL,
 "complexity" TEXT NOT NULL CHECK ("complexity" IN ('LOW','MEDIUM','HIGH')),
 "sourceUrl" TEXT NOT NULL, "notes" TEXT NOT NULL, "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "reviewedBy" TEXT NOT NULL
);
CREATE TABLE "HometownRoute" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "sourceCentreId" TEXT NOT NULL, "placeId" TEXT NOT NULL, "placeName" TEXT NOT NULL,
 "level" TEXT NOT NULL CHECK ("level" IN ('BEGINNER','INTERMEDIATE','DIFFICULT')),
 "focusCodes" TEXT[] NOT NULL, "snapshot" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "HometownRoute_userId_createdAt_idx" ON "HometownRoute"("userId","createdAt");
CREATE UNIQUE INDEX "HometownRoute_id_userId_key" ON "HometownRoute"("id","userId");
CREATE TABLE "HometownSession" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "routeId" TEXT NOT NULL,
 "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMP(3),
 "completionPct" INTEGER NOT NULL DEFAULT 0 CHECK ("completionPct" BETWEEN 0 AND 100),
 "progressM" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("progressM" >= 0),
 "visitedPoints" INTEGER NOT NULL DEFAULT 0 CHECK ("visitedPoints" >= 0),
 "completionKind" TEXT NOT NULL DEFAULT 'TRACKING' CHECK ("completionKind" IN ('TRACKING','ENDED','COMPLETED')),
 "lastSampleAt" TIMESTAMP(3), "reflection" JSONB, "reflectedAt" TIMESTAMP(3),
 FOREIGN KEY ("routeId","userId") REFERENCES "HometownRoute"("id","userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "HometownSession_userId_startedAt_idx" ON "HometownSession"("userId","startedAt");
CREATE TABLE "PreparationGeneration" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "requestKey" TEXT NOT NULL, "state" TEXT NOT NULL DEFAULT 'PENDING' CHECK ("state" IN ('PENDING','SUCCEEDED','FAILED')),
 "resultId" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "PreparationGeneration_userId_requestKey_key" ON "PreparationGeneration"("userId","requestKey");
CREATE INDEX "PreparationGeneration_userId_createdAt_idx" ON "PreparationGeneration"("userId","createdAt");
CREATE TABLE "PreparationRoutingBudget" ("bucket" TEXT PRIMARY KEY, "reserved" INTEGER NOT NULL DEFAULT 0 CHECK ("reserved" >= 0));
-- No public routes, historical snapshots, entitlements, trials or prices change.
COMMIT;
