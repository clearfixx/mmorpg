-- CreateEnum
CREATE TYPE "WorldLocation" AS ENUM ('BROKEN_WATCHPOST', 'HOLLOW_ROAD', 'CINDERHAVEN_GATE');

-- CreateEnum
CREATE TYPE "PreparationChoice" AS ENUM ('SEARCH_ARMORY', 'INSPECT_TRACKS', 'REST_BRAZIER');

-- CreateTable
CREATE TABLE "character_world_states" (
    "character_id" UUID NOT NULL,
    "current_location" "WorldLocation" NOT NULL DEFAULT 'BROKEN_WATCHPOST',
    "preparation_choice" "PreparationChoice",
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_world_states_pkey" PRIMARY KEY ("character_id")
);

-- CreateTable
CREATE TABLE "world_commands" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "command_type" VARCHAR(32) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "world_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "world_commands_character_id_created_at_idx" ON "world_commands"("character_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "world_commands_character_id_idempotency_key_key" ON "world_commands"("character_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "character_world_states" ADD CONSTRAINT "character_world_states_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_commands" ADD CONSTRAINT "world_commands_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
