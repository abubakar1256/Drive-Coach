ALTER TABLE "VerifiedTip" ADD COLUMN "jurisdiction" TEXT NOT NULL DEFAULT 'BE-FL';
ALTER TABLE "VerifiedTip" ADD COLUMN "ruleVersion" TEXT NOT NULL DEFAULT 'CURRENT_1975';
CREATE INDEX "VerifiedTip_jurisdiction_ruleVersion_idx" ON "VerifiedTip"("jurisdiction", "ruleVersion");
