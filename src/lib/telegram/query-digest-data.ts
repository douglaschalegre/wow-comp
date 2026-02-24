import { JobStatus, JobType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type PollStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILED";

export interface DigestPollSummary {
  pollJobRunId: string;
  status: PollStatus;
  warningCount?: number;
  errorCount?: number;
}

export interface DigestScoreProfileSummary {
  name: string;
  version: number;
}

export interface DigestLeaderboardRow {
  rank: number | null;
  characterName: string;
  region: "US" | "EU";
  realmSlug: string;
  totalScore: number;
  dailyDelta: number;
}

export interface DigestMilestoneLine {
  rank: number | null;
  characterName: string;
  region: "US" | "EU";
  realmSlug: string;
  dailyDelta: number;
  text: string;
}

export interface DigestStandingsData {
  variant: "standings";
  snapshotDate: Date;
  pollSummary: DigestPollSummary;
  scoreProfile: DigestScoreProfileSummary;
  rows: DigestLeaderboardRow[];
  topMovers: DigestLeaderboardRow[];
  milestones: DigestMilestoneLine[];
  warnings: string[];
}

export interface DigestPollFailureData {
  variant: "poll_failure";
  snapshotDate: Date;
  pollSummary: DigestPollSummary;
  failureMessage: string;
  warnings: string[];
}

export type DigestData = DigestStandingsData | DigestPollFailureData;

interface ParsedPollJobDetails {
  warningCount?: number;
  errorCount?: number;
  results: ParsedPollJobResult[];
  message?: string;
}

interface ParsedPollJobResult {
  characterName: string;
  realmSlug: string;
  region: "US" | "EU";
  ok: boolean;
  warnings: string[];
  error?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function asStringArray(value: unknown): string[] {
  return asArray(value)
    .map((item) => asString(item))
    .filter((item): item is string => Boolean(item && item.trim().length > 0));
}

function parsePollJobDetails(detailsJson: Prisma.JsonValue | null): ParsedPollJobDetails {
  const record = asRecord(detailsJson);
  const results = asArray(record?.results)
    .map((item): ParsedPollJobResult | null => {
      const result = asRecord(item);
      const character = asRecord(result?.character);

      const characterName = asString(character?.characterName);
      const realmSlug = asString(character?.realmSlug);
      const region = asString(character?.region);

      if (!characterName || !realmSlug || (region !== "US" && region !== "EU")) {
        return null;
      }

      return {
        characterName,
        realmSlug,
        region,
        ok: result?.ok === true,
        warnings: asStringArray(result?.warnings),
        error: asString(result?.error)
      };
    })
    .filter((item): item is ParsedPollJobResult => item !== null);

  return {
    warningCount: asNumber(record?.warningCount),
    errorCount: asNumber(record?.errorCount),
    results,
    message: asString(record?.message)
  };
}

function formatCharacterLabel(character: {
  characterName: string;
  region: "US" | "EU";
  realmSlug: string;
}): string {
  return `${character.characterName} (${character.region}/${character.realmSlug})`;
}

function buildPollWarnings(results: ParsedPollJobResult[]): string[] {
  const warnings: string[] = [];

  for (const result of results) {
    const label = formatCharacterLabel(result);

    if (!result.ok && result.error) {
      warnings.push(`ERROR ${label}: ${result.error}`);
    }

    for (const warning of result.warnings) {
      warnings.push(`WARN ${label}: ${warning}`);
    }
  }

  return warnings;
}

function parseMilestones(value: Prisma.JsonValue): string[] {
  return asStringArray(value);
}

function rankSortValue(rank: number | null): number {
  return rank ?? Number.MAX_SAFE_INTEGER;
}

export function formatUtcSnapshotDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function queryDigestData(snapshotDate: Date): Promise<DigestData> {
  const pollJob = await prisma.jobRun.findFirst({
    where: {
      jobType: JobType.POLL,
      snapshotDate,
      status: {
        in: [JobStatus.SUCCESS, JobStatus.PARTIAL_FAILURE, JobStatus.FAILED]
      }
    },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      detailsJson: true
    }
  });

  if (!pollJob) {
    throw new Error(`NO_POLL_JOB_FOR_DATE: No completed poll job found for ${formatUtcSnapshotDate(snapshotDate)}.`);
  }

  const parsedPoll = parsePollJobDetails(pollJob.detailsJson);
  const pollSummary: DigestPollSummary = {
    pollJobRunId: pollJob.id,
    status: pollJob.status as PollStatus,
    warningCount: parsedPoll.warningCount,
    errorCount: parsedPoll.errorCount
  };

  if (pollJob.status === JobStatus.FAILED) {
    return {
      variant: "poll_failure",
      snapshotDate,
      pollSummary,
      failureMessage: parsedPoll.message ?? "Poll job failed with no error details.",
      warnings: []
    };
  }

  const activeProfile = await prisma.scoreProfile.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      version: true
    }
  });

  if (!activeProfile) {
    throw new Error("NO_ACTIVE_SCORE_PROFILE: No active score profile found for digest generation.");
  }

  const scores = await prisma.leaderboardScore.findMany({
    where: {
      scoreProfileId: activeProfile.id,
      snapshot: { snapshotDate },
      trackedCharacter: { active: true }
    },
    select: {
      trackedCharacterId: true,
      rank: true,
      totalScore: true,
      dailyDelta: true,
      snapshotId: true,
      trackedCharacter: {
        select: {
          characterName: true,
          region: true,
          realmSlug: true
        }
      }
    },
    orderBy: [{ rank: "asc" }, { totalScore: "desc" }, { trackedCharacter: { characterName: "asc" } }]
  });

  const rows: DigestLeaderboardRow[] = scores.map((score) => ({
    rank: score.rank,
    characterName: score.trackedCharacter.characterName,
    region: score.trackedCharacter.region,
    realmSlug: score.trackedCharacter.realmSlug,
    totalScore: score.totalScore,
    dailyDelta: score.dailyDelta
  }));

  const scoreMetaBySnapshotId = new Map(
    scores.map((score) => [
      score.snapshotId,
      {
        rank: score.rank,
        dailyDelta: score.dailyDelta
      }
    ])
  );

  const deltas = scores.length
    ? await prisma.characterMetricDelta.findMany({
        where: {
          toSnapshotId: { in: scores.map((score) => score.snapshotId) }
        },
        select: {
          toSnapshotId: true,
          milestonesJson: true,
          trackedCharacter: {
            select: {
              characterName: true,
              region: true,
              realmSlug: true
            }
          }
        }
      })
    : [];

  const milestones: DigestMilestoneLine[] = [];
  for (const delta of deltas) {
    const scoreMeta = scoreMetaBySnapshotId.get(delta.toSnapshotId);
    if (!scoreMeta) continue;

    for (const milestone of parseMilestones(delta.milestonesJson)) {
      milestones.push({
        rank: scoreMeta.rank,
        characterName: delta.trackedCharacter.characterName,
        region: delta.trackedCharacter.region,
        realmSlug: delta.trackedCharacter.realmSlug,
        dailyDelta: scoreMeta.dailyDelta,
        text: milestone
      });
    }
  }

  milestones.sort((a, b) => {
    if (b.dailyDelta !== a.dailyDelta) return b.dailyDelta - a.dailyDelta;
    if (rankSortValue(a.rank) !== rankSortValue(b.rank)) return rankSortValue(a.rank) - rankSortValue(b.rank);
    return a.characterName.localeCompare(b.characterName);
  });

  const topMovers = [...rows]
    .filter((row) => row.dailyDelta > 0)
    .sort((a, b) => {
      if (b.dailyDelta !== a.dailyDelta) return b.dailyDelta - a.dailyDelta;
      if (rankSortValue(a.rank) !== rankSortValue(b.rank)) return rankSortValue(a.rank) - rankSortValue(b.rank);
      return a.characterName.localeCompare(b.characterName);
    });

  const warnings = buildPollWarnings(parsedPoll.results);

  return {
    variant: "standings",
    snapshotDate,
    pollSummary: {
      ...pollSummary,
      warningCount: pollSummary.warningCount ?? warnings.length,
      errorCount:
        pollSummary.errorCount ??
        parsedPoll.results.filter((result) => !result.ok || Boolean(result.error)).length
    },
    scoreProfile: {
      name: activeProfile.name,
      version: activeProfile.version
    },
    rows,
    topMovers,
    milestones,
    warnings
  };
}
