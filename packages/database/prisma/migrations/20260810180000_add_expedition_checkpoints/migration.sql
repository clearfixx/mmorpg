ALTER TABLE "character_world_states"
  ADD COLUMN "highest_cleared_tier" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "guide_checkpoint_tier" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "expedition_guide_commands" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "checkpoint_tier" INTEGER NOT NULL,
  "gold_cost" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expedition_guide_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "expedition_guide_commands_character_id_idempotency_key_key"
  ON "expedition_guide_commands"("character_id", "idempotency_key");

ALTER TABLE "expedition_guide_commands"
  ADD CONSTRAINT "expedition_guide_commands_character_id_fkey"
  FOREIGN KEY ("character_id") REFERENCES "characters"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
