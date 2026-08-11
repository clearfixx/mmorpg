ALTER TYPE "ItemLocation" ADD VALUE IF NOT EXISTS 'MARKET';

CREATE TYPE "MarketListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

CREATE TABLE "market_listings" (
  "id" UUID NOT NULL,
  "seller_character_id" UUID NOT NULL,
  "buyer_character_id" UUID,
  "item_id" UUID NOT NULL,
  "price" INTEGER NOT NULL,
  "deposit" INTEGER NOT NULL DEFAULT 1,
  "status" "MarketListingStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "market_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "market_commands" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "listing_id" UUID,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "command_type" VARCHAR(32) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "market_commands_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "market_listings_status_expires_at_idx" ON "market_listings"("status", "expires_at");
CREATE INDEX "market_listings_item_id_created_at_idx" ON "market_listings"("item_id", "created_at");
CREATE INDEX "market_listings_seller_character_id_created_at_idx" ON "market_listings"("seller_character_id", "created_at");
CREATE INDEX "market_listings_buyer_character_id_completed_at_idx" ON "market_listings"("buyer_character_id", "completed_at");
CREATE UNIQUE INDEX "market_commands_character_id_idempotency_key_key" ON "market_commands"("character_id", "idempotency_key");
ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
