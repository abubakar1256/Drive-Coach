ALTER TABLE "SelfReflection"
  ADD COLUMN "overallFeeling" TEXT,
  ADD COLUMN "difficultyCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "difficultyDetails" JSONB,
  ADD COLUMN "instructorFeedback" BOOLEAN,
  ADD COLUMN "instructorCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "instructorNotes" TEXT;
