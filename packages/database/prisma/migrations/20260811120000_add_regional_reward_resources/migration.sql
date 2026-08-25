ALTER TYPE "ResourceType" ADD VALUE IF NOT EXISTS 'WEAPON_FRAGMENT';

CREATE TABLE "reward_claim_resources" (
  "id" UUID NOT NULL,
  "reward_claim_id" UUID NOT NULL,
  "type" "ResourceType" NOT NULL,
  "amount" INTEGER NOT NULL,
  CONSTRAINT "reward_claim_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reward_claim_resources_reward_claim_id_type_key"
  ON "reward_claim_resources"("reward_claim_id", "type");

ALTER TABLE "reward_claim_resources"
  ADD CONSTRAINT "reward_claim_resources_reward_claim_id_fkey"
  FOREIGN KEY ("reward_claim_id") REFERENCES "reward_claims"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "reward_claim_resources" ("id", "reward_claim_id", "type", "amount")
SELECT gen_random_uuid(), "id", "resource_type", "resource_amount"
FROM "reward_claims"
WHERE "resource_amount" > 0
ON CONFLICT ("reward_claim_id", "type") DO NOTHING;
