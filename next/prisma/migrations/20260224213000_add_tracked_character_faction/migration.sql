-- CreateEnum
CREATE TYPE "Faction" AS ENUM ('HORDE', 'ALLIANCE');

-- AlterTable
ALTER TABLE "tracked_characters"
ADD COLUMN "faction" "Faction";
