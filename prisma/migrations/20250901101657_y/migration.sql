/*
  Warnings:

  - You are about to drop the column `photoCouneter` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "photoCouneter",
ADD COLUMN     "limit" INTEGER NOT NULL DEFAULT 2;
