-- CreateEnum
CREATE TYPE "ChannelProvider" AS ENUM ('WPPCONNECT', 'META');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "integrationId" TEXT;

-- AlterTable
ALTER TABLE "integrations" ADD COLUMN     "accessTokenEncrypted" TEXT,
ADD COLUMN     "externalAccountId" TEXT,
ADD COLUMN     "label" TEXT,
ADD COLUMN     "metaPageId" TEXT,
ADD COLUMN     "provider" "ChannelProvider" NOT NULL DEFAULT 'WPPCONNECT';

-- CreateIndex
CREATE INDEX "conversations_companyId_channel_contactRemoteId_idx" ON "conversations"("companyId", "channel", "contactRemoteId");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_type_externalAccountId_key" ON "integrations"("type", "externalAccountId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

