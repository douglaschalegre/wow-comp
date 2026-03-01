import { createHash } from "node:crypto";
import { JobStatus, JobType, Prisma } from "@prisma/client";
import { loadScoreProfileConfig } from "@/server/config";
import { scoreCharacter } from "@/server/metrics";
import { prisma } from "@/server/prisma";
import type { NormalizedCharacterMetrics, ScoreProfileConfig } from "@/server/types";

export interface RebuildLeaderboardJobResult {
  rebuilt: number;
  snapshotDate: string | null;
  scoreProfileId?: string;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function parseNormalizedMetrics(input: Prisma.JsonValue): NormalizedCharacterMetrics {
  return input as unknown as NormalizedCharacterMetrics;
}

function configHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function upsertActiveScoreProfile(scoreProfile: ScoreProfileConfig) {
  const sourceHash = configHash(scoreProfile);

  let profile = await prisma.scoreProfile.findUnique({
    where: { sourceHash }
  });

  if (!profile) {
    profile = await prisma.scoreProfile.create({
      data: {
        name: scoreProfile.name,
        version: scoreProfile.version,
        sourceHash,
        weightsJson: toPrismaJson(scoreProfile.weights),
        normalizationCapsJson: toPrismaJson(scoreProfile.normalizationCaps),
        filtersJson: toPrismaJson(scoreProfile.filters),
        isActive: true
      }
    });
  }

  await prisma.$transaction([
    prisma.scoreProfile.updateMany({
      where: { isActive: true, id: { not: profile.id } },
      data: { isActive: false }
    }),
    prisma.scoreProfile.update({
      where: { id: profile.id },
      data: { isActive: true }
    })
  ]);

  return profile;
}

export async function runRebuildLeaderboardJob(): Promise<RebuildLeaderboardJobResult> {
  const jobRun = await prisma.jobRun.create({
    data: {
      jobType: JobType.REBUILD_LEADERBOARD,
      status: JobStatus.RUNNING
    }
  });

  try {
    const scoreProfileConfig = await loadScoreProfileConfig();
    const activeProfile = await upsertActiveScoreProfile(scoreProfileConfig);

    const latestSnapshot = await prisma.characterSnapshot.findFirst({
      orderBy: { snapshotDate: "desc" },
      select: { snapshotDate: true }
    });
    if (!latestSnapshot) {
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: JobStatus.SUCCESS,
          finishedAt: new Date(),
          detailsJson: toPrismaJson({ message: "No snapshots found. Nothing to rebuild." })
        }
      });
      return { rebuilt: 0, snapshotDate: null };
    }

    const snapshots = await prisma.characterSnapshot.findMany({
      where: {
        snapshotDate: latestSnapshot.snapshotDate,
        trackedCharacter: { active: true }
      },
      include: {
        trackedCharacter: true
      }
    });

    for (const snapshot of snapshots) {
      const metrics = parseNormalizedMetrics(snapshot.normalizedMetricsJson);
      const scoreBreakdown = scoreCharacter(metrics, scoreProfileConfig);

      const previousSnapshot = await prisma.characterSnapshot.findFirst({
        where: {
          trackedCharacterId: snapshot.trackedCharacterId,
          snapshotDate: { lt: snapshot.snapshotDate }
        },
        orderBy: { snapshotDate: "desc" },
        select: { id: true }
      });

      const previousScore = previousSnapshot
        ? await prisma.leaderboardScore.findFirst({
            where: {
              trackedCharacterId: snapshot.trackedCharacterId,
              snapshotId: previousSnapshot.id,
              scoreProfileId: activeProfile.id
            },
            select: { totalScore: true }
          })
        : null;

      const dailyDelta = Number((scoreBreakdown.totalScore - (previousScore?.totalScore ?? 0)).toFixed(2));

      await prisma.leaderboardScore.upsert({
        where: {
          trackedCharacterId_snapshotId_scoreProfileId: {
            trackedCharacterId: snapshot.trackedCharacterId,
            snapshotId: snapshot.id,
            scoreProfileId: activeProfile.id
          }
        },
        create: {
          trackedCharacterId: snapshot.trackedCharacterId,
          snapshotId: snapshot.id,
          scoreProfileId: activeProfile.id,
          totalScore: scoreBreakdown.totalScore,
          dailyDelta,
          breakdownJson: toPrismaJson(scoreBreakdown)
        },
        update: {
          totalScore: scoreBreakdown.totalScore,
          dailyDelta,
          breakdownJson: toPrismaJson(scoreBreakdown)
        }
      });
    }

    const scores = await prisma.leaderboardScore.findMany({
      where: {
        scoreProfileId: activeProfile.id,
        snapshot: { snapshotDate: latestSnapshot.snapshotDate },
        trackedCharacter: { active: true }
      },
      select: {
        id: true,
        totalScore: true,
        dailyDelta: true,
        trackedCharacter: { select: { characterName: true } }
      }
    });

    const ranked = [...scores].sort((a, b) => {
      if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
      if (b.dailyDelta !== a.dailyDelta) return b.dailyDelta - a.dailyDelta;
      return a.trackedCharacter.characterName.localeCompare(b.trackedCharacter.characterName);
    });

    await prisma.$transaction(
      ranked.map((row, index) =>
        prisma.leaderboardScore.update({
          where: { id: row.id },
          data: { rank: index + 1 }
        })
      )
    );

    const result = {
      rebuilt: snapshots.length,
      snapshotDate: latestSnapshot.snapshotDate.toISOString(),
      scoreProfileId: activeProfile.id
    };

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobStatus.SUCCESS,
        finishedAt: new Date(),
        detailsJson: toPrismaJson(result)
      }
    });

    return result;
  } catch (error) {
    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        detailsJson: toPrismaJson({
          message: error instanceof Error ? error.message : String(error)
        })
      }
    });
    throw error;
  }
}
