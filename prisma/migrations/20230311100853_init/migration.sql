/*
  Warnings:

  - Added the required column `test` to the `TodoItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "TodoItem" ADD COLUMN     "test" TEXT NOT NULL;
