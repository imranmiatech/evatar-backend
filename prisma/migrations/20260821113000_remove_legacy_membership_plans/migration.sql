UPDATE "subscription_plans"
SET "isActive" = false,
    "updatedAt" = NOW()
WHERE "name" IN ('4 child Family Membership', '10 child Family Membership');

DELETE FROM "subscription_plans"
WHERE "name" IN ('4 child Family Membership', '10 child Family Membership')
  AND "id" NOT IN (
    SELECT DISTINCT "planId"
    FROM "user_subscriptions"
    WHERE "planId" IS NOT NULL
  );
