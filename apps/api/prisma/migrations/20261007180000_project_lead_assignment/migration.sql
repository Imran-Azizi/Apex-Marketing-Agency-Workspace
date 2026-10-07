-- Allow assigning an employee as full project lead (scoped management access)
ALTER TYPE "AssignmentRole" ADD VALUE IF NOT EXISTS 'PROJECT_LEAD';
ALTER TYPE "TeamKind" ADD VALUE IF NOT EXISTS 'PROJECT_MANAGER';
