-- CreateTable
CREATE TABLE "contract_company_profiles" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyIntro" TEXT,
    "features" JSONB,
    "audience" TEXT,
    "goal" TEXT,
    "mainMessage" TEXT,
    "cta" TEXT,
    "address" TEXT,
    "contactNumbers" JSONB,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_company_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_calendars" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_calendar_items" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "publishDate" TIMESTAMP(3),

    CONSTRAINT "content_calendar_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_shares" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "refId" TEXT NOT NULL DEFAULT '',
    "channel" TEXT NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL,
    "sharedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contract_company_profiles_projectId_key" ON "contract_company_profiles"("projectId");

-- CreateIndex
CREATE INDEX "content_calendars_projectId_idx" ON "content_calendars"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "content_calendar_items_calendarId_position_key" ON "content_calendar_items"("calendarId", "position");

-- CreateIndex
CREATE INDEX "contract_shares_projectId_idx" ON "contract_shares"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "contract_shares_projectId_section_refId_key" ON "contract_shares"("projectId", "section", "refId");

-- AddForeignKey
ALTER TABLE "contract_company_profiles" ADD CONSTRAINT "contract_company_profiles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_calendars" ADD CONSTRAINT "content_calendars_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_calendar_items" ADD CONSTRAINT "content_calendar_items_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "content_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_shares" ADD CONSTRAINT "contract_shares_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
