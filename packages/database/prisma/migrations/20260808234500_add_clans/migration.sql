CREATE TYPE "ClanRole" AS ENUM ('LEADER', 'ELDER', 'MEMBER');

CREATE TABLE "clans" (
  "id" UUID NOT NULL,
  "name" VARCHAR(32) NOT NULL,
  "name_key" VARCHAR(64) NOT NULL,
  "invite_code" CHAR(8) NOT NULL,
  "level" INTEGER NOT NULL DEFAULT 1,
  "experience" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "clans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clan_memberships" (
  "id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "role" "ClanRole" NOT NULL DEFAULT 'MEMBER',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "role_since" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clan_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clan_commands" (
  "id" UUID NOT NULL,
  "clan_id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "command_type" VARCHAR(32) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clan_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clans_name_key_key" ON "clans"("name_key");
CREATE UNIQUE INDEX "clans_invite_code_key" ON "clans"("invite_code");
CREATE UNIQUE INDEX "clan_memberships_character_id_key" ON "clan_memberships"("character_id");
CREATE INDEX "clan_memberships_clan_id_joined_at_idx" ON "clan_memberships"("clan_id", "joined_at");
CREATE UNIQUE INDEX "clan_commands_character_id_idempotency_key_key" ON "clan_commands"("character_id", "idempotency_key");
CREATE INDEX "clan_commands_clan_id_created_at_idx" ON "clan_commands"("clan_id", "created_at");

ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clan_memberships" ADD CONSTRAINT "clan_memberships_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clan_commands" ADD CONSTRAINT "clan_commands_clan_id_fkey" FOREIGN KEY ("clan_id") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clan_commands" ADD CONSTRAINT "clan_commands_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
