/*
  Warnings:

  - The values [PHYSICAL_CHALLENGES] on the enum `HealthCondition` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "HealthCondition_new" AS ENUM ('NONE', 'FOOD_ALLERGIES', 'MOBILITY_CONSIDERATIONS');
ALTER TABLE "Child" ALTER COLUMN "healthConditions" TYPE "HealthCondition_new"[] USING ("healthConditions"::text::"HealthCondition_new"[]);
ALTER TYPE "HealthCondition" RENAME TO "HealthCondition_old";
ALTER TYPE "HealthCondition_new" RENAME TO "HealthCondition";
DROP TYPE "public"."HealthCondition_old";
COMMIT;
