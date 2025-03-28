-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "minute" INTEGER NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderNumber" INTEGER NOT NULL,
    "senderClickValue" DOUBLE PRECISION NOT NULL,
    "receiverId" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverNumber" INTEGER NOT NULL,
    "receiverClickValue" DOUBLE PRECISION NOT NULL,
    "zone" INTEGER NOT NULL,
    "basePoints" INTEGER NOT NULL,
    "multiplier" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "packingPoints" INTEGER NOT NULL,
    "xTValue" DOUBLE PRECISION NOT NULL,
    "isP3" BOOLEAN NOT NULL,
    "isShot" BOOLEAN NOT NULL,
    "isGoal" BOOLEAN NOT NULL,
    "isPenaltyAreaEntry" BOOLEAN,
    "matchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Action_matchId_idx" ON "Action"("matchId");

-- CreateIndex
CREATE INDEX "Action_senderId_idx" ON "Action"("senderId");

-- CreateIndex
CREATE INDEX "Action_receiverId_idx" ON "Action"("receiverId");

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
