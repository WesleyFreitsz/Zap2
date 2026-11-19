-- AlterTable
ALTER TABLE "scheduled_messages" ADD COLUMN     "template" JSONB;

-- AlterTable
ALTER TABLE "integrations" ADD COLUMN     "wabaId" TEXT;
