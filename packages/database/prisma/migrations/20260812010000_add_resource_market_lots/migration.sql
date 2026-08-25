ALTER TABLE "market_listings" ALTER COLUMN "item_id" DROP NOT NULL;
ALTER TABLE "market_listings" ADD COLUMN "resource_type" "ResourceType";
ALTER TABLE "market_listings" ADD COLUMN "resource_amount" INTEGER;

ALTER TABLE "market_listings" ADD CONSTRAINT "market_listings_asset_check" CHECK (
  ("item_id" IS NOT NULL AND "resource_type" IS NULL AND "resource_amount" IS NULL)
  OR
  ("item_id" IS NULL AND "resource_type" IS NOT NULL AND "resource_amount" > 0)
);
