CREATE TYPE "CraftingStation" AS ENUM ('WORKSHOP', 'ALCHEMY_TABLE', 'FORGE', 'RITUAL_CIRCLE');
CREATE TYPE "CraftJobStatus" AS ENUM ('ACTIVE', 'CLAIMED');

CREATE TABLE "craft_jobs" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "recipe_id" VARCHAR(64) NOT NULL,
  "station" "CraftingStation" NOT NULL,
  "active_station" "CraftingStation",
  "status" "CraftJobStatus" NOT NULL DEFAULT 'ACTIVE',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "output_type" "ResourceType" NOT NULL,
  "output_amount" INTEGER NOT NULL,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completes_at" TIMESTAMP(3) NOT NULL,
  "claimed_at" TIMESTAMP(3),
  CONSTRAINT "craft_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "craft_jobs_quantity_positive" CHECK ("quantity" BETWEEN 1 AND 100),
  CONSTRAINT "craft_jobs_output_positive" CHECK ("output_amount" > 0)
);

CREATE TABLE "craft_commands" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "command_type" VARCHAR(32) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "craft_job_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "craft_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "craft_jobs_character_id_active_station_key"
ON "craft_jobs"("character_id", "active_station");
CREATE INDEX "craft_jobs_character_id_status_completes_at_idx"
ON "craft_jobs"("character_id", "status", "completes_at");
CREATE UNIQUE INDEX "craft_commands_character_id_idempotency_key_key"
ON "craft_commands"("character_id", "idempotency_key");

ALTER TABLE "craft_jobs"
ADD CONSTRAINT "craft_jobs_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "craft_commands"
ADD CONSTRAINT "craft_commands_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
