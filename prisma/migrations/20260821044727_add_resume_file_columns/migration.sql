/*
  Warnings:

  - Added the required column `updated_at` to the `optimizations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "optimizations" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "resume_versions" ADD COLUMN     "ats_report" JSONB,
ADD COLUMN     "ats_scored_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "extract_error" TEXT,
ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "size_bytes" INTEGER,
ADD COLUMN     "storage_key" TEXT,
ALTER COLUMN "original_text" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "resumes_user_id_idx" ON "resumes"("user_id");
