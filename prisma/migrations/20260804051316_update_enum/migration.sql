-- AlterEnum
ALTER TYPE "Difficulty" ADD VALUE 'DIFFICULT';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ItemUnit" ADD VALUE 'TBSP';
ALTER TYPE "ItemUnit" ADD VALUE 'TSP';
ALTER TYPE "ItemUnit" ADD VALUE 'CUP';
ALTER TYPE "ItemUnit" ADD VALUE 'UNIT';
ALTER TYPE "ItemUnit" ADD VALUE 'MEDIUM';
ALTER TYPE "ItemUnit" ADD VALUE 'LARGE';
ALTER TYPE "ItemUnit" ADD VALUE 'SLICE';
