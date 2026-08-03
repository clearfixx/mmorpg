ALTER TABLE "battles"
ADD COLUMN "pending_state" JSONB,
ADD COLUMN "enemy_ready_at" TIMESTAMP(3);
