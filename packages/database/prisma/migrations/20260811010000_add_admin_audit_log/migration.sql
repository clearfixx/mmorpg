CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "payload_hash" CHAR(64) NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "target_type" VARCHAR(32) NOT NULL,
    "target_id" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "before" JSONB NOT NULL,
    "after" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_audit_logs_actor_user_id_idempotency_key_key"
ON "admin_audit_logs"("actor_user_id", "idempotency_key");

CREATE INDEX "admin_audit_logs_target_type_target_id_created_at_idx"
ON "admin_audit_logs"("target_type", "target_id", "created_at");

CREATE INDEX "admin_audit_logs_actor_user_id_created_at_idx"
ON "admin_audit_logs"("actor_user_id", "created_at");

ALTER TABLE "admin_audit_logs"
ADD CONSTRAINT "admin_audit_logs_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
