ALTER TABLE "payout_methods"
ADD COLUMN "stripeConnectedAccountId" TEXT;

CREATE INDEX "payout_methods_stripeConnectedAccountId_idx"
ON "payout_methods"("stripeConnectedAccountId");
