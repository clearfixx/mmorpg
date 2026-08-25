ALTER TYPE "ItemRarity" ADD VALUE 'RARE';
ALTER TYPE "ItemRarity" ADD VALUE 'EPIC';
ALTER TYPE "ItemRarity" ADD VALUE 'LEGENDARY';
ALTER TYPE "ItemRarity" ADD VALUE 'MYTHIC';
ALTER TYPE "ItemRarity" ADD VALUE 'DIVINE';

ALTER TABLE "item_instances"
ADD COLUMN "roll_quality" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "item_instances"
ADD CONSTRAINT "item_instances_item_level_range"
CHECK ("item_level" BETWEEN 1 AND 99),
ADD CONSTRAINT "item_instances_roll_quality_range"
CHECK ("roll_quality" BETWEEN 0 AND 9999),
ADD CONSTRAINT "item_instances_damage_nonnegative"
CHECK ("damage" >= 0);
