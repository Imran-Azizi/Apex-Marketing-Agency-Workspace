-- WhatsApp Cloud API inbound idempotency + CRM source filter index
CREATE TABLE IF NOT EXISTS "whatsapp_inbound_events" (
    "id" TEXT NOT NULL,
    "providerMsgId" TEXT NOT NULL,
    "fromWaId" TEXT NOT NULL,
    "normalizedWa" TEXT,
    "displayName" TEXT,
    "textPreview" VARCHAR(280),
    "sourceHint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "crmCustomerId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_inbound_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_inbound_events_providerMsgId_key"
  ON "whatsapp_inbound_events"("providerMsgId");

CREATE INDEX IF NOT EXISTS "whatsapp_inbound_events_status_createdAt_idx"
  ON "whatsapp_inbound_events"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "whatsapp_inbound_events_normalizedWa_idx"
  ON "whatsapp_inbound_events"("normalizedWa");

CREATE INDEX IF NOT EXISTS "whatsapp_inbound_events_crmCustomerId_idx"
  ON "whatsapp_inbound_events"("crmCustomerId");

CREATE INDEX IF NOT EXISTS "whatsapp_inbound_events_createdAt_idx"
  ON "whatsapp_inbound_events"("createdAt");

DO $$ BEGIN
  ALTER TABLE "whatsapp_inbound_events"
    ADD CONSTRAINT "whatsapp_inbound_events_crmCustomerId_fkey"
    FOREIGN KEY ("crmCustomerId") REFERENCES "crm_customers"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "crm_customers_source_idx" ON "crm_customers"("source");
