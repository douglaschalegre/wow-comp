import type { FactionCode, ScoreNormalizationCaps, ScoreWeights } from "@/lib/types";
import { prisma } from "@/lib/db/prisma";

type RankChange = number | "NEW" | null;

export interface LeaderboardRowMetricsView {
  level: number;
  completedQuestCount: number;
  reputationProgressTotal: number;
  averageItemLevel: number;
  encounterKillScore: number;
  mythicPlusRunsCount: number;
  mythicPlusBestRunLevel: number;
  mythicPlusSeasonScore: number;
  achievementPoints: number;
  statisticsCompositeValue: number;
}

export interface LeaderboardScoreProfileView {
  name: string;
  version: number;
  weights: ScoreWeights;
  normalizationCaps: ScoreNormalizationCaps;
}

export interface LeaderboardRowView {
  trackedCharacterId: string;
  rank: number | null;
  characterName: string;
  portraitUrl: string | null;
  faction: FactionCode | null;
  realmSlug: string;
  region: "US" | "EU";
  level: number;
  itemLevel: number;
  mythicPlusRating: number;
  bestKeyLevel: number;
  completedQuestCount: number;
  reputationProgressTotal: number;
  totalScore: number;
  rankChange: RankChange;
  dailyDelta: number;
  questDelta: number | null;
  reputationDelta: number | null;
  polledAt: Date;
}

export interface LatestLeaderboardView {
  snapshotDate: Date | null;
  rows: LeaderboardRowView[];
  lastJob: {
    status: string;
    finishedAt: Date | null;
  } | null;
  scoreProfile: LeaderboardScoreProfileView | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function parseNormalizedMetrics(value: unknown): LeaderboardRowMetricsView {
  const record = asRecord(value);
  return {
    level: asNumber(record?.level),
    completedQuestCount: asNumber(record?.completedQuestCount),
    reputationProgressTotal: asNumber(record?.reputationProgressTotal),
    averageItemLevel: asNumber(record?.averageItemLevel),
    encounterKillScore: asNumber(record?.encounterKillScore),
    mythicPlusRunsCount: asNumber(record?.mythicPlusRunsCount),
    mythicPlusBestRunLevel: asNumber(record?.mythicPlusBestRunLevel),
    mythicPlusSeasonScore: asNumber(record?.mythicPlusSeasonScore),
    achievementPoints: asNumber(record?.achievementPoints),
    statisticsCompositeValue: asNumber(record?.statisticsCompositeValue)
  };
}

function parseDeltaJson(value: unknown): { questDelta: number | null; reputationDelta: number | null } {
  const record = asRecord(value);
  if (!record) {
    return { questDelta: null, reputationDelta: null };
  }

  const hasQuest = Object.prototype.hasOwnProperty.call(record, "completedQuestCount");
  const hasRep = Object.prototype.hasOwnProperty.call(record, "reputationProgressTotal");

  return {
    questDelta: hasQuest ? asNumber(record.completedQuestCount) : null,
    reputationDelta: hasRep ? asNumber(record.reputationProgressTotal) : null
  };
}

function parseScoreWeights(value: unknown): ScoreWeights | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    level: asNumber(record.level),
    itemLevel: asNumber(record.itemLevel),
    mythicPlusRating: asNumber(record.mythicPlusRating, asNumber(record.mythicPlus)),
    bestKey: asNumber(record.bestKey),
    quests: asNumber(record.quests),
    reputations: asNumber(record.reputations),
    encounters: asNumber(record.encounters),
    achievementsStatistics: asNumber(record.achievementsStatistics)
  };
}

function parseNormalizationCaps(value: unknown): ScoreNormalizationCaps | null {
  const record = asRecord(value);
  if (!record) return null;
  return {
    level: asNumber(record.level, 90),
    completedQuestCount: asNumber(record.completedQuestCount),
    reputationProgressTotal: asNumber(record.reputationProgressTotal),
    averageItemLevel: asNumber(record.averageItemLevel),
    encounterKillScore: asNumber(record.encounterKillScore),
    mythicPlusSeasonScore: asNumber(record.mythicPlusSeasonScore, asNumber(record.mythicPlusComposite, 4000)),
    mythicPlusBestRunLevel: asNumber(record.mythicPlusBestRunLevel, 20),
    achievementPoints: asNumber(record.achievementPoints),
    statisticsCompositeValue: asNumber(record.statisticsCompositeValue)
  };
}

export async function getLatestLeaderboardView(): Promise<LatestLeaderboardView> {
  if (!process.env.DATABASE_URL) {
    return {
      snapshotDate: null,
      rows: [],
      lastJob: null,
      scoreProfile: null
    };
  }

  const latestSnapshot = await prisma.characterSnapshot.findFirst({
    orderBy: { snapshotDate: "desc" },
    select: { snapshotDate: true }
  });

  const lastJob = await prisma.jobRun.findFirst({
    where: {
      jobType: "POLL"
    },
    orderBy: { startedAt: "desc" },
    select: {
      status: true,
      finishedAt: true
    }
  });

  if (!latestSnapshot) {
    return {
      snapshotDate: null,
      rows: [],
      lastJob,
      scoreProfile: null
    };
  }

  const activeProfile = await prisma.scoreProfile.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      version: true,
      weightsJson: true,
      normalizationCapsJson: true
    }
  });

  if (!activeProfile) {
    return {
      snapshotDate: latestSnapshot.snapshotDate,
      rows: [],
      lastJob,
      scoreProfile: null
    };
  }

  const parsedWeights = parseScoreWeights(activeProfile.weightsJson);
  const parsedCaps = parseNormalizationCaps(activeProfile.normalizationCapsJson);
  const scoreProfile: LeaderboardScoreProfileView | null =
    parsedWeights && parsedCaps
      ? {
          name: activeProfile.name,
          version: activeProfile.version,
          weights: parsedWeights,
          normalizationCaps: parsedCaps
        }
      : null;

  const scores = await prisma.leaderboardScore.findMany({
    where: {
      scoreProfileId: activeProfile.id,
      snapshot: { snapshotDate: latestSnapshot.snapshotDate },
      trackedCharacter: { active: true }
    },
    select: {
      trackedCharacterId: true,
      rank: true,
      totalScore: true,
      dailyDelta: true,
      trackedCharacter: true,
      snapshot: {
        select: { id: true, polledAt: true, normalizedMetricsJson: true }
      }
    },
    orderBy: [{ rank: "asc" }, { totalScore: "desc" }, { trackedCharacter: { characterName: "asc" } }]
  });

  const snapshotIds = scores.map((score) => score.snapshot.id);
  const deltas = snapshotIds.length
    ? await prisma.characterMetricDelta.findMany({
        where: {
          toSnapshotId: { in: snapshotIds }
        },
        select: {
          toSnapshotId: true,
          deltaJson: true
        }
      })
    : [];
  const deltaByToSnapshotId = new Map(deltas.map((delta) => [delta.toSnapshotId, delta.deltaJson]));

  const previousSnapshot = await prisma.characterSnapshot.findFirst({
    where: {
      snapshotDate: { lt: latestSnapshot.snapshotDate }
    },
    orderBy: { snapshotDate: "desc" },
    select: { snapshotDate: true }
  });

  const previousRanksByCharacterId = new Map<string, number | null>();
  if (previousSnapshot) {
    const previousScores = await prisma.leaderboardScore.findMany({
      where: {
        scoreProfileId: activeProfile.id,
        snapshot: { snapshotDate: previousSnapshot.snapshotDate },
        trackedCharacter: { active: true }
      },
      select: {
        trackedCharacterId: true,
        rank: true
      }
    });

    for (const previousScore of previousScores) {
      previousRanksByCharacterId.set(previousScore.trackedCharacterId, previousScore.rank);
    }
  }

  return {
    snapshotDate: latestSnapshot.snapshotDate,
    rows: scores.map((score) => {
      const metrics = parseNormalizedMetrics(score.snapshot.normalizedMetricsJson);
      const delta = parseDeltaJson(deltaByToSnapshotId.get(score.snapshot.id));

      let rankChange: RankChange = "NEW";
      if (previousSnapshot) {
        if (!previousRanksByCharacterId.has(score.trackedCharacterId)) {
          rankChange = "NEW";
        } else {
          const previousRank = previousRanksByCharacterId.get(score.trackedCharacterId) ?? null;
          rankChange = previousRank !== null && score.rank !== null ? previousRank - score.rank : null;
        }
      }

      return {
        trackedCharacterId: score.trackedCharacterId,
        rank: score.rank,
        characterName: score.trackedCharacter.characterName,
        portraitUrl: score.trackedCharacter.portraitUrl,
        faction: score.trackedCharacter.faction,
        realmSlug: score.trackedCharacter.realmSlug,
        region: score.trackedCharacter.region,
        level: metrics.level,
        itemLevel: metrics.averageItemLevel,
        mythicPlusRating: metrics.mythicPlusSeasonScore,
        bestKeyLevel: metrics.mythicPlusBestRunLevel,
        completedQuestCount: metrics.completedQuestCount,
        reputationProgressTotal: metrics.reputationProgressTotal,
        totalScore: score.totalScore,
        rankChange,
        dailyDelta: score.dailyDelta,
        questDelta: delta.questDelta,
        reputationDelta: delta.reputationDelta,
        polledAt: score.snapshot.polledAt
      };
    }),
    lastJob,
    scoreProfile
  };
}
