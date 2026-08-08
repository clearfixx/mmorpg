CREATE TYPE "ClanDevelopmentBranch" AS ENUM ('MILITARY', 'HUNTING', 'CRAFTING', 'ECONOMIC', 'MYSTIC');

CREATE TABLE "clan_developments" (
  "id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "branch" "ClanDevelopmentBranch" NOT NULL,
  "rank" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clan_developments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clan_developments_clan_id_branch_key" ON "clan_developments"("clan_id", "branch");
ALTER TABLE "clan_developments" ADD CONSTRAINT "clan_developments_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
