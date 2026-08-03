CREATE TYPE "ItemRarity" AS ENUM ('COMMON', 'UNCOMMON');
CREATE TYPE "ItemBinding" AS ENUM ('UNBOUND', 'BOUND_ON_EQUIP', 'BOUND');
CREATE TYPE "ItemLocation" AS ENUM ('CHEST', 'EQUIPPED');
CREATE TYPE "ItemLineageType" AS ENUM ('CREATED_FROM_BATTLE_REWARD', 'EQUIPPED');

ALTER TABLE "characters" ADD COLUMN "gold" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "battles" ADD COLUMN "result_acknowledged_at" TIMESTAMP(3);
ALTER TABLE "character_world_states"
ADD COLUMN "cinderhaven_unlocked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "reward_claims" (
  "id" UUID NOT NULL,
  "battle_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "experience" INTEGER NOT NULL,
  "gold" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reward_claims_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_instances" (
  "id" UUID NOT NULL,
  "definition_id" VARCHAR(64) NOT NULL,
  "owner_id" UUID NOT NULL,
  "source_battle_id" UUID NOT NULL,
  "reward_claim_id" UUID NOT NULL,
  "item_level" INTEGER NOT NULL DEFAULT 1,
  "rarity" "ItemRarity" NOT NULL,
  "damage" INTEGER NOT NULL,
  "binding" "ItemBinding" NOT NULL DEFAULT 'BOUND_ON_EQUIP',
  "location" "ItemLocation" NOT NULL DEFAULT 'CHEST',
  "set_id" VARCHAR(64) NOT NULL,
  "visual_asset_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_instances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "item_lineage_events" (
  "id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "type" "ItemLineageType" NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "item_lineage_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reward_claims_battle_id_key" ON "reward_claims"("battle_id");
CREATE UNIQUE INDEX "reward_claims_character_id_idempotency_key_key"
ON "reward_claims"("character_id", "idempotency_key");
CREATE UNIQUE INDEX "item_instances_source_battle_id_key" ON "item_instances"("source_battle_id");
CREATE UNIQUE INDEX "item_instances_reward_claim_id_key" ON "item_instances"("reward_claim_id");
CREATE INDEX "item_instances_owner_id_location_idx" ON "item_instances"("owner_id", "location");
CREATE INDEX "item_lineage_events_item_id_created_at_idx"
ON "item_lineage_events"("item_id", "created_at");

ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_battle_id_fkey"
FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reward_claims" ADD CONSTRAINT "reward_claims_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_instances" ADD CONSTRAINT "item_instances_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "item_instances" ADD CONSTRAINT "item_instances_source_battle_id_fkey"
FOREIGN KEY ("source_battle_id") REFERENCES "battles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "item_instances" ADD CONSTRAINT "item_instances_reward_claim_id_fkey"
FOREIGN KEY ("reward_claim_id") REFERENCES "reward_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "item_lineage_events" ADD CONSTRAINT "item_lineage_events_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "item_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
