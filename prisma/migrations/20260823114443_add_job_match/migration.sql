-- CreateTable
CREATE TABLE "job_matches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "jd_text" TEXT,
    "jd_title" TEXT,
    "match_report" JSONB,
    "coach_plan" JSONB,
    "weekly_hours" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_matches_user_id_key" ON "job_matches"("user_id");

-- AddForeignKey
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
