ALTER TABLE "clan_memberships" ADD COLUMN "contribution" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "clan_resources" (
  "id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "type" "ResourceType" NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clan_resources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clan_contributions" (
  "id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "resource_type" "ResourceType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "experience_gain" INTEGER NOT NULL,
  "reference_id" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clan_contributions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clan_resources_clan_id_type_key" ON "clan_resources"("clan_id", "type");
CREATE UNIQUE INDEX "clan_contributions_character_id_reference_id_key" ON "clan_contributions"("character_id", "reference_id");
CREATE INDEX "clan_contributions_clan_id_created_at_idx" ON "clan_contributions"("clan_id", "created_at");

ALTER TABLE "clan_resources" ADD CONSTRAINT "clan_resources_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clan_contributions" ADD CONSTRAINT "clan_contributions_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clan_contributions" ADD CONSTRAINT "clan_contributions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
