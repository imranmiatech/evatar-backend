/*
  Warnings:

  - The values [FEEDING,SLEEP,BEHAVIOR] on the enum `CareModuleCategory` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "CareModuleAdminStatus" AS ENUM ('ALL', 'PUBLISHED', 'DRAFT');

-- AlterEnum
BEGIN;
CREATE TYPE "CareModuleCategory_new" AS ENUM ('CHILD_SAFETY', 'NUTRITION_FEEDING', 'SLEEP_ROUTINES', 'CHILD_DEVELOPMENT', 'FIRST_AID', 'PLAY_LEARNING', 'COMMUNICATION', 'HEALTH_HYGIENE', 'OTHER');
ALTER TABLE "care_modules" ALTER COLUMN "category" TYPE "CareModuleCategory_new" USING ("category"::text::"CareModuleCategory_new");
ALTER TYPE "CareModuleCategory" RENAME TO "CareModuleCategory_old";
ALTER TYPE "CareModuleCategory_new" RENAME TO "CareModuleCategory";
DROP TYPE "public"."CareModuleCategory_old";
COMMIT;

-- AlterEnum
ALTER TYPE "CareQuestionType" ADD VALUE 'MULTIPLE_CHOICE';

-- AlterTable
ALTER TABLE "care_modules" ADD COLUMN     "adminStatus" "CareModuleAdminStatus" NOT NULL DEFAULT 'DRAFT';
