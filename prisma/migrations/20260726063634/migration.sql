-- CreateEnum
CREATE TYPE "NannyProfileStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "TaskEnjoymentLevel" AS ENUM ('ENJOYED', 'NEUTRAL', 'RESISTANT');

-- CreateEnum
CREATE TYPE "ChildMood" AS ENUM ('EXCITED', 'HAPPY', 'NEUTRAL', 'TIRED', 'SAD', 'RESISTANT');

-- CreateEnum
CREATE TYPE "TaskCompletionRate" AS ENUM ('FULLY_DONE', 'PARTLY_DONE', 'MINIMAL', 'SKIPPED');

-- AlterTable
ALTER TABLE "NannyProfile" ADD COLUMN     "averageRating" DOUBLE PRECISION,
ADD COLUMN     "backgroundCheckVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "emergencyContactVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joinedAt" TIMESTAMP(3),
ADD COLUMN     "status" "NannyProfileStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "totalReviews" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "yearsExperience" INTEGER;

-- CreateTable
CREATE TABLE "DayActivityFeedback" (
    "id" TEXT NOT NULL,
    "dayActivityId" TEXT NOT NULL,
    "submittedByUserId" TEXT NOT NULL,
    "enjoyment" "TaskEnjoymentLevel",
    "childMood" "ChildMood",
    "completionRate" "TaskCompletionRate",
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parentSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayActivityFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayActivityProof" (
    "id" TEXT NOT NULL,
    "dayActivityId" TEXT NOT NULL,
    "mediaAssetId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayActivityProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedtimeStoryAudio" (
    "id" TEXT NOT NULL,
    "bedtimeStoryId" TEXT NOT NULL,
    "speakerUserId" TEXT,
    "speakerName" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "audioKey" TEXT,
    "durationSec" INTEGER,
    "transcript" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedtimeStoryAudio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NannyPortfolioHighlight" (
    "id" TEXT NOT NULL,
    "nannyUserId" TEXT NOT NULL,
    "mediaAssetId" TEXT,
    "childId" TEXT,
    "dayActivityId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NannyPortfolioHighlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NannyExperience" (
    "id" TEXT NOT NULL,
    "nannyProfileId" TEXT NOT NULL,
    "familyName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "childrenCount" INTEGER,
    "infantsCount" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NannyExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NannyCertification" (
    "id" TEXT NOT NULL,
    "nannyProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "issuer" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NannyCertification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DayActivityFeedback_dayActivityId_key" ON "DayActivityFeedback"("dayActivityId");

-- CreateIndex
CREATE INDEX "DayActivityFeedback_submittedByUserId_submittedAt_idx" ON "DayActivityFeedback"("submittedByUserId", "submittedAt");

-- CreateIndex
CREATE INDEX "DayActivityProof_dayActivityId_idx" ON "DayActivityProof"("dayActivityId");

-- CreateIndex
CREATE INDEX "DayActivityProof_mediaAssetId_idx" ON "DayActivityProof"("mediaAssetId");

-- CreateIndex
CREATE INDEX "DayActivityProof_uploadedByUserId_createdAt_idx" ON "DayActivityProof"("uploadedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "BedtimeStoryAudio_bedtimeStoryId_sortOrder_idx" ON "BedtimeStoryAudio"("bedtimeStoryId", "sortOrder");

-- CreateIndex
CREATE INDEX "BedtimeStoryAudio_speakerUserId_idx" ON "BedtimeStoryAudio"("speakerUserId");

-- CreateIndex
CREATE INDEX "NannyPortfolioHighlight_nannyUserId_createdAt_idx" ON "NannyPortfolioHighlight"("nannyUserId", "createdAt");

-- CreateIndex
CREATE INDEX "NannyPortfolioHighlight_childId_idx" ON "NannyPortfolioHighlight"("childId");

-- CreateIndex
CREATE INDEX "NannyPortfolioHighlight_dayActivityId_idx" ON "NannyPortfolioHighlight"("dayActivityId");

-- CreateIndex
CREATE INDEX "NannyExperience_nannyProfileId_idx" ON "NannyExperience"("nannyProfileId");

-- CreateIndex
CREATE INDEX "NannyCertification_nannyProfileId_idx" ON "NannyCertification"("nannyProfileId");

-- CreateIndex
CREATE INDEX "DayActivity_proofMediaId_idx" ON "DayActivity"("proofMediaId");

-- AddForeignKey
ALTER TABLE "DayActivity" ADD CONSTRAINT "DayActivity_proofMediaId_fkey" FOREIGN KEY ("proofMediaId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayActivityFeedback" ADD CONSTRAINT "DayActivityFeedback_dayActivityId_fkey" FOREIGN KEY ("dayActivityId") REFERENCES "DayActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayActivityFeedback" ADD CONSTRAINT "DayActivityFeedback_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayActivityProof" ADD CONSTRAINT "DayActivityProof_dayActivityId_fkey" FOREIGN KEY ("dayActivityId") REFERENCES "DayActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayActivityProof" ADD CONSTRAINT "DayActivityProof_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayActivityProof" ADD CONSTRAINT "DayActivityProof_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedtimeStoryAudio" ADD CONSTRAINT "BedtimeStoryAudio_bedtimeStoryId_fkey" FOREIGN KEY ("bedtimeStoryId") REFERENCES "BedtimeStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedtimeStoryAudio" ADD CONSTRAINT "BedtimeStoryAudio_speakerUserId_fkey" FOREIGN KEY ("speakerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyPortfolioHighlight" ADD CONSTRAINT "NannyPortfolioHighlight_nannyUserId_fkey" FOREIGN KEY ("nannyUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyPortfolioHighlight" ADD CONSTRAINT "NannyPortfolioHighlight_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyPortfolioHighlight" ADD CONSTRAINT "NannyPortfolioHighlight_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyPortfolioHighlight" ADD CONSTRAINT "NannyPortfolioHighlight_dayActivityId_fkey" FOREIGN KEY ("dayActivityId") REFERENCES "DayActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyExperience" ADD CONSTRAINT "NannyExperience_nannyProfileId_fkey" FOREIGN KEY ("nannyProfileId") REFERENCES "NannyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyCertification" ADD CONSTRAINT "NannyCertification_nannyProfileId_fkey" FOREIGN KEY ("nannyProfileId") REFERENCES "NannyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
