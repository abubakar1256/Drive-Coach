CREATE TABLE IF NOT EXISTS "DrivingSchool" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "email" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DrivingSchool_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DrivingSchool_slug_key" UNIQUE ("slug"),
  CONSTRAINT "DrivingSchool_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "InstructorProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InstructorProfile_userId_key" UNIQUE ("userId"),
  CONSTRAINT "InstructorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InstructorProfile_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "DrivingSchool"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "InstructorProfile_schoolId_idx" ON "InstructorProfile"("schoolId");
CREATE TABLE IF NOT EXISTS "StudentEnrollment" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'INVITED',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joinedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentEnrollment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentEnrollment_instructorId_studentId_key" UNIQUE ("instructorId", "studentId"),
  CONSTRAINT "StudentEnrollment_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "InstructorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StudentEnrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentEnrollment_studentId_idx" ON "StudentEnrollment"("studentId");

CREATE TABLE IF NOT EXISTS "ReferralCode" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "schoolId" TEXT,
  "commissionBps" INTEGER NOT NULL DEFAULT 1000,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferralCode_code_key" UNIQUE ("code"),
  CONSTRAINT "ReferralCode_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReferralCode_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "DrivingSchool"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "ReferralAttribution" (
  "id" TEXT NOT NULL,
  "codeId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferralAttribution_referredUserId_key" UNIQUE ("referredUserId"),
  CONSTRAINT "ReferralAttribution_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "Commission" (
  "id" TEXT NOT NULL,
  "referralCodeId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "paymentId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "commissionCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Commission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Commission_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Commission_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Commission_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Commission_referralCodeId_status_idx" ON "Commission"("referralCodeId", "status");
