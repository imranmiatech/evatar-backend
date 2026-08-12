CREATE TABLE "partner_offer_views" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_offer_views_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "partner_offer_saves" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_offer_saves_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "partner_offer_redemptions" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_offer_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partner_offer_views_offerId_createdAt_idx" ON "partner_offer_views"("offerId", "createdAt");
CREATE INDEX "partner_offer_views_userId_createdAt_idx" ON "partner_offer_views"("userId", "createdAt");
CREATE UNIQUE INDEX "partner_offer_saves_offerId_userId_key" ON "partner_offer_saves"("offerId", "userId");
CREATE INDEX "partner_offer_saves_offerId_createdAt_idx" ON "partner_offer_saves"("offerId", "createdAt");
CREATE INDEX "partner_offer_saves_userId_createdAt_idx" ON "partner_offer_saves"("userId", "createdAt");
CREATE INDEX "partner_offer_redemptions_offerId_createdAt_idx" ON "partner_offer_redemptions"("offerId", "createdAt");
CREATE INDEX "partner_offer_redemptions_userId_createdAt_idx" ON "partner_offer_redemptions"("userId", "createdAt");

ALTER TABLE "partner_offer_views" ADD CONSTRAINT "partner_offer_views_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "partner_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_offer_views" ADD CONSTRAINT "partner_offer_views_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "partner_offer_saves" ADD CONSTRAINT "partner_offer_saves_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "partner_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_offer_saves" ADD CONSTRAINT "partner_offer_saves_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_offer_redemptions" ADD CONSTRAINT "partner_offer_redemptions_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "partner_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_offer_redemptions" ADD CONSTRAINT "partner_offer_redemptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
