-- CreateTable
CREATE TABLE "funnel_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "funnel_events_user_id_event_created_at_idx" ON "funnel_events"("user_id", "event", "created_at");

-- AddForeignKey
ALTER TABLE "funnel_events" ADD CONSTRAINT "funnel_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
