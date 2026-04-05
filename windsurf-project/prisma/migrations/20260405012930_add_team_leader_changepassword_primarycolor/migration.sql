-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "primaryColor" TEXT,
ADD COLUMN     "secondaryColor" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "isFounder" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isTeamLeader" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "annualPrice" DOUBLE PRECISION NOT NULL,
    "maxNumbers" INTEGER NOT NULL DEFAULT 1,
    "maxEmployees" INTEGER NOT NULL DEFAULT 5,
    "maxTeamLeaders" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '[]',
    "founderSlots" INTEGER NOT NULL DEFAULT 10,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plans_slug_key" ON "plans"("slug");
