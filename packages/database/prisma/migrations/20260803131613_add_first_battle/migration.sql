-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('ACTIVE', 'WON', 'LOST', 'RETREATED');

-- CreateTable
CREATE TABLE "battles" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "encounter_id" VARCHAR(64) NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "seed" INTEGER NOT NULL,
    "state" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "battles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_commands" (
    "id" UUID NOT NULL,
    "battle_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "expected_version" INTEGER NOT NULL,
    "action_id" VARCHAR(64) NOT NULL,
    "resulting_version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "battle_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "battles_character_id_status_idx" ON "battles"("character_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "battle_commands_battle_id_idempotency_key_key" ON "battle_commands"("battle_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "battles" ADD CONSTRAINT "battles_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_commands" ADD CONSTRAINT "battle_commands_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "battles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
