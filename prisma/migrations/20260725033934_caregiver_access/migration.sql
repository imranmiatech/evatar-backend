-- CreateEnum
CREATE TYPE "CaregiverAccessRole" AS ENUM ('NANNY', 'PARENT', 'FAMILY_MEMBER');

-- CreateEnum
CREATE TYPE "CaregiverRelationship" AS ENUM ('GRANDMOTHER', 'GUARDIAN', 'GODPARENT', 'GRANDFATHER', 'UNCLE', 'SIBLING', 'AUNT', 'OTHER');

-- CreateEnum
CREATE TYPE "CaregiverAccessStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CaregiverInviteChannel" AS ENUM ('EMAIL', 'WHATSAPP', 'LINK', 'IN_APP');

-- CreateTable
CREATE TABLE "CaregiverAccess" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "invitedUserId" TEXT,
    "invitedByUserId" TEXT NOT NULL,
    "invitedEmail" TEXT,
    "invitedPhone" TEXT,
    "inviteTokenHash" TEXT,
    "role" "CaregiverAccessRole" NOT NULL,
    "relationship" "CaregiverRelationship",
    "status" "CaregiverAccessStatus" NOT NULL DEFAULT 'PENDING',
    "inviteChannel" "CaregiverInviteChannel" NOT NULL DEFAULT 'LINK',
    "dailyActivitiesRecipes" BOOLEAN NOT NULL DEFAULT false,
    "manageDailyPlans" BOOLEAN NOT NULL DEFAULT false,
    "manageGroceryLists" BOOLEAN NOT NULL DEFAULT false,
    "editChildProfile" BOOLEAN NOT NULL DEFAULT false,
    "accessChildInsights" BOOLEAN NOT NULL DEFAULT false,
    "addRemoveChildren" BOOLEAN NOT NULL DEFAULT false,
    "manageBilling" BOOLEAN NOT NULL DEFAULT false,
    "manageCareTeam" BOOLEAN NOT NULL DEFAULT false,
    "manageGroceryOrders" BOOLEAN NOT NULL DEFAULT false,
    "groceryOrdering" BOOLEAN NOT NULL DEFAULT false,
    "careLearningAccess" BOOLEAN NOT NULL DEFAULT false,
    "nannyDevelopment" BOOLEAN NOT NULL DEFAULT false,
    "memoriesStories" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaregiverAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverAccess_inviteTokenHash_key" ON "CaregiverAccess"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "CaregiverAccess_childId_status_idx" ON "CaregiverAccess"("childId", "status");

-- CreateIndex
CREATE INDEX "CaregiverAccess_invitedUserId_status_idx" ON "CaregiverAccess"("invitedUserId", "status");

-- CreateIndex
CREATE INDEX "CaregiverAccess_invitedByUserId_idx" ON "CaregiverAccess"("invitedByUserId");

-- CreateIndex
CREATE INDEX "CaregiverAccess_invitedEmail_idx" ON "CaregiverAccess"("invitedEmail");

-- CreateIndex
CREATE INDEX "CaregiverAccess_invitedPhone_idx" ON "CaregiverAccess"("invitedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "CaregiverAccess_childId_invitedUserId_role_key" ON "CaregiverAccess"("childId", "invitedUserId", "role");

-- AddForeignKey
ALTER TABLE "CaregiverAccess" ADD CONSTRAINT "CaregiverAccess_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverAccess" ADD CONSTRAINT "CaregiverAccess_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaregiverAccess" ADD CONSTRAINT "CaregiverAccess_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
