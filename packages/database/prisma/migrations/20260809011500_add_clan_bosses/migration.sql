CREATE TYPE "ClanBossStatus" AS ENUM ('ACTIVE', 'WON', 'EXPIRED');

CREATE TABLE "clan_boss_encounters" (
  "id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "active_clan_id" UUID,
  "tier" INTEGER NOT NULL DEFAULT 1,
  "status" "ClanBossStatus" NOT NULL DEFAULT 'ACTIVE',
  "max_health" INTEGER NOT NULL,
  "current_health" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "clan_boss_encounters_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clan_boss_participants" (
  "id" UUID NOT NULL,
  "encounter_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "damage" INTEGER NOT NULL DEFAULT 0,
  "actions" INTEGER NOT NULL DEFAULT 0,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clan_boss_participants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clan_boss_encounters_active_clan_id_key" ON "clan_boss_encounters"("active_clan_id");
CREATE INDEX "clan_boss_encounters_clan_id_created_at_idx" ON "clan_boss_encounters"("clan_id", "created_at");
CREATE UNIQUE INDEX "clan_boss_participants_encounter_id_character_id_key" ON "clan_boss_participants"("encounter_id", "character_id");
CREATE INDEX "clan_boss_participants_encounter_id_damage_idx" ON "clan_boss_participants"("encounter_id", "damage");

ALTER TABLE "clan_boss_encounters" ADD CONSTRAINT "clan_boss_encounters_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clan_boss_participants" ADD CONSTRAINT "clan_boss_participants_encounter_id_fkey" FOREIGN KEY ("encounter_id") REFERENCES "clan_boss_encounters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clan_boss_participants" ADD CONSTRAINT "clan_boss_participants_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
