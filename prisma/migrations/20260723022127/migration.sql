-- AlterTable
ALTER TABLE "Child" ADD COLUMN     "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "dietaryNotes" TEXT,
ADD COLUMN     "favoriteThings" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "medicalNotes" TEXT,
ADD COLUMN     "personality" TEXT,
ADD COLUMN     "sleepRoutine" TEXT,
ADD COLUMN     "weight" TEXT;
