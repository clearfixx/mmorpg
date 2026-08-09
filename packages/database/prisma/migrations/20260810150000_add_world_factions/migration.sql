CREATE TYPE "WorldFaction" AS ENUM ('DAWN_COVENANT', 'ASHEN_HOST');

ALTER TABLE "characters"
ADD COLUMN "faction" "WorldFaction",
ADD COLUMN "faction_changes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "faction_commands" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "faction" "WorldFaction" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faction_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "faction_commands_character_id_idempotency_key_key"
ON "faction_commands"("character_id", "idempotency_key");

ALTER TABLE "faction_commands"
ADD CONSTRAINT "faction_commands_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
