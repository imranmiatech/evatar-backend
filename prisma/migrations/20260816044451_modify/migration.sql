/*
  Warnings:

  - You are about to drop the column `coinReward` on the `care_modules` table. All the data in the column will be lost.
  - You are about to drop the column `contentSections` on the `care_modules` table. All the data in the column will be lost.
  - You are about to drop the column `contentTitle` on the `care_modules` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `care_modules` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedMinutes` on the `care_modules` table. All the data in the column will be lost.
  - You are about to drop the column `subtitle` on the `care_modules` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedMaxAgeMonths` on the `care_modules` table. All the data in the column will be lost.
  - You are about to drop the column `suggestedMinAgeMonths` on the `care_modules` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "care_modules_suggestedMinAgeMonths_suggestedMaxAgeMonths_is_idx";

-- AlterTable
ALTER TABLE "care_modules" DROP COLUMN "coinReward",
DROP COLUMN "contentSections",
DROP COLUMN "contentTitle",
DROP COLUMN "description",
DROP COLUMN "estimatedMinutes",
DROP COLUMN "subtitle",
DROP COLUMN "suggestedMaxAgeMonths",
DROP COLUMN "suggestedMinAgeMonths",
ADD COLUMN     "ageGroup" TEXT,
ADD COLUMN     "completionPoints" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "moduleDescriptions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "shortDescription" TEXT;

-- CreateIndex
CREATE INDEX "care_modules_ageGroup_isPublished_idx" ON "care_modules"("ageGroup", "isPublished");
