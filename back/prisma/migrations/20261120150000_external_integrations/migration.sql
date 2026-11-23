ALTER TABLE "conversations" ADD COLUMN "zendeskTicketId" TEXT,
ADD COLUMN "zendeskRequesterId" TEXT,
ADD COLUMN "zendeskLastCommentId" TEXT;

CREATE TABLE "automation_configs" (
    "companyId" TEXT NOT NULL,
    "webhookUrl" TEXT,
    "apiKeyHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "automation_configs_pkey" PRIMARY KEY ("companyId")
);

CREATE TABLE "zendesk_configs" (
    "companyId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "apiTokenEncrypted" TEXT NOT NULL,
    "webhookTokenHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "zendesk_configs_pkey" PRIMARY KEY ("companyId")
);

CREATE UNIQUE INDEX "automation_configs_apiKeyHash_key" ON "automation_configs"("apiKeyHash");
CREATE UNIQUE INDEX "zendesk_configs_webhookTokenHash_key" ON "zendesk_configs"("webhookTokenHash");

ALTER TABLE "automation_configs" ADD CONSTRAINT "automation_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "zendesk_configs" ADD CONSTRAINT "zendesk_configs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
