-- CreateEnum
CREATE TYPE "RewardRuleUserType" AS ENUM ('PARENT', 'NANNY', 'FAMILY_MEMBER', 'ALL');

-- CreateEnum
CREATE TYPE "RewardRuleStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- CreateTable
CREATE TABLE "reward_rules" (
    "id" TEXT NOT NULL,
    "activityKey" TEXT NOT NULL,
    "activityName" TEXT NOT NULL,
    "eligibleUserTypes" "RewardRuleUserType"[],
    "alureiValue" INTEGER NOT NULL,
    "weeklyLimit" INTEGER,
    "status" "RewardRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "internalNotes" TEXT,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reward_rules_activityKey_key" ON "reward_rules"("activityKey");

-- CreateIndex
CREATE INDEX "reward_rules_status_idx" ON "reward_rules"("status");

-- CreateIndex
CREATE INDEX "reward_rules_activityName_idx" ON "reward_rules"("activityName");

-- Seed defaults for the Admin Rewards > Reward Management screen.
INSERT INTO "reward_rules" (
  "id",
  "activityKey",
  "activityName",
  "eligibleUserTypes",
  "alureiValue",
  "weeklyLimit",
  "status",
  "internalNotes",
  "updatedAt"
) VALUES
  ('11111111-1120-4000-8000-000000000001', 'COMPLETE_DAILY_FLOW', 'Complete Daily Flow', ARRAY['PARENT','NANNY']::"RewardRuleUserType"[], 20, 7, 'ACTIVE', 'Default rule for daily flow completion.', CURRENT_TIMESTAMP),
  ('11111111-1120-4000-8000-000000000002', 'COMPLETE_CARE_MODULE', 'Complete Care Module', ARRAY['PARENT','NANNY']::"RewardRuleUserType"[], 50, 10, 'ACTIVE', 'Default rule for completed care module quiz.', CURRENT_TIMESTAMP),
  ('11111111-1120-4000-8000-000000000003', 'RECORD_BEDTIME_STORY', 'Record Bedtime Story', ARRAY['PARENT','FAMILY_MEMBER']::"RewardRuleUserType"[], 15, 6, 'ACTIVE', 'Default rule for bedtime story recording.', CURRENT_TIMESTAMP),
  ('11111111-1120-4000-8000-000000000004', 'WEEKLY_CARE_COMPLETION', 'Weekly Care Completion', ARRAY['ALL']::"RewardRuleUserType"[], 75, 1, 'ACTIVE', 'Default rule for weekly care completion.', CURRENT_TIMESTAMP),
  ('11111111-1120-4000-8000-000000000005', 'PARENT_APPRECIATION', 'Parent Appreciation', ARRAY['NANNY']::"RewardRuleUserType"[], 30, 3, 'ACTIVE', 'Default rule for parent appreciation reward.', CURRENT_TIMESTAMP),
  ('11111111-1120-4000-8000-000000000006', 'DAILY_CARE_LOG', 'Daily Care Log', ARRAY['NANNY']::"RewardRuleUserType"[], 10, 7, 'DISABLED', 'Default disabled rule for daily care log.', CURRENT_TIMESTAMP);
