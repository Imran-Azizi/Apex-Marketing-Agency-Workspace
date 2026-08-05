-- Remove CRM "interested service" field completely.

ALTER TABLE "crm_customers" DROP CONSTRAINT IF EXISTS "crm_customers_interestedServiceId_fkey";
DROP INDEX IF EXISTS "crm_customers_interestedServiceId_idx";
ALTER TABLE "crm_customers" DROP COLUMN IF EXISTS "interestedServiceId";
