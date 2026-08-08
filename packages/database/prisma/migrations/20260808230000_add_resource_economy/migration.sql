CREATE TYPE "ResourceType" AS ENUM ('IRON', 'COPPER', 'BRONZE');

ALTER TABLE "reward_claims"
ADD COLUMN "resource_type" "ResourceType" NOT NULL DEFAULT 'IRON',
ADD COLUMN "resource_amount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "character_resources" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "type" "ResourceType" NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "character_resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "resource_ledger_entries" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "type" "ResourceType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(32) NOT NULL,
    "reference_id" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "resource_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "character_resources_character_id_type_key" ON "character_resources"("character_id", "type");
CREATE UNIQUE INDEX "resource_ledger_entries_character_id_type_reason_reference_id_key" ON "resource_ledger_entries"("character_id", "type", "reason", "reference_id");
CREATE INDEX "resource_ledger_entries_character_id_created_at_idx" ON "resource_ledger_entries"("character_id", "created_at");

ALTER TABLE "character_resources" ADD CONSTRAINT "character_resources_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "resource_ledger_entries" ADD CONSTRAINT "resource_ledger_entries_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
