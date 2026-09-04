-- Add Project Manager to RoleCode enum (must be committed before use in a follow-up migration).

ALTER TYPE "RoleCode" ADD VALUE IF NOT EXISTS 'PROJECT_MANAGER';
