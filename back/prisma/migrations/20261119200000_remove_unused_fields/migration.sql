-- Preserva dados antes de remover colunas e valores de enum
UPDATE "products" SET "imageUrl" = COALESCE("imageUrl", "image");
UPDATE "conversations" SET "status" = 'OPEN' WHERE "status" IN ('PENDING', 'BOT');

-- AlterEnum
BEGIN;
CREATE TYPE "ConversationStatus_new" AS ENUM ('OPEN', 'CLOSED', 'TRANSFERRED');
ALTER TABLE "conversations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "conversations" ALTER COLUMN "status" TYPE "ConversationStatus_new" USING ("status"::text::"ConversationStatus_new");
ALTER TYPE "ConversationStatus" RENAME TO "ConversationStatus_old";
ALTER TYPE "ConversationStatus_new" RENAME TO "ConversationStatus";
DROP TYPE "ConversationStatus_old";
ALTER TABLE "conversations" ALTER COLUMN "status" SET DEFAULT 'OPEN';
COMMIT;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "image";

-- AlterTable
ALTER TABLE "ai_configs" DROP COLUMN "aiName",
DROP COLUMN "autoReply",
DROP COLUMN "fallbackMessage",
DROP COLUMN "greeting",
DROP COLUMN "salesMode";

