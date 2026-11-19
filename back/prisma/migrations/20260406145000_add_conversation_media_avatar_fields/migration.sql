-- AlterTable
ALTER TABLE "conversations"
ADD COLUMN     "contactRemoteId" TEXT,
ADD COLUMN     "contactAvatarUrl" TEXT;

-- AlterTable
ALTER TABLE "leads"
ADD COLUMN     "avatarUrl" TEXT;

-- AlterTable
ALTER TABLE "messages"
ADD COLUMN     "mediaType" TEXT,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER;
