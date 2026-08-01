-- AlterTable
ALTER TABLE "care_modules" ALTER COLUMN "coinReward" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "care_module_assignments" ADD COLUMN "pointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "pointsAwardedAt" TIMESTAMP(3);
