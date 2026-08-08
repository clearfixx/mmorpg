ALTER TYPE "ResourceType" ADD VALUE 'VEIL_ECHO';

CREATE TABLE "clan_boss_reward_claims" (
  "id" UUID NOT NULL,
  "encounter_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "participant_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "resource_type" "ResourceType" NOT NULL DEFAULT 'VEIL_ECHO',
  "resource_amount" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clan_boss_reward_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clan_boss_reward_claims_participant_id_key"
ON "clan_boss_reward_claims"("participant_id");
CREATE UNIQUE INDEX "clan_boss_reward_claims_encounter_id_character_id_key"
ON "clan_boss_reward_claims"("encounter_id", "character_id");
CREATE UNIQUE INDEX "clan_boss_reward_claims_character_id_idempotency_key_key"
ON "clan_boss_reward_claims"("character_id", "idempotency_key");

ALTER TABLE "clan_boss_reward_claims" ADD CONSTRAINT "clan_boss_reward_claims_encounter_id_fkey"
FOREIGN KEY ("encounter_id") REFERENCES "clan_boss_encounters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "clan_boss_reward_claims" ADD CONSTRAINT "clan_boss_reward_claims_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clan_boss_reward_claims" ADD CONSTRAINT "clan_boss_reward_claims_participant_id_fkey"
FOREIGN KEY ("participant_id") REFERENCES "clan_boss_participants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
