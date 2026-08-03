-- CreateEnum
CREATE TYPE "KitchenItemAdminStatus" AS ENUM ('ACTIVE', 'ARCHIVE');

-- AlterTable
ALTER TABLE "kitchen_items" ADD COLUMN "adminStatus" "KitchenItemAdminStatus";
