-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CaregiverRelationship" ADD VALUE 'FATHER';
ALTER TYPE "CaregiverRelationship" ADD VALUE 'MOTHER';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RewardLedgerSourceType" ADD VALUE 'BEDTIME_STORY';
ALTER TYPE "RewardLedgerSourceType" ADD VALUE 'GROCERY_ORDER_COMPLETE';
ALTER TYPE "RewardLedgerSourceType" ADD VALUE 'SEND_NANNY_APPRECIATION';

-- CreateTable
CREATE TABLE "nanny_tips" (
    "id" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "nannyUserId" TEXT NOT NULL,
    "childId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AED',
    "paymentIntentId" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "nanny_tips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nanny_tips_paymentIntentId_key" ON "nanny_tips"("paymentIntentId");

-- CreateIndex
CREATE INDEX "nanny_tips_senderUserId_idx" ON "nanny_tips"("senderUserId");

-- CreateIndex
CREATE INDEX "nanny_tips_nannyUserId_idx" ON "nanny_tips"("nannyUserId");

-- CreateIndex
CREATE INDEX "nanny_tips_status_idx" ON "nanny_tips"("status");

-- AddForeignKey
ALTER TABLE "nanny_tips" ADD CONSTRAINT "nanny_tips_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nanny_tips" ADD CONSTRAINT "nanny_tips_nannyUserId_fkey" FOREIGN KEY ("nannyUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nanny_tips" ADD CONSTRAINT "nanny_tips_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;
