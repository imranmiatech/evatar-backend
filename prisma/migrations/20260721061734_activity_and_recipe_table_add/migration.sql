/*
  Warnings:

  - You are about to drop the column `maxAgeMonths` on the `Recipe` table. All the data in the column will be lost.
  - You are about to drop the column `minAgeMonths` on the `Recipe` table. All the data in the column will be lost.
  - You are about to drop the `ActivityTemplate` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ActivityLocation" AS ENUM ('INDOOR', 'OUTDOOR', 'GROUP');

-- CreateEnum
CREATE TYPE "EnergyLevel" AS ENUM ('LOW', 'MEDIUM', 'MEDIUM_HIGH', 'HIGH');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterEnum
ALTER TYPE "RecipeMealType" ADD VALUE 'FAMILY';

-- DropIndex
DROP INDEX "Recipe_category_idx";

-- DropIndex
DROP INDEX "Recipe_isPublished_idx";

-- DropIndex
DROP INDEX "Recipe_mealType_idx";

-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "maxAgeMonths",
DROP COLUMN "minAgeMonths",
ADD COLUMN     "difficulty" "Difficulty",
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nutritionalFocus" TEXT[],
ALTER COLUMN "category" SET DEFAULT 'OTHER',
ALTER COLUMN "safetyNotes" DROP NOT NULL,
ALTER COLUMN "safetyNotes" DROP DEFAULT,
ALTER COLUMN "safetyNotes" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "RecipeIngredient" ADD COLUMN     "amount" TEXT,
ADD COLUMN     "substitute" TEXT;

-- AlterTable
ALTER TABLE "RecipeStep" ADD COLUMN     "description" TEXT,
ADD COLUMN     "stepNumber" INTEGER,
ALTER COLUMN "body" SET DEFAULT '';

-- DropTable
DROP TABLE "ActivityTemplate";

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "detail" JSONB,
    "minAgeMonths" INTEGER,
    "maxAgeMonths" INTEGER,
    "durationMin" INTEGER,
    "durationMax" INTEGER,
    "energyLevel" "EnergyLevel",
    "location" "ActivityLocation"[],
    "connectionMoment" TEXT,
    "whyThisActivity" TEXT,
    "caregiverPrompts" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityBenefit" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,

    CONSTRAINT "ActivityBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityStep" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "ActivityStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityProgression" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "ActivityProgression_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_slug_key" ON "Activity"("slug");

-- CreateIndex
CREATE INDEX "ActivityBenefit_activityId_idx" ON "ActivityBenefit"("activityId");

-- CreateIndex
CREATE INDEX "ActivityStep_activityId_idx" ON "ActivityStep"("activityId");

-- CreateIndex
CREATE INDEX "ActivityProgression_activityId_idx" ON "ActivityProgression"("activityId");

-- AddForeignKey
ALTER TABLE "ActivityBenefit" ADD CONSTRAINT "ActivityBenefit_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityStep" ADD CONSTRAINT "ActivityStep_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityProgression" ADD CONSTRAINT "ActivityProgression_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
