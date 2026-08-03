ALTER TABLE "battles" ADD COLUMN "active_character_id" UUID;

UPDATE "battles"
SET "active_character_id" = "character_id"
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "battles_active_character_id_key"
ON "battles"("active_character_id");
