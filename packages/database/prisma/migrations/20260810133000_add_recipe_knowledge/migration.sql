CREATE TABLE "character_recipe_knowledge" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "recipe_id" VARCHAR(64) NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "discovered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_recipe_knowledge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "character_recipe_knowledge_character_id_recipe_id_key"
ON "character_recipe_knowledge"("character_id", "recipe_id");

CREATE INDEX "character_recipe_knowledge_character_id_discovered_at_idx"
ON "character_recipe_knowledge"("character_id", "discovered_at");

ALTER TABLE "character_recipe_knowledge"
ADD CONSTRAINT "character_recipe_knowledge_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
