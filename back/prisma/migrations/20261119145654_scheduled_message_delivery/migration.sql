-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScheduledMessageStatus" ADD VALUE 'SENDING';
ALTER TYPE "ScheduledMessageStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "scheduled_messages" ADD COLUMN     "error" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3);

