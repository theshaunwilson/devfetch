-- Items can be filed in many collections rather than at most one.
--
-- Written by hand rather than generated, because a generated migration would
-- drop `Item.collectionId` and take every existing filing with it. The join
-- table is created first, every non-null `collectionId` is copied into it, and
-- only then does the column go.

-- CreateTable
CREATE TABLE "ItemCollection" (
    "itemId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCollection_pkey" PRIMARY KEY ("itemId","collectionId")
);

-- CreateIndex
CREATE INDEX "ItemCollection_collectionId_idx" ON "ItemCollection"("collectionId");

-- AddForeignKey
ALTER TABLE "ItemCollection" ADD CONSTRAINT "ItemCollection_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCollection" ADD CONSTRAINT "ItemCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry every existing filing over. `Item.createdAt` is used as the join row's
-- own timestamp: the filing is as old as the item, since nothing until now
-- could change it after the fact.
INSERT INTO "ItemCollection" ("itemId", "collectionId", "createdAt")
SELECT "id", "collectionId", "createdAt"
FROM "Item"
WHERE "collectionId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_collectionId_fkey";

-- DropIndex
DROP INDEX "Item_collectionId_idx";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "collectionId";
