-- Add حساب پی without changing or deleting historical payment methods.
ALTER TYPE "public"."PaymentMethod" ADD VALUE IF NOT EXISTS 'HESAB_PAY';

-- New customer payments must choose a method explicitly in the application.
ALTER TABLE "public"."payments" ALTER COLUMN "method" DROP DEFAULT;
