/*
  Warnings:

  - You are about to drop the column `receiverZone` on the `ActionsPacking` table. All the data in the column will be lost.
  - You are about to drop the column `senderZone` on the `ActionsPacking` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ActionsPacking" DROP COLUMN "receiverZone",
DROP COLUMN "senderZone",
ADD COLUMN     "endZone" TEXT,
ADD COLUMN     "startZone" TEXT;
