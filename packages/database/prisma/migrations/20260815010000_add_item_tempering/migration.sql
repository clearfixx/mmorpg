CREATE TYPE "TemperingJobStatus" AS ENUM ('ACTIVE', 'SUCCEEDED', 'PROGRESS_GAINED', 'CANCELLED');

ALTER TYPE "ResourceType" ADD VALUE 'TEMPERING_STONE_DULL';
ALTER TYPE "ResourceType" ADD VALUE 'TEMPERING_STONE_WHOLE';
ALTER TYPE "ResourceType" ADD VALUE 'TEMPERING_STONE_FLAWLESS';
ALTER TYPE "ResourceType" ADD VALUE 'TEMPERING_STONE_MYTHIC';
ALTER TYPE "ResourceType" ADD VALUE 'TEMPERING_STONE_DIVINE';
ALTER TYPE "ItemLineageType" ADD VALUE 'TEMPERING';

ALTER TABLE "item_instances"
  ADD COLUMN "tempering_stage" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tempering_progress" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tempering_version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "tempering_jobs" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "active_item_id" UUID,
  "starting_stage" INTEGER NOT NULL,
  "target_stage" INTEGER NOT NULL,
  "starting_progress" INTEGER NOT NULL,
  "acceleration_percent" INTEGER NOT NULL DEFAULT 0,
  "cost_snapshot" JSONB NOT NULL,
  "status" "TemperingJobStatus" NOT NULL DEFAULT 'ACTIVE',
  "result_progress" INTEGER,
  "guaranteed" BOOLEAN,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_at" TIMESTAMP(3) NOT NULL,
  "resolved_at" TIMESTAMP(3),
  CONSTRAINT "tempering_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tempering_commands" (
  "id" UUID NOT NULL,
  "character_id" UUID NOT NULL,
  "tempering_job_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "command_type" VARCHAR(24) NOT NULL,
  "payload_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tempering_commands_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tempering_jobs_active_item_id_key" ON "tempering_jobs"("active_item_id");
CREATE INDEX "tempering_jobs_character_id_status_ready_at_idx" ON "tempering_jobs"("character_id", "status", "ready_at");
CREATE INDEX "tempering_jobs_item_id_started_at_idx" ON "tempering_jobs"("item_id", "started_at");
CREATE UNIQUE INDEX "tempering_commands_character_id_idempotency_key_key" ON "tempering_commands"("character_id", "idempotency_key");
CREATE INDEX "tempering_commands_tempering_job_id_created_at_idx" ON "tempering_commands"("tempering_job_id", "created_at");

ALTER TABLE "tempering_jobs" ADD CONSTRAINT "tempering_jobs_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tempering_jobs" ADD CONSTRAINT "tempering_jobs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "item_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tempering_commands" ADD CONSTRAINT "tempering_commands_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tempering_commands" ADD CONSTRAINT "tempering_commands_tempering_job_id_fkey" FOREIGN KEY ("tempering_job_id") REFERENCES "tempering_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
