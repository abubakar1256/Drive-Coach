ALTER TABLE "User" ADD COLUMN "examDate" TIMESTAMP(3), ADD COLUMN "practiceReminderAt" TIMESTAMP(3), ADD COLUMN "remindersEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Subscription" ADD COLUMN "centreId" TEXT REFERENCES "ExamCentre"("id") ON DELETE SET NULL;
ALTER TABLE "Route" ADD COLUMN "reviewedBy" TEXT;
ALTER TABLE "RoutePoint" ADD COLUMN "bearing" DOUBLE PRECISION;
ALTER TABLE "PracticeSession" ADD COLUMN "routeSnapshot" JSONB, ADD COLUMN "progressM" DOUBLE PRECISION NOT NULL DEFAULT 0, ADD COLUMN "visitedPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PracticeSession" ADD COLUMN "completionKind" TEXT NOT NULL DEFAULT 'TRACKING';
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
ALTER TABLE "Commission" ADD COLUMN "paidAt" TIMESTAMP(3), ADD COLUMN "payoutReference" TEXT;
-- Existing duplicate commissions require explicit reconciliation; never silently
-- delete financial records while adding payment-level idempotency.
CREATE UNIQUE INDEX "Commission_paymentId_key" ON "Commission"("paymentId");
ALTER TABLE "Payment" ADD COLUMN "schoolId" TEXT REFERENCES "DrivingSchool"("id") ON DELETE SET NULL;
CREATE TABLE "RouteAssignment" (
  "id" TEXT PRIMARY KEY, "enrollmentId" TEXT NOT NULL REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE,
  "routeId" TEXT NOT NULL REFERENCES "Route"("id") ON DELETE CASCADE, "notes" TEXT, "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "RouteAssignment_enrollmentId_routeId_key" ON "RouteAssignment"("enrollmentId", "routeId");
CREATE TABLE "InstructorFeedback" (
  "id" TEXT PRIMARY KEY, "enrollmentId" TEXT NOT NULL REFERENCES "StudentEnrollment"("id") ON DELETE CASCADE,
  "sessionId" TEXT NOT NULL REFERENCES "PracticeSession"("id") ON DELETE CASCADE, "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "InstructorFeedback_enrollmentId_sessionId_key" ON "InstructorFeedback"("enrollmentId", "sessionId");
CREATE UNIQUE INDEX "ReferralCode_school_month_key" ON "ReferralCode"("schoolId", date_trunc('month', "createdAt")) WHERE "schoolId" IS NOT NULL;
