CREATE TABLE "payout_methods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "methodType" TEXT NOT NULL DEFAULT 'CARD',
    "providerName" TEXT,
    "accountHolderName" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "accountNumberMasked" TEXT,
    "routingNumberMasked" TEXT,
    "ibanMasked" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_methods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_routing_settings" (
    "id" TEXT NOT NULL,
    "paymentContext" TEXT NOT NULL,
    "targetUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_routing_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_routing_settings_paymentContext_key" ON "payment_routing_settings"("paymentContext");
CREATE INDEX "payout_methods_userId_isDefault_idx" ON "payout_methods"("userId", "isDefault");
CREATE INDEX "payment_routing_settings_targetUserId_idx" ON "payment_routing_settings"("targetUserId");

ALTER TABLE "payout_methods" ADD CONSTRAINT "payout_methods_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_routing_settings" ADD CONSTRAINT "payment_routing_settings_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
