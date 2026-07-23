/*
  Warnings:

  - You are about to drop the column `isVerified` on the `KycDocument` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `KycDocument` table. All the data in the column will be lost.
  - You are about to drop the column `postCode` on the `ParentProfile` table. All the data in the column will be lost.
  - You are about to drop the column `relationType` on the `ParentProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[kycVerificationId,type]` on the table `KycDocument` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `kycVerificationId` to the `KycDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `address` to the `ParentProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `postalCode` to the `ParentProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `relationship` to the `ParentProfile` table without a default value. This is not possible if the table is not empty.
  - Made the column `street` on table `ParentProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `city` on table `ParentProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `state` on table `ParentProfile` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'GRANDFATHER', 'GRANDMOTHER', 'UNCLE', 'AUNT', 'RELATIVE');

-- CreateEnum
CREATE TYPE "IdentityDocType" AS ENUM ('PASSPORT', 'NATIONAL_ID');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'PASSPORT_PAGE';

-- DropForeignKey
ALTER TABLE "KycDocument" DROP CONSTRAINT "KycDocument_userId_fkey";

-- DropIndex
DROP INDEX "KycDocument_userId_type_key";

-- AlterTable
ALTER TABLE "KycDocument" DROP COLUMN "isVerified",
DROP COLUMN "userId",
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "kycVerificationId" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT;

-- AlterTable
ALTER TABLE "ParentProfile" DROP COLUMN "postCode",
DROP COLUMN "relationType",
ADD COLUMN     "address" TEXT NOT NULL,
ADD COLUMN     "postalCode" TEXT NOT NULL,
ADD COLUMN     "relationship" "RelationshipType" NOT NULL,
ALTER COLUMN "street" SET NOT NULL,
ALTER COLUMN "city" SET NOT NULL,
ALTER COLUMN "state" SET NOT NULL;

-- CreateTable
CREATE TABLE "KycVerification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "docType" "IdentityDocType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "faceMatchScore" DOUBLE PRECISION,
    "isLivenessValid" BOOLEAN NOT NULL DEFAULT false,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycVerification_userId_idx" ON "KycVerification"("userId");

-- CreateIndex
CREATE INDEX "KycVerification_status_idx" ON "KycVerification"("status");

-- CreateIndex
CREATE INDEX "KycDocument_kycVerificationId_idx" ON "KycDocument"("kycVerificationId");

-- CreateIndex
CREATE UNIQUE INDEX "KycDocument_kycVerificationId_type_key" ON "KycDocument"("kycVerificationId", "type");

-- AddForeignKey
ALTER TABLE "KycVerification" ADD CONSTRAINT "KycVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_kycVerificationId_fkey" FOREIGN KEY ("kycVerificationId") REFERENCES "KycVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
