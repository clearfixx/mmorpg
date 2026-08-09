ALTER TYPE "ResourceType" ADD VALUE 'BOSS_INVOCATION_SEAL';

ALTER TABLE "character_world_states"
ADD COLUMN "rare_encounter_week" VARCHAR(10),
ADD COLUMN "rare_encounter_checks" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rare_encounter_count" INTEGER NOT NULL DEFAULT 0;
