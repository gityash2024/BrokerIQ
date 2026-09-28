-- CreateEnum
CREATE TYPE "BrokerageType" AS ENUM ('NONE', 'DAYS_15', 'MONTH_1', 'FIXED');

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "brokerageAmount" DOUBLE PRECISION,
ADD COLUMN     "brokerageType" "BrokerageType";
