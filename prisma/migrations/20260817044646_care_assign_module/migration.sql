-- AlterEnum
ALTER TYPE "CareModuleProgressStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "care_module_progress" ADD COLUMN     "assignedById" TEXT;

-- AddForeignKey
ALTER TABLE "care_module_progress" ADD CONSTRAINT "care_module_progress_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
