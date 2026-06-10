-- AlterTable
ALTER TABLE "Asset" ADD COLUMN "dividendFrequency" TEXT;

-- CreateTable
CREATE TABLE "AllocationTarget" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetType" TEXT NOT NULL,
    "targetPercent" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnalysisLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "script" TEXT,
    "sources" TEXT
);
INSERT INTO "new_AnalysisLog" ("date", "id", "script", "sources", "summary", "title") SELECT "date", "id", "script", "sources", "summary", "title" FROM "AnalysisLog";
DROP TABLE "AnalysisLog";
ALTER TABLE "new_AnalysisLog" RENAME TO "AnalysisLog";
CREATE INDEX "AnalysisLog_date_idx" ON "AnalysisLog"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AllocationTarget_assetType_key" ON "AllocationTarget"("assetType");
