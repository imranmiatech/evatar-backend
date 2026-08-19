-- AlterEnum
ALTER TYPE "CareModuleProgressStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- AlterTable
ALTER TABLE "care_module_progress" ADD COLUMN IF NOT EXISTS "assignedById" TEXT;

-- AddForeignKey
ALTER TABLE "care_module_progress" DROP CONSTRAINT IF EXISTS "care_module_progress_assignedById_fkey";
ALTER TABLE "care_module_progress" ADD CONSTRAINT "care_module_progress_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
