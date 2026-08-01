/*
  Warnings:

  - The values [SAD] on the enum `ChildMood` will be removed. If these variants are still used in the database, this will fail.
  - The values [FULLY_DONE,PARTLY_DONE,MINIMAL,SKIPPED] on the enum `TaskCompletionRate` will be removed. If these variants are still used in the database, this will fail.
  - The values [ENJOYED,RESISTANT] on the enum `TaskEnjoymentLevel` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ChildMood_new" AS ENUM ('EXCITED', 'HAPPY', 'NEUTRAL', 'TIRED', 'RESISTANT');
ALTER TABLE "DayActivityFeedback" ALTER COLUMN "childMood" TYPE "ChildMood_new" USING ("childMood"::text::"ChildMood_new");
ALTER TYPE "ChildMood" RENAME TO "ChildMood_old";
ALTER TYPE "ChildMood_new" RENAME TO "ChildMood";
DROP TYPE "public"."ChildMood_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskCompletionRate_new" AS ENUM ('FULL_PLATE', 'HALF_PLATE', 'UNTOUCHED');
ALTER TABLE "DayActivityFeedback" ALTER COLUMN "completionRate" TYPE "TaskCompletionRate_new" USING ("completionRate"::text::"TaskCompletionRate_new");
ALTER TYPE "TaskCompletionRate" RENAME TO "TaskCompletionRate_old";
ALTER TYPE "TaskCompletionRate_new" RENAME TO "TaskCompletionRate";
DROP TYPE "public"."TaskCompletionRate_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TaskEnjoymentLevel_new" AS ENUM ('LOVE_IT', 'ENJOY_IT', 'NEUTRAL', 'RELUCTANT');
ALTER TABLE "DayActivityFeedback" ALTER COLUMN "enjoyment" TYPE "TaskEnjoymentLevel_new" USING ("enjoyment"::text::"TaskEnjoymentLevel_new");
ALTER TYPE "TaskEnjoymentLevel" RENAME TO "TaskEnjoymentLevel_old";
ALTER TYPE "TaskEnjoymentLevel_new" RENAME TO "TaskEnjoymentLevel";
DROP TYPE "public"."TaskEnjoymentLevel_old";
COMMIT;
