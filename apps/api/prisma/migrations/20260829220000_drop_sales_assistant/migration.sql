-- Remove Sales Assistant feature tables

DROP INDEX IF EXISTS "sales_assistant_open_kind_uidx";

DROP TABLE IF EXISTS "sales_assistant_recommendations";
DROP TABLE IF EXISTS "sales_assistant_settings";
DROP TABLE IF EXISTS "sales_assistant_daily_reports";
DROP TABLE IF EXISTS "sales_assistant_runs";
