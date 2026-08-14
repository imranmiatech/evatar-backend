CREATE TYPE "PartnerRequestAdminStatus" AS ENUM ('NEW', 'CONTACTED', 'IN_DISCUSSION', 'DECLINED');

ALTER TABLE "PartnerProfile"
ADD COLUMN "adminStatus" "PartnerRequestAdminStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "adminNote" TEXT;

CREATE INDEX "PartnerProfile_adminStatus_idx" ON "PartnerProfile"("adminStatus");
