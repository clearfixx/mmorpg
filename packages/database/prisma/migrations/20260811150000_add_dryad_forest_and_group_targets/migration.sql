ALTER TYPE "WorldLocation" ADD VALUE IF NOT EXISTS 'DRYAD_FOREST';

ALTER TABLE "character_world_states"
  ADD COLUMN "dryad_highest_cleared_tier" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dryad_guide_checkpoint_tier" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "battle_commands"
  ADD COLUMN "target_enemy_id" VARCHAR(64);
