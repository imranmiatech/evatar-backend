ALTER TABLE "grocery_orders"
ADD COLUMN "trackingCode" TEXT,
ADD COLUMN "deliveryAddress" TEXT,
ADD COLUMN "receiverPhone" TEXT,
ADD COLUMN "estimatedDeliveryAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "grocery_orders_trackingCode_key" ON "grocery_orders"("trackingCode");
