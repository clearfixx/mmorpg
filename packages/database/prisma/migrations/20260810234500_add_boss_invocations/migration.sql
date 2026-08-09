CREATE TABLE "boss_invocation_commands" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "battle_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boss_invocation_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "boss_invocation_commands_battle_id_key"
ON "boss_invocation_commands"("battle_id");

CREATE UNIQUE INDEX "boss_invocation_commands_character_id_idempotency_key_key"
ON "boss_invocation_commands"("character_id", "idempotency_key");

ALTER TABLE "boss_invocation_commands"
ADD CONSTRAINT "boss_invocation_commands_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "boss_invocation_commands"
ADD CONSTRAINT "boss_invocation_commands_battle_id_fkey"
FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
