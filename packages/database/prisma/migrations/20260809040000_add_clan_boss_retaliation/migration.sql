ALTER TABLE "clan_boss_participants"
ADD COLUMN "max_health" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "current_health" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "defeated_at" TIMESTAMP(3);
