/*
  Warnings:

  - You are about to drop the column `suggestedMaxAgeYears` on the `care_modules` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedMinAgeYears` on the `care_modules` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "care_modules_suggestedMinAgeYears_suggestedMaxAgeYears_isPu_idx";

-- AlterTable
ALTER TABLE "care_modules" DROP COLUMN "suggestedMaxAgeYears",
DROP COLUMN "suggestedMinAgeYears",
ADD COLUMN     "suggestedMaxAgeMonths" INTEGER,
ADD COLUMN     "suggestedMinAgeMonths" INTEGER;

-- CreateIndex
CREATE INDEX "care_modules_suggestedMinAgeMonths_suggestedMaxAgeMonths_is_idx" ON "care_modules"("suggestedMinAgeMonths", "suggestedMaxAgeMonths", "isPublished");
