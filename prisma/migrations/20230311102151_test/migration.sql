/*
  Warnings:

  - You are about to drop the column `test` on the `Todo` table. All the data in the column will be lost.
  - You are about to drop the `Test` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "Todo" DROP COLUMN "test";

-- DropTable
DROP TABLE "Test";
