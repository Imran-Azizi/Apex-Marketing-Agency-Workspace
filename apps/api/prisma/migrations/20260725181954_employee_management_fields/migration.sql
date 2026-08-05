-- AlterEnum
ALTER TYPE "RoleCode" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "profileImage" TEXT;
