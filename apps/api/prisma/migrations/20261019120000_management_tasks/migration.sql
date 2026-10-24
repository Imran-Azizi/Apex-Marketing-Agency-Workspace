-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'ISSUE_REPORTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "management_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assigneeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "issueReportedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "declineNote" TEXT,
    "issueNote" TEXT,
    "rejectionNote" TEXT,
    "completionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "management_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "management_task_activities" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "fromStatus" "TaskStatus",
    "toStatus" "TaskStatus",
    "message" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "management_task_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "management_tasks_assigneeId_status_idx" ON "management_tasks"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "management_tasks_createdById_createdAt_idx" ON "management_tasks"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "management_tasks_status_deadline_idx" ON "management_tasks"("status", "deadline");

-- CreateIndex
CREATE INDEX "management_tasks_priority_status_idx" ON "management_tasks"("priority", "status");

-- CreateIndex
CREATE INDEX "management_tasks_deadline_idx" ON "management_tasks"("deadline");

-- CreateIndex
CREATE INDEX "management_tasks_deletedAt_idx" ON "management_tasks"("deletedAt");

-- CreateIndex
CREATE INDEX "management_tasks_createdAt_idx" ON "management_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "management_task_activities_taskId_createdAt_idx" ON "management_task_activities"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "management_task_activities_actorId_createdAt_idx" ON "management_task_activities"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_task_activities" ADD CONSTRAINT "management_task_activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "management_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_task_activities" ADD CONSTRAINT "management_task_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
