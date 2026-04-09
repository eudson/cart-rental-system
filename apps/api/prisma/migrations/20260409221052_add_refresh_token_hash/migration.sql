-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "refresh_token_hash" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "refresh_token_hash" TEXT;
