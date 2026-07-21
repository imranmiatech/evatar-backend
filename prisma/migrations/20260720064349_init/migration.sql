-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('NANNY', 'PARENT', 'PARTNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'DOCUMENTS_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'NID_FRONT', 'NID_BACK', 'SELFIE');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('SIGNUP_VERIFICATION', 'LOGIN', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "MembershipPlan" AS ENUM ('TWO_CHILD', 'FOUR_CHILD', 'TEN_CHILD', 'TRIAL');

-- CreateEnum
CREATE TYPE "ChildGender" AS ENUM ('BOY', 'GIRL', 'OTHER');

-- CreateEnum
CREATE TYPE "DayPlanBuildMode" AS ENUM ('GUIDED', 'MANUAL');

-- CreateEnum
CREATE TYPE "DayPlanStatus" AS ENUM ('DRAFT', 'AI_PENDING', 'READY', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'AUDIO', 'VIDEO');

-- CreateEnum
CREATE TYPE "KitchenInventoryStatus" AS ENUM ('MISSING', 'LOW', 'IN_STOCK');

-- CreateEnum
CREATE TYPE "KitchenItemCategory" AS ENUM ('PRODUCE', 'DAIRY', 'PANTRY', 'PROTEIN', 'BABY_FOOD', 'SNACK', 'OTHER');

-- CreateEnum
CREATE TYPE "RecipeMealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'OTHER');

-- CreateEnum
CREATE TYPE "ShoppingListItemStatus" AS ENUM ('NEEDED', 'OPTIONAL', 'ADDED_TO_VOUCHER', 'ORDERED', 'FULFILLED', 'REMOVED');

-- CreateEnum
CREATE TYPE "ShoppingVoucherStatus" AS ENUM ('DRAFT', 'SENT_TO_PARENT', 'SENT_TO_STORE', 'APPROVED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "GroceryOrderStatus" AS ENUM ('VOUCHER_SENT', 'STORE_REVIEWING', 'STORE_REVIEWED', 'ORDER_CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('CARD', 'CASH_ON_DELIVERY', 'ONLINE');

-- CreateEnum
CREATE TYPE "PaymentMethodStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "profilePictureUrl" TEXT,
    "preferredLanguage" TEXT DEFAULT 'en',
    "role" "UserRole" NOT NULL DEFAULT 'PARENT',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "termsAccepted" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "vendorApplicantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'SIGNUP_VERIFICATION',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "relationType" TEXT,
    "street" TEXT,
    "postCode" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "membershipPlan" "MembershipPlan",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenAccess" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "nannyUserId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "canViewInventory" BOOLEAN NOT NULL DEFAULT true,
    "canManageInventory" BOOLEAN NOT NULL DEFAULT true,
    "canCreateShoppingList" BOOLEAN NOT NULL DEFAULT true,
    "canSendVoucher" BOOLEAN NOT NULL DEFAULT true,
    "canConfirmDelivery" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "mealType" "RecipeMealType" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "prepTimeMinutes" INTEGER,
    "cookTimeMinutes" INTEGER,
    "servings" INTEGER,
    "minAgeMonths" INTEGER,
    "maxAgeMonths" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nutrition" JSONB,
    "safetyNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "inventoryName" TEXT,
    "allergenWarning" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeStep" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RecipeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenInventoryItem" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "lastUpdatedByUserId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "category" "KitchenItemCategory" NOT NULL DEFAULT 'OTHER',
    "status" "KitchenInventoryStatus" NOT NULL DEFAULT 'IN_STOCK',
    "currentStockPercent" INTEGER NOT NULL DEFAULT 100,
    "thresholdPercent" INTEGER NOT NULL DEFAULT 25,
    "expiryDate" TIMESTAMP(3),
    "lastStockedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenInventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingList" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingListItem" (
    "id" TEXT NOT NULL,
    "shoppingListId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "recipeId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "category" "KitchenItemCategory" NOT NULL DEFAULT 'OTHER',
    "status" "ShoppingListItemStatus" NOT NULL DEFAULT 'NEEDED',
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenStore" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "address" TEXT,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenStore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingVoucher" (
    "id" TEXT NOT NULL,
    "voucherCode" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "shoppingListId" TEXT,
    "storeId" TEXT,
    "status" "ShoppingVoucherStatus" NOT NULL DEFAULT 'DRAFT',
    "messageToParent" TEXT,
    "messageToStore" TEXT,
    "allergyWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "substitutionRules" JSONB,
    "sentToParentAt" TIMESTAMP(3),
    "sentToStoreAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingVoucherItem" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "shoppingListItemId" TEXT,
    "recipeId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "estimatedPriceCents" INTEGER,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ShoppingVoucherItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "voucherId" TEXT,
    "childId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "storeId" TEXT,
    "paymentMethodId" TEXT,
    "status" "GroceryOrderStatus" NOT NULL DEFAULT 'VOUCHER_SENT',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "trackingEvents" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroceryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroceryOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recipeId" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroceryOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL,
    "status" "PaymentMethodStatus" NOT NULL DEFAULT 'ACTIVE',
    "label" TEXT NOT NULL,
    "brand" TEXT,
    "last4" TEXT,
    "expiryMonth" INTEGER,
    "expiryYear" INTEGER,
    "providerRef" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenSchedule" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "recipeId" TEXT,
    "dayActivityId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "mealType" "RecipeMealType" NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitchenAuditLog" (
    "id" TEXT NOT NULL,
    "childId" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitchenAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "s3Key" TEXT NOT NULL,
    "extractedData" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" TEXT,
    "birthDate" TIMESTAMP(3),
    "gender" "ChildGender",
    "avatarUrl" TEXT,
    "allergies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dietaryNotes" TEXT,
    "medicalNotes" TEXT,
    "personality" TEXT,
    "sleepRoutine" TEXT,
    "favoriteThings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NannyChildLink" (
    "id" TEXT NOT NULL,
    "nannyUserId" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "canViewStory" BOOLEAN NOT NULL DEFAULT true,
    "canUpdateProof" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NannyChildLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mode" "DayPlanBuildMode" NOT NULL,
    "status" "DayPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "guidedAnswers" JSONB,
    "aiInput" JSONB,
    "aiOutput" JSONB,
    "title" TEXT,
    "summary" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayActivity" (
    "id" TEXT NOT NULL,
    "dayPlanId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "status" "ActivityStatus" NOT NULL DEFAULT 'PLANNED',
    "nannyNote" TEXT,
    "parentNote" TEXT,
    "proofMediaId" TEXT,
    "imageUrl" TEXT,
    "detail" JSONB,
    "templateId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    "detail" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedtimeStory" (
    "id" TEXT NOT NULL,
    "dayPlanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storyText" TEXT NOT NULL,
    "imagePrompt" TEXT,
    "coverImageUrl" TEXT,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "parentAudioUrl" TEXT,
    "parentAudioKey" TEXT,
    "audioDurationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BedtimeStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "durationSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NannyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "bio" TEXT,
    "hourlyRateCents" INTEGER,
    "completedJobs" INTEGER NOT NULL DEFAULT 0,
    "repeatFamilies" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "training" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "portfolioImageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "experience" JSONB,
    "perks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NannyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phoneNumber_key" ON "User"("phoneNumber");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_verificationStatus_idx" ON "User"("verificationStatus");

-- CreateIndex
CREATE INDEX "OtpCode_userId_purpose_idx" ON "OtpCode"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "ParentProfile_userId_key" ON "ParentProfile"("userId");

-- CreateIndex
CREATE INDEX "KitchenAccess_parentUserId_idx" ON "KitchenAccess"("parentUserId");

-- CreateIndex
CREATE INDEX "KitchenAccess_childId_idx" ON "KitchenAccess"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenAccess_nannyUserId_childId_key" ON "KitchenAccess"("nannyUserId", "childId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");

-- CreateIndex
CREATE INDEX "Recipe_mealType_idx" ON "Recipe"("mealType");

-- CreateIndex
CREATE INDEX "Recipe_category_idx" ON "Recipe"("category");

-- CreateIndex
CREATE INDEX "Recipe_isPublished_idx" ON "Recipe"("isPublished");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipeId_sortOrder_idx" ON "RecipeIngredient"("recipeId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecipeStep_recipeId_sortOrder_idx" ON "RecipeStep"("recipeId", "sortOrder");

-- CreateIndex
CREATE INDEX "KitchenInventoryItem_childId_status_idx" ON "KitchenInventoryItem"("childId", "status");

-- CreateIndex
CREATE INDEX "KitchenInventoryItem_parentUserId_idx" ON "KitchenInventoryItem"("parentUserId");

-- CreateIndex
CREATE INDEX "KitchenInventoryItem_createdByUserId_idx" ON "KitchenInventoryItem"("createdByUserId");

-- CreateIndex
CREATE INDEX "ShoppingList_childId_isActive_idx" ON "ShoppingList"("childId", "isActive");

-- CreateIndex
CREATE INDEX "ShoppingList_parentUserId_idx" ON "ShoppingList"("parentUserId");

-- CreateIndex
CREATE INDEX "ShoppingListItem_shoppingListId_status_idx" ON "ShoppingListItem"("shoppingListId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShoppingVoucher_voucherCode_key" ON "ShoppingVoucher"("voucherCode");

-- CreateIndex
CREATE INDEX "ShoppingVoucher_childId_status_idx" ON "ShoppingVoucher"("childId", "status");

-- CreateIndex
CREATE INDEX "ShoppingVoucher_parentUserId_idx" ON "ShoppingVoucher"("parentUserId");

-- CreateIndex
CREATE INDEX "ShoppingVoucherItem_voucherId_idx" ON "ShoppingVoucherItem"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryOrder_orderNumber_key" ON "GroceryOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "GroceryOrder_voucherId_key" ON "GroceryOrder"("voucherId");

-- CreateIndex
CREATE INDEX "GroceryOrder_childId_status_idx" ON "GroceryOrder"("childId", "status");

-- CreateIndex
CREATE INDEX "GroceryOrder_parentUserId_idx" ON "GroceryOrder"("parentUserId");

-- CreateIndex
CREATE INDEX "GroceryOrderItem_orderId_idx" ON "GroceryOrderItem"("orderId");

-- CreateIndex
CREATE INDEX "PaymentMethod_parentUserId_status_idx" ON "PaymentMethod"("parentUserId", "status");

-- CreateIndex
CREATE INDEX "KitchenSchedule_childId_date_idx" ON "KitchenSchedule"("childId", "date");

-- CreateIndex
CREATE INDEX "KitchenSchedule_parentUserId_idx" ON "KitchenSchedule"("parentUserId");

-- CreateIndex
CREATE INDEX "KitchenAuditLog_childId_idx" ON "KitchenAuditLog"("childId");

-- CreateIndex
CREATE INDEX "KitchenAuditLog_userId_action_idx" ON "KitchenAuditLog"("userId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "KycDocument_userId_type_key" ON "KycDocument"("userId", "type");

-- CreateIndex
CREATE INDEX "Child_parentUserId_idx" ON "Child"("parentUserId");

-- CreateIndex
CREATE INDEX "NannyChildLink_childId_idx" ON "NannyChildLink"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "NannyChildLink_nannyUserId_childId_key" ON "NannyChildLink"("nannyUserId", "childId");

-- CreateIndex
CREATE INDEX "DayPlan_childId_date_idx" ON "DayPlan"("childId", "date");

-- CreateIndex
CREATE INDEX "DayPlan_status_idx" ON "DayPlan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DayPlan_childId_date_key" ON "DayPlan"("childId", "date");

-- CreateIndex
CREATE INDEX "DayActivity_dayPlanId_sortOrder_idx" ON "DayActivity"("dayPlanId", "sortOrder");

-- CreateIndex
CREATE INDEX "DayActivity_status_idx" ON "DayActivity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_slug_key" ON "ActivityTemplate"("slug");

-- CreateIndex
CREATE INDEX "ActivityTemplate_category_idx" ON "ActivityTemplate"("category");

-- CreateIndex
CREATE INDEX "ActivityTemplate_isActive_idx" ON "ActivityTemplate"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BedtimeStory_dayPlanId_key" ON "BedtimeStory"("dayPlanId");

-- CreateIndex
CREATE INDEX "MediaAsset_ownerUserId_type_idx" ON "MediaAsset"("ownerUserId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "NannyProfile_userId_key" ON "NannyProfile"("userId");

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentProfile" ADD CONSTRAINT "ParentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenAccess" ADD CONSTRAINT "KitchenAccess_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenAccess" ADD CONSTRAINT "KitchenAccess_nannyUserId_fkey" FOREIGN KEY ("nannyUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenAccess" ADD CONSTRAINT "KitchenAccess_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeStep" ADD CONSTRAINT "RecipeStep_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenInventoryItem" ADD CONSTRAINT "KitchenInventoryItem_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenInventoryItem" ADD CONSTRAINT "KitchenInventoryItem_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenInventoryItem" ADD CONSTRAINT "KitchenInventoryItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenInventoryItem" ADD CONSTRAINT "KitchenInventoryItem_lastUpdatedByUserId_fkey" FOREIGN KEY ("lastUpdatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingList" ADD CONSTRAINT "ShoppingList_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "KitchenInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingListItem" ADD CONSTRAINT "ShoppingListItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingVoucher" ADD CONSTRAINT "ShoppingVoucher_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingVoucher" ADD CONSTRAINT "ShoppingVoucher_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingVoucher" ADD CONSTRAINT "ShoppingVoucher_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingVoucher" ADD CONSTRAINT "ShoppingVoucher_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingVoucher" ADD CONSTRAINT "ShoppingVoucher_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "KitchenStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingVoucherItem" ADD CONSTRAINT "ShoppingVoucherItem_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "ShoppingVoucher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingVoucherItem" ADD CONSTRAINT "ShoppingVoucherItem_shoppingListItemId_fkey" FOREIGN KEY ("shoppingListItemId") REFERENCES "ShoppingListItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingVoucherItem" ADD CONSTRAINT "ShoppingVoucherItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrder" ADD CONSTRAINT "GroceryOrder_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "ShoppingVoucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrder" ADD CONSTRAINT "GroceryOrder_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrder" ADD CONSTRAINT "GroceryOrder_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrder" ADD CONSTRAINT "GroceryOrder_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrder" ADD CONSTRAINT "GroceryOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "KitchenStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrder" ADD CONSTRAINT "GroceryOrder_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrderItem" ADD CONSTRAINT "GroceryOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "GroceryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroceryOrderItem" ADD CONSTRAINT "GroceryOrderItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenSchedule" ADD CONSTRAINT "KitchenSchedule_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenSchedule" ADD CONSTRAINT "KitchenSchedule_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenSchedule" ADD CONSTRAINT "KitchenSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenSchedule" ADD CONSTRAINT "KitchenSchedule_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenAuditLog" ADD CONSTRAINT "KitchenAuditLog_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenAuditLog" ADD CONSTRAINT "KitchenAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycDocument" ADD CONSTRAINT "KycDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyChildLink" ADD CONSTRAINT "NannyChildLink_nannyUserId_fkey" FOREIGN KEY ("nannyUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyChildLink" ADD CONSTRAINT "NannyChildLink_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayActivity" ADD CONSTRAINT "DayActivity_dayPlanId_fkey" FOREIGN KEY ("dayPlanId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedtimeStory" ADD CONSTRAINT "BedtimeStory_dayPlanId_fkey" FOREIGN KEY ("dayPlanId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NannyProfile" ADD CONSTRAINT "NannyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
