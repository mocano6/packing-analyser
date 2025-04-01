-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "position" TEXT,
    "birthYear" INTEGER,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "opponent" TEXT NOT NULL,
    "isHome" BOOLEAN NOT NULL,
    "competition" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "time" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Match_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlayerMinutes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlayerMinutes_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PlayerMinutes_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionsPacking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "minute" INTEGER NOT NULL,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderNumber" INTEGER NOT NULL,
    "senderClickValue" REAL NOT NULL,
    "receiverId" TEXT NOT NULL,
    "receiverName" TEXT NOT NULL,
    "receiverNumber" INTEGER NOT NULL,
    "receiverClickValue" REAL NOT NULL,
    "packingPoints" INTEGER NOT NULL,
    "actionType" TEXT NOT NULL,
    "xTValue" REAL NOT NULL,
    "PxT" REAL,
    "isP3" BOOLEAN NOT NULL,
    "isShot" BOOLEAN NOT NULL,
    "isGoal" BOOLEAN NOT NULL,
    "isPenaltyAreaEntry" BOOLEAN,
    "isSecondHalf" BOOLEAN DEFAULT false,
    "matchId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "startZone" TEXT,
    "endZone" TEXT,
    CONSTRAINT "ActionsPacking_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActionsPacking_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ActionsPacking_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Player" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "_PlayerToTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_PlayerToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_PlayerToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "Match_teamId_idx" ON "Match"("teamId");

-- CreateIndex
CREATE INDEX "PlayerMinutes_matchId_idx" ON "PlayerMinutes"("matchId");

-- CreateIndex
CREATE INDEX "PlayerMinutes_playerId_idx" ON "PlayerMinutes"("playerId");

-- CreateIndex
CREATE INDEX "ActionsPacking_matchId_idx" ON "ActionsPacking"("matchId");

-- CreateIndex
CREATE INDEX "ActionsPacking_senderId_idx" ON "ActionsPacking"("senderId");

-- CreateIndex
CREATE INDEX "ActionsPacking_receiverId_idx" ON "ActionsPacking"("receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "_PlayerToTeam_AB_unique" ON "_PlayerToTeam"("A", "B");

-- CreateIndex
CREATE INDEX "_PlayerToTeam_B_index" ON "_PlayerToTeam"("B");
