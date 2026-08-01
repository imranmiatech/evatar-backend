-- AlterTable
ALTER TABLE "care_modules" ADD COLUMN "suggestedMinAgeYears" INTEGER,
ADD COLUMN "suggestedMaxAgeYears" INTEGER;

-- CreateIndex
CREATE INDEX "care_modules_suggestedMinAgeYears_suggestedMaxAgeYears_isPu_idx" ON "care_modules"("suggestedMinAgeYears", "suggestedMaxAgeYears", "isPublished");
