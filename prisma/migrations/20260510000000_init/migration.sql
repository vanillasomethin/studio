-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STORE_PARTNER', 'BRAND', 'AGENCY', 'ADMIN', 'OPS');
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ONLINE', 'OFFLINE');
CREATE TYPE "ContentType" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "Recurrence" AS ENUM ('ONCE', 'DAILY', 'WEEKLY');

-- CreateTable: User
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "phone" TEXT,
    "passwordHash" TEXT,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STORE_PARTNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Account
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Session
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable: VerificationToken
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable: Store
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "address" TEXT,
    "locality" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "gstin" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredBy" TEXT,
    "agreedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Brand
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "gstin" TEXT,
    "walletPaise" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Campaign
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "brandId" TEXT,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "screens" INTEGER NOT NULL DEFAULT 1,
    "months" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "pricePerScreen" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "paymentId" TEXT,
    "orderId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Device
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "hardwareKey" TEXT NOT NULL,
    "storeId" TEXT,
    "name" TEXT NOT NULL,
    "groupName" TEXT,
    "jwtSecret" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "lastSeen" TIMESTAMP(3),
    "uptimePctD30" DOUBLE PRECISION,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Content
CREATE TABLE "Content" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "md5" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "uploadedById" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Content_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Playlist
CREATE TABLE "Playlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Playlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlaylistItem
CREATE TABLE "PlaylistItem" (
    "id" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "PlaylistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Schedule
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "playlistId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "deviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "groupName" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "recurrence" "Recurrence" NOT NULL DEFAULT 'ONCE',
    "dailyStart" TEXT,
    "dailyEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PlayEvent
CREATE TABLE "PlayEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "campaignId" TEXT,
    "mediaId" TEXT NOT NULL,
    "layoutId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "tag" TEXT,
    "prevHash" TEXT,
    "rowHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Flyer
CREATE TABLE "Flyer" (
    "id" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "objectKey" TEXT,
    "imageBase64" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Flyer_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");
CREATE UNIQUE INDEX "Store_userId_key" ON "Store"("userId");
CREATE UNIQUE INDEX "Store_referralCode_key" ON "Store"("referralCode");
CREATE UNIQUE INDEX "Brand_userId_key" ON "Brand"("userId");
CREATE UNIQUE INDEX "Device_hardwareKey_key" ON "Device"("hardwareKey");
CREATE UNIQUE INDEX "Content_objectKey_key" ON "Content"("objectKey");
CREATE UNIQUE INDEX "PlaylistItem_playlistId_order_key" ON "PlaylistItem"("playlistId", "order");

-- Indexes
CREATE INDEX "User_phone_idx" ON "User"("phone");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "Store_city_idx" ON "Store"("city");
CREATE INDEX "Store_pincode_idx" ON "Store"("pincode");
CREATE INDEX "Store_referralCode_idx" ON "Store"("referralCode");
CREATE INDEX "Campaign_brandId_idx" ON "Campaign"("brandId");
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_email_idx" ON "Campaign"("email");
CREATE INDEX "Device_storeId_idx" ON "Device"("storeId");
CREATE INDEX "Device_groupName_idx" ON "Device"("groupName");
CREATE INDEX "Device_status_idx" ON "Device"("status");
CREATE INDEX "Content_uploadedById_idx" ON "Content"("uploadedById");
CREATE INDEX "PlaylistItem_contentId_idx" ON "PlaylistItem"("contentId");
CREATE INDEX "Schedule_playlistId_idx" ON "Schedule"("playlistId");
CREATE INDEX "Schedule_groupName_idx" ON "Schedule"("groupName");
CREATE INDEX "Schedule_startAt_endAt_idx" ON "Schedule"("startAt", "endAt");
CREATE INDEX "PlayEvent_deviceId_startedAt_idx" ON "PlayEvent"("deviceId", "startedAt");
CREATE INDEX "PlayEvent_campaignId_idx" ON "PlayEvent"("campaignId");
CREATE INDEX "PlayEvent_tag_idx" ON "PlayEvent"("tag");
CREATE INDEX "PlayEvent_startedAt_idx" ON "PlayEvent"("startedAt");
CREATE INDEX "Flyer_validUntil_idx" ON "Flyer"("validUntil");
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- Foreign keys
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Store" ADD CONSTRAINT "Store_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Brand" ADD CONSTRAINT "Brand_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Device" ADD CONSTRAINT "Device_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlaylistItem" ADD CONSTRAINT "PlaylistItem_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_playlistId_fkey" FOREIGN KEY ("playlistId") REFERENCES "Playlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayEvent" ADD CONSTRAINT "PlayEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayEvent" ADD CONSTRAINT "PlayEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
