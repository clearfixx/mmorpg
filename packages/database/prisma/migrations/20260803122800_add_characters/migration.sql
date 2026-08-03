-- CreateEnum
CREATE TYPE "CharacterArchetype" AS ENUM ('VANGUARD', 'RANGER', 'ARCANIST');

-- CreateEnum
CREATE TYPE "CharacterOrigin" AS ENUM ('FORMER_SENTINEL', 'ROAD_SURVIVOR', 'ARCHIVE_EXILE');

-- CreateEnum
CREATE TYPE "AvatarMode" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateTable
CREATE TABLE "characters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(24) NOT NULL,
    "name_key" VARCHAR(64) NOT NULL,
    "archetype" "CharacterArchetype" NOT NULL,
    "origin" "CharacterOrigin" NOT NULL DEFAULT 'ROAD_SURVIVOR',
    "avatar_mode" "AvatarMode" NOT NULL DEFAULT 'STATIC',
    "static_avatar_id" VARCHAR(64),
    "level" INTEGER NOT NULL DEFAULT 1,
    "experience" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "characters_user_id_key" ON "characters"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "characters_name_key_key" ON "characters"("name_key");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
