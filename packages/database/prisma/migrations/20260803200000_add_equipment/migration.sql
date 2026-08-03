CREATE TYPE "EquipmentSlot" AS ENUM ('MAIN_HAND');

CREATE TABLE "equipment_assignments" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "slot" "EquipmentSlot" NOT NULL,
  "equipped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_commands" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_assignments_item_id_key" ON "equipment_assignments"("item_id");
CREATE UNIQUE INDEX "equipment_assignments_character_id_slot_key" ON "equipment_assignments"("character_id", "slot");
CREATE UNIQUE INDEX "inventory_commands_character_id_idempotency_key_key" ON "inventory_commands"("character_id", "idempotency_key");

ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "item_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_commands" ADD CONSTRAINT "inventory_commands_character_id_fkey"
FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
