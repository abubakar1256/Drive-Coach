CREATE TABLE "DrivingSkill" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DrivingSkill_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DrivingSkill_code_key" ON "DrivingSkill"("code");

CREATE TABLE "Weakness" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Weakness_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Weakness_code_key" ON "Weakness"("code");
CREATE INDEX "Weakness_skillId_active_idx" ON "Weakness"("skillId", "active");

CREATE TABLE "VerifiedTip" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "voiceTextNl" TEXT,
  "voiceTextFr" TEXT,
  "voiceTextEn" TEXT NOT NULL,
  "triggerTypes" TEXT[] NOT NULL,
  "minTriggerDistanceM" INTEGER,
  "maxTriggerDistanceM" INTEGER,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "cooldownSeconds" INTEGER NOT NULL DEFAULT 90,
  "country" TEXT NOT NULL DEFAULT 'BE',
  "region" TEXT NOT NULL DEFAULT 'BE-FL',
  "legalClaim" TEXT,
  "source" TEXT,
  "sourceReference" TEXT,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "adminApproved" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VerifiedTip_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VerifiedTip_code_key" ON "VerifiedTip"("code");
CREATE INDEX "VerifiedTip_skillId_verified_adminApproved_idx" ON "VerifiedTip"("skillId", "verified", "adminApproved");

CREATE TABLE "WeaknessTip" (
  "weaknessId" TEXT NOT NULL,
  "tipId" TEXT NOT NULL,
  CONSTRAINT "WeaknessTip_pkey" PRIMARY KEY ("weaknessId", "tipId")
);

CREATE TABLE "RoutePointFeature" (
  "id" TEXT NOT NULL,
  "routePointId" TEXT NOT NULL,
  "featureCode" TEXT NOT NULL,
  "complexity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "verified" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RoutePointFeature_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoutePointFeature_routePointId_featureCode_key" ON "RoutePointFeature"("routePointId", "featureCode");
CREATE INDEX "RoutePointFeature_featureCode_verified_idx" ON "RoutePointFeature"("featureCode", "verified");

CREATE TABLE "RouteSkillCoverage" (
  "id" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "coverageWeight" INTEGER NOT NULL DEFAULT 1,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "RouteSkillCoverage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RouteSkillCoverage_routeId_skillId_key" ON "RouteSkillCoverage"("routeId", "skillId");
CREATE INDEX "RouteSkillCoverage_skillId_verified_idx" ON "RouteSkillCoverage"("skillId", "verified");

CREATE TABLE "UserWeaknessHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "weaknessId" TEXT NOT NULL,
  "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSessionId" TEXT,
  CONSTRAINT "UserWeaknessHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserWeaknessHistory_userId_weaknessId_key" ON "UserWeaknessHistory"("userId", "weaknessId");
CREATE INDEX "UserWeaknessHistory_userId_lastSeenAt_idx" ON "UserWeaknessHistory"("userId", "lastSeenAt");

CREATE TABLE "TipDeliveryHistory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tipId" TEXT NOT NULL,
  "sessionId" TEXT,
  "routePointId" TEXT,
  "deliveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TipDeliveryHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TipDeliveryHistory_userId_deliveredAt_idx" ON "TipDeliveryHistory"("userId", "deliveredAt");
CREATE INDEX "TipDeliveryHistory_tipId_deliveredAt_idx" ON "TipDeliveryHistory"("tipId", "deliveredAt");

CREATE TABLE "UserSkillProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "skillId" TEXT NOT NULL,
  "practiceCount" INTEGER NOT NULL DEFAULT 0,
  "weaknessCount" INTEGER NOT NULL DEFAULT 0,
  "lastPractisedAt" TIMESTAMP(3),
  CONSTRAINT "UserSkillProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserSkillProgress_userId_skillId_key" ON "UserSkillProgress"("userId", "skillId");
CREATE INDEX "UserSkillProgress_userId_weaknessCount_idx" ON "UserSkillProgress"("userId", "weaknessCount");

CREATE TABLE "RouteRecommendation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "routeId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "focusSkillCode" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RouteRecommendation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RouteRecommendation_userId_generatedAt_idx" ON "RouteRecommendation"("userId", "generatedAt");

ALTER TABLE "Weakness" ADD CONSTRAINT "Weakness_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "DrivingSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerifiedTip" ADD CONSTRAINT "VerifiedTip_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "DrivingSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeaknessTip" ADD CONSTRAINT "WeaknessTip_weaknessId_fkey" FOREIGN KEY ("weaknessId") REFERENCES "Weakness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeaknessTip" ADD CONSTRAINT "WeaknessTip_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "VerifiedTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutePointFeature" ADD CONSTRAINT "RoutePointFeature_routePointId_fkey" FOREIGN KEY ("routePointId") REFERENCES "RoutePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteSkillCoverage" ADD CONSTRAINT "RouteSkillCoverage_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteSkillCoverage" ADD CONSTRAINT "RouteSkillCoverage_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "DrivingSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserWeaknessHistory" ADD CONSTRAINT "UserWeaknessHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserWeaknessHistory" ADD CONSTRAINT "UserWeaknessHistory_weaknessId_fkey" FOREIGN KEY ("weaknessId") REFERENCES "Weakness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipDeliveryHistory" ADD CONSTRAINT "TipDeliveryHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TipDeliveryHistory" ADD CONSTRAINT "TipDeliveryHistory_tipId_fkey" FOREIGN KEY ("tipId") REFERENCES "VerifiedTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "UserSkillProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserSkillProgress" ADD CONSTRAINT "UserSkillProgress_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "DrivingSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteRecommendation" ADD CONSTRAINT "RouteRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RouteRecommendation" ADD CONSTRAINT "RouteRecommendation_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE CASCADE ON UPDATE CASCADE;
