CREATE TYPE "TalentType" AS ENUM ('VITALITY', 'POWER', 'RESILIENCE');

CREATE TABLE "character_talents" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "type" "TalentType" NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "character_talents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "talent_commands" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "talent_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "character_talents_character_id_type_key" ON "character_talents"("character_id", "type");
CREATE UNIQUE INDEX "talent_commands_character_id_idempotency_key_key" ON "talent_commands"("character_id", "idempotency_key");

ALTER TABLE "character_talents" ADD CONSTRAINT "character_talents_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "talent_commands" ADD CONSTRAINT "talent_commands_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
