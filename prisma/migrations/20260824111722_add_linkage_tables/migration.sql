-- CreateEnum
CREATE TYPE "LinkageHintKind" AS ENUM ('resume_project', 'resume_outdated', 'roadmap_outdated');

-- CreateTable
CREATE TABLE "linkage_hints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "LinkageHintKind" NOT NULL,
    "ref_version" TEXT NOT NULL,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkage_hints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direction_resolutions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "profile_version" INTEGER NOT NULL,
    "profile_direction" TEXT NOT NULL,
    "match_direction" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direction_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linkage_hints_user_id_idx" ON "linkage_hints"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "linkage_hints_user_id_kind_ref_version_key" ON "linkage_hints"("user_id", "kind", "ref_version");

-- CreateIndex
CREATE INDEX "direction_resolutions_user_id_idx" ON "direction_resolutions"("user_id");

-- AddForeignKey
ALTER TABLE "linkage_hints" ADD CONSTRAINT "linkage_hints_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direction_resolutions" ADD CONSTRAINT "direction_resolutions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
