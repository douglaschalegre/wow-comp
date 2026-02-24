-- CreateEnum
CREATE TYPE "Region" AS ENUM ('US', 'EU');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('POLL', 'REBUILD_LEADERBOARD');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL_FAILURE', 'FAILED');

-- CreateTable
CREATE TABLE "tracked_characters" (
    "id" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "realm_slug" TEXT NOT NULL,
    "character_name" TEXT NOT NULL,
    "character_name_lower" TEXT NOT NULL,
    "character_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracked_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_snapshots" (
    "id" TEXT NOT NULL,
    "tracked_character_id" TEXT NOT NULL,
    "snapshot_date" TIMESTAMP(3) NOT NULL,
    "polled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "raw_profile_json" JSONB NOT NULL,
    "raw_progress_json" JSONB NOT NULL,
    "normalized_metrics_json" JSONB NOT NULL,
    "source_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "character_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_metric_deltas" (
    "id" TEXT NOT NULL,
    "tracked_character_id" TEXT NOT NULL,
    "from_snapshot_id" TEXT,
    "to_snapshot_id" TEXT NOT NULL,
    "delta_json" JSONB NOT NULL,
    "milestones_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_metric_deltas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "source_hash" TEXT NOT NULL,
    "weights_json" JSONB NOT NULL,
    "normalization_caps_json" JSONB NOT NULL,
    "filters_json" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "score_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard_scores" (
    "id" TEXT NOT NULL,
    "tracked_character_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "score_profile_id" TEXT NOT NULL,
    "total_score" DOUBLE PRECISION NOT NULL,
    "daily_delta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "breakdown_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leaderboard_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "job_type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL,
    "snapshot_date" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "details_json" JSONB,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tracked_characters_active_idx" ON "tracked_characters"("active");

-- CreateIndex
CREATE UNIQUE INDEX "tracked_characters_unique_lookup" ON "tracked_characters"("region", "realm_slug", "character_name_lower");

-- CreateIndex
CREATE INDEX "character_snapshots_snapshot_date_idx" ON "character_snapshots"("snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "character_snapshots_daily_unique" ON "character_snapshots"("tracked_character_id", "snapshot_date");

-- CreateIndex
CREATE UNIQUE INDEX "character_metric_deltas_to_snapshot_unique" ON "character_metric_deltas"("to_snapshot_id");

-- CreateIndex
CREATE INDEX "character_metric_deltas_tracked_character_id_idx" ON "character_metric_deltas"("tracked_character_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_profiles_source_hash_key" ON "score_profiles"("source_hash");

-- CreateIndex
CREATE INDEX "score_profiles_is_active_idx" ON "score_profiles"("is_active");

-- CreateIndex
CREATE INDEX "leaderboard_scores_snapshot_id_score_profile_id_idx" ON "leaderboard_scores"("snapshot_id", "score_profile_id");

-- CreateIndex
CREATE INDEX "leaderboard_scores_score_profile_id_rank_idx" ON "leaderboard_scores"("score_profile_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_scores_unique" ON "leaderboard_scores"("tracked_character_id", "snapshot_id", "score_profile_id");

-- CreateIndex
CREATE INDEX "job_runs_job_type_started_at_idx" ON "job_runs"("job_type", "started_at");

-- AddForeignKey
ALTER TABLE "character_snapshots" ADD CONSTRAINT "character_snapshots_tracked_character_id_fkey" FOREIGN KEY ("tracked_character_id") REFERENCES "tracked_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_metric_deltas" ADD CONSTRAINT "character_metric_deltas_tracked_character_id_fkey" FOREIGN KEY ("tracked_character_id") REFERENCES "tracked_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_metric_deltas" ADD CONSTRAINT "character_metric_deltas_from_snapshot_id_fkey" FOREIGN KEY ("from_snapshot_id") REFERENCES "character_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_metric_deltas" ADD CONSTRAINT "character_metric_deltas_to_snapshot_id_fkey" FOREIGN KEY ("to_snapshot_id") REFERENCES "character_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_tracked_character_id_fkey" FOREIGN KEY ("tracked_character_id") REFERENCES "tracked_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "character_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard_scores" ADD CONSTRAINT "leaderboard_scores_score_profile_id_fkey" FOREIGN KEY ("score_profile_id") REFERENCES "score_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
