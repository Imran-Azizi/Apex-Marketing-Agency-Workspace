-- CreateEnum
CREATE TYPE "CompensationType" AS ENUM ('FIXED', 'PROJECT_SHARE');

-- CreateEnum
CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('OPEN', 'SETTLED');

-- AlterTable expenses: company-expense detail fields
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "recipient" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "accountLabel" TEXT;
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "paidByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "expenses_category_expenseDate_idx" ON "expenses"("category", "expenseDate");
CREATE INDEX IF NOT EXISTS "expenses_paidByUserId_idx" ON "expenses"("paidByUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_paidByUserId_fkey'
  ) THEN
    ALTER TABLE "expenses"
      ADD CONSTRAINT "expenses_paidByUserId_fkey"
      FOREIGN KEY ("paidByUserId") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable employee_compensation_profiles
CREATE TABLE IF NOT EXISTS "employee_compensation_profiles" (
    "id" TEXT NOT NULL,
    "teamProfileId" TEXT NOT NULL,
    "type" "CompensationType" NOT NULL DEFAULT 'PROJECT_SHARE',
    "fixedMonthlyAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'AFN',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_compensation_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_compensation_profiles_teamProfileId_key"
  ON "employee_compensation_profiles"("teamProfileId");
CREATE INDEX IF NOT EXISTS "employee_compensation_profiles_type_isActive_idx"
  ON "employee_compensation_profiles"("type", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_compensation_profiles_teamProfileId_fkey'
  ) THEN
    ALTER TABLE "employee_compensation_profiles"
      ADD CONSTRAINT "employee_compensation_profiles_teamProfileId_fkey"
      FOREIGN KEY ("teamProfileId") REFERENCES "team_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable salary_payments
CREATE TABLE IF NOT EXISTS "salary_payments" (
    "id" TEXT NOT NULL,
    "teamProfileId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod" NOT NULL,
    "notes" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "salary_payments_teamProfileId_paidAt_idx"
  ON "salary_payments"("teamProfileId", "paidAt");
CREATE INDEX IF NOT EXISTS "salary_payments_recordedById_idx"
  ON "salary_payments"("recordedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salary_payments_teamProfileId_fkey'
  ) THEN
    ALTER TABLE "salary_payments"
      ADD CONSTRAINT "salary_payments_teamProfileId_fkey"
      FOREIGN KEY ("teamProfileId") REFERENCES "team_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salary_payments_recordedById_fkey'
  ) THEN
    ALTER TABLE "salary_payments"
      ADD CONSTRAINT "salary_payments_recordedById_fkey"
      FOREIGN KEY ("recordedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable salary_advances
CREATE TABLE IF NOT EXISTS "salary_advances" (
    "id" TEXT NOT NULL,
    "teamProfileId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" "PaymentMethod",
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "recordedById" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_advances_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "salary_advances_teamProfileId_status_idx"
  ON "salary_advances"("teamProfileId", "status");
CREATE INDEX IF NOT EXISTS "salary_advances_recordedById_idx"
  ON "salary_advances"("recordedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salary_advances_teamProfileId_fkey'
  ) THEN
    ALTER TABLE "salary_advances"
      ADD CONSTRAINT "salary_advances_teamProfileId_fkey"
      FOREIGN KEY ("teamProfileId") REFERENCES "team_profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salary_advances_recordedById_fkey'
  ) THEN
    ALTER TABLE "salary_advances"
      ADD CONSTRAINT "salary_advances_recordedById_fkey"
      FOREIGN KEY ("recordedById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable finance_pnl_targets
CREATE TABLE IF NOT EXISTS "finance_pnl_targets" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "netProfitTarget" DECIMAL(14,2) NOT NULL,
    "advertisingBudget" DECIMAL(14,2) NOT NULL,
    "createdById" TEXT,
    "lastAnalysis" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_pnl_targets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_pnl_targets_year_month_key"
  ON "finance_pnl_targets"("year", "month");
CREATE INDEX IF NOT EXISTS "finance_pnl_targets_createdById_idx"
  ON "finance_pnl_targets"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_pnl_targets_createdById_fkey'
  ) THEN
    ALTER TABLE "finance_pnl_targets"
      ADD CONSTRAINT "finance_pnl_targets_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
