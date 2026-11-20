-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "reaction" TEXT,
ADD COLUMN     "status" "MessageStatus";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "lastReadAt" TIMESTAMP(3);

-- Existing conversations start as read so the counter does not show the whole history
UPDATE "conversations" SET "lastReadAt" = NOW();
