-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "channel" "IntegrationType" NOT NULL DEFAULT 'WHATSAPP',
ADD COLUMN     "contactRemoteId" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "leads_companyId_channel_contactRemoteId_key" ON "leads"("companyId", "channel", "contactRemoteId");

