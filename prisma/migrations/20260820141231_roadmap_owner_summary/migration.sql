/*
  Warnings:

  - Added the required column `user_id` to the `roadmaps` table without a default value. This is not possible if the table is not empty.

  M3(任务 3.1)手工编辑:user_id 先以可空加入 → 从 profile_id 关联的 career_profiles.user_id 回填存量数据 → 再置为 NOT NULL,
  保证存量路线图零数据损失。
*/
-- AlterTable
ALTER TABLE "roadmaps" ADD COLUMN     "summary" JSONB,
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "profile_id" DROP NOT NULL;

-- Backfill:存量路线图的 user_id 取自其关联画像的 user_id
UPDATE "roadmaps"
SET "user_id" = "career_profiles"."user_id"
FROM "career_profiles"
WHERE "roadmaps"."profile_id" = "career_profiles"."id";

-- 回填后置为必填(若仍有 NULL 说明存在无画像的孤立行,按 3.1 语义不允许)
ALTER TABLE "roadmaps" ALTER COLUMN "user_id" SET NOT NULL;

-- CreateIndex
CREATE INDEX "roadmaps_user_id_idx" ON "roadmaps"("user_id");

-- AddForeignKey
ALTER TABLE "roadmaps" ADD CONSTRAINT "roadmaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
