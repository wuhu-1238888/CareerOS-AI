/*
  Warnings:

  - You are about to alter the column `match_score` on the `career_paths` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.

*/
-- AlterTable
ALTER TABLE "agent_runs" ADD COLUMN     "progress" JSONB;

-- AlterTable
ALTER TABLE "career_paths" ALTER COLUMN "match_score" SET DATA TYPE INTEGER;
