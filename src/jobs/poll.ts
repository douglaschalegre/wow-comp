import { createHash } from "node:crypto";
import { Faction, JobStatus, JobType, Prisma, Region } from "@prisma/client";
import { fetchCharacterProgressBundle } from "@/lib/blizzard/wow-profile";
import { BlizzardClient } from "@/lib/blizzard/client";
import { loadScoreProfileConfig, loadTrackedCharactersConfig } from "@/lib/config/load";
import { prisma } from "@/lib/db/prisma";
import { scoreCharacter } from "@/lib/scoring/score-character";
import { normalizeCharacterProgressBundle } from "@/lib/snapshots/normalize";
import { buildMetricDelta } from "@/lib/snapshots/diff";
import type {
  NormalizedCharacterMetrics,
  PollCharacterResult,
  PollJobResult,
  ScoreProfileConfig,
  TrackedCharacterConfig
} from "@/lib/types";

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function configHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
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

function trackedCharacterKey(character: TrackedCharacterConfig): string {
  return `${character.region}:${character.realmSlug.toLowerCase()}:${character.characterName.toLowerCase()}`;
}

async function syncTrackedCharacters(configCharacters: TrackedCharacterConfig[]) {
  const activeKeys = new Set(configCharacters.map(trackedCharacterKey));
  const upserted = new Map<string, { id: string }>();

  for (const character of configCharacters) {
    const characterNameLower = character.characterName.toLowerCase();
    const record = await prisma.trackedCharacter.upsert({
      where: {
        region_realmSlug_characterNameLower: {
          region: character.region as Region,
          realmSlug: character.realmSlug,
          characterNameLower
        }
      },
      create: {
        region: character.region as Region,
        realmSlug: character.realmSlug,
        characterName: character.characterName,
        characterNameLower,
        faction: character.faction as Faction,
        active: character.active ?? true,
        notes: character.notes
      },
      update: {
        characterName: character.characterName,
        faction: character.faction as Faction,
        active: character.active ?? true,
        notes: character.notes
      },
      select: { id: true }
    });

    upserted.set(trackedCharacterKey(character), record);
  }

  const existing = await prisma.trackedCharacter.findMany({
    select: {
      id: true,
      region: true,
      realmSlug: true,
      characterNameLower: true
    }
  });

  const idsToDeactivate = existing
    .filter((record) => !activeKeys.has(`${record.region}:${record.realmSlug}:${record.characterNameLower}`))
    .map((record) => record.id);

  if (idsToDeactivate.length > 0) {
    await prisma.trackedCharacter.updateMany({
      where: { id: { in: idsToDeactivate } },
      data: { active: false }
    });
  }

  return upserted;
}

async function rankLeaderboardForSnapshot(snapshotDate: Date, scoreProfileId: string) {
  const scores = await prisma.leaderboardScore.findMany({
    where: {
      scoreProfileId,
      snapshot: { snapshotDate },
      trackedCharacter: { active: true }
    },
    select: {
      id: true,
      totalScore: true,
      dailyDelta: true,
      trackedCharacter: {
        select: {
          characterName: true
        }
      }
    }
  });

  const sorted = [...scores].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.dailyDelta !== a.dailyDelta) return b.dailyDelta - a.dailyDelta;
    return a.trackedCharacter.characterName.localeCompare(b.trackedCharacter.characterName);
  });

  await prisma.$transaction(
    sorted.map((score, index) =>
      prisma.leaderboardScore.update({
        where: { id: score.id },
        data: { rank: index + 1 }
      })
    )
  );
}

async function getPreviousSnapshot(trackedCharacterId: string, snapshotDate: Date) {
  return prisma.characterSnapshot.findFirst({
    where: {
      trackedCharacterId,
      snapshotDate: { lt: snapshotDate }
    },
    orderBy: { snapshotDate: "desc" }
  });
}

function parseNormalizedMetrics(input: Prisma.JsonValue): NormalizedCharacterMetrics {
  return input as unknown as NormalizedCharacterMetrics;
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

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractCharacterPortraitUrl(characterMedia: unknown): string | null {
  const media = asRecord(characterMedia);
  if (!media) return null;

  const urlsByKey = new Map<string, string>();
  for (const assetValue of asArray(media.assets)) {
    const asset = asRecord(assetValue);
    if (!asset) continue;

    const rawKey = asNonEmptyString(asset.key);
    if (!rawKey) continue;

    const valueRecord = asRecord(asset.value);
    const hrefRecord = asRecord(asset.href);
    const rawUrl =
      asNonEmptyString(asset.value) ??
      asNonEmptyString(asset.url) ??
      asNonEmptyString(valueRecord?.href) ??
      asNonEmptyString(valueRecord?.url) ??
      asNonEmptyString(hrefRecord?.href) ??
      asNonEmptyString(hrefRecord?.url);

    if (!rawUrl) continue;
    urlsByKey.set(rawKey.toLowerCase(), rawUrl);
  }

  const preferredKeys = [
    "avatar",
    "avatar-raw",
    "avatar-large",
    "avatar-medium",
    "avatar-small",
    "inset",
    "main",
    "main-raw"
  ];

  for (const key of preferredKeys) {
    const url = urlsByKey.get(key);
    if (url) return url;
  }

  for (const [key, url] of urlsByKey.entries()) {
    if (key.startsWith("avatar")) return url;
  }

  for (const url of urlsByKey.values()) {
    return url;
  }

  return null;
}

export async function runPollJob(): Promise<PollJobResult> {
  const snapshotDate = startOfUtcDay();
  const snapshotDateIso = snapshotDate.toISOString();
  const jobRun = await prisma.jobRun.create({
    data: {
      jobType: JobType.POLL,
      status: JobStatus.RUNNING,
      snapshotDate
    }
  });

  const results: PollCharacterResult[] = [];

  try {
    const trackedConfig = await loadTrackedCharactersConfig();
    const scoreProfileConfig = await loadScoreProfileConfig();
    const activeProfileRecord = await upsertActiveScoreProfile(scoreProfileConfig);
    const trackedMap = await syncTrackedCharacters(trackedConfig.characters);
    const client = new BlizzardClient();

    const activeCharacters = trackedConfig.characters.filter((character) => character.active ?? true);

    for (const character of activeCharacters) {
      const warnings: string[] = [];
      try {
        const trackedRecord = trackedMap.get(trackedCharacterKey(character));
        if (!trackedRecord) {
          throw new Error("Tracked character sync failed to return an ID");
        }

        const bundle = await fetchCharacterProgressBundle(client, character, scoreProfileConfig);
        if (!bundle.profileSummary) {
          throw new Error(
            `Missing profile summary (character may be private/invalid). Endpoint errors: ${Object.values(
              bundle.endpointErrors
            ).join("; ")}`
          );
        }

        const portraitUrl = extractCharacterPortraitUrl(bundle.characterMedia);
        if (portraitUrl) {
          await prisma.trackedCharacter.update({
            where: { id: trackedRecord.id },
            data: { portraitUrl }
          });
        }

        const normalized = normalizeCharacterProgressBundle(bundle, character, scoreProfileConfig);
        warnings.push(...normalized.warnings);

        const snapshot = await prisma.characterSnapshot.upsert({
          where: {
            trackedCharacterId_snapshotDate: {
              trackedCharacterId: trackedRecord.id,
              snapshotDate
            }
          },
          create: {
            trackedCharacterId: trackedRecord.id,
            snapshotDate,
            rawProfileJson: toPrismaJson(bundle.profileSummary ?? {}),
            rawProgressJson: toPrismaJson({
              characterMedia: bundle.characterMedia ?? null,
              equipmentSummary: bundle.equipmentSummary ?? null,
              achievementsSummary: bundle.achievementsSummary ?? null,
              statisticsSummary: bundle.statisticsSummary ?? null,
              reputationsSummary: bundle.reputationsSummary ?? null,
              questsCompleted: bundle.questsCompleted ?? null,
              encountersSummary: bundle.encountersSummary ?? null,
              mythicKeystoneProfile: bundle.mythicKeystoneProfile ?? null,
              mythicKeystoneSeason: bundle.mythicKeystoneSeason ?? null,
              endpointErrors: bundle.endpointErrors
            }),
            normalizedMetricsJson: toPrismaJson(normalized),
            sourceVersion: normalized.schemaVersion
          },
          update: {
            polledAt: new Date(),
            rawProfileJson: toPrismaJson(bundle.profileSummary ?? {}),
            rawProgressJson: toPrismaJson({
              characterMedia: bundle.characterMedia ?? null,
              equipmentSummary: bundle.equipmentSummary ?? null,
              achievementsSummary: bundle.achievementsSummary ?? null,
              statisticsSummary: bundle.statisticsSummary ?? null,
              reputationsSummary: bundle.reputationsSummary ?? null,
              questsCompleted: bundle.questsCompleted ?? null,
              encountersSummary: bundle.encountersSummary ?? null,
              mythicKeystoneProfile: bundle.mythicKeystoneProfile ?? null,
              mythicKeystoneSeason: bundle.mythicKeystoneSeason ?? null,
              endpointErrors: bundle.endpointErrors
            }),
            normalizedMetricsJson: toPrismaJson(normalized),
            sourceVersion: normalized.schemaVersion
          }
        });

        const previousSnapshot = await getPreviousSnapshot(trackedRecord.id, snapshotDate);
        const previousMetrics = previousSnapshot
          ? parseNormalizedMetrics(previousSnapshot.normalizedMetricsJson)
          : null;
        const delta = buildMetricDelta(previousMetrics, normalized);

        await prisma.characterMetricDelta.upsert({
          where: { toSnapshotId: snapshot.id },
          create: {
            trackedCharacterId: trackedRecord.id,
            fromSnapshotId: previousSnapshot?.id,
            toSnapshotId: snapshot.id,
            deltaJson: toPrismaJson(delta.deltas),
            milestonesJson: toPrismaJson(delta.milestones)
          },
          update: {
            fromSnapshotId: previousSnapshot?.id ?? null,
            deltaJson: toPrismaJson(delta.deltas),
            milestonesJson: toPrismaJson(delta.milestones)
          }
        });

        const scoreBreakdown = scoreCharacter(normalized, scoreProfileConfig);
        warnings.push(...scoreBreakdown.warnings);

        const previousScore = previousSnapshot
          ? await prisma.leaderboardScore.findFirst({
              where: {
                trackedCharacterId: trackedRecord.id,
                snapshotId: previousSnapshot.id,
                scoreProfileId: activeProfileRecord.id
              },
              select: { totalScore: true }
            })
          : null;

        const dailyDelta = Number(
          (scoreBreakdown.totalScore - (previousScore?.totalScore ?? 0)).toFixed(2)
        );

        await prisma.leaderboardScore.upsert({
          where: {
            trackedCharacterId_snapshotId_scoreProfileId: {
              trackedCharacterId: trackedRecord.id,
              snapshotId: snapshot.id,
              scoreProfileId: activeProfileRecord.id
            }
          },
          create: {
            trackedCharacterId: trackedRecord.id,
            snapshotId: snapshot.id,
            scoreProfileId: activeProfileRecord.id,
            totalScore: scoreBreakdown.totalScore,
            dailyDelta,
            breakdownJson: toPrismaJson({
              ...scoreBreakdown,
              metricDelta: delta,
              warnings
            })
          },
          update: {
            totalScore: scoreBreakdown.totalScore,
            dailyDelta,
            breakdownJson: toPrismaJson({
              ...scoreBreakdown,
              metricDelta: delta,
              warnings
            })
          }
        });

        results.push({
          character,
          ok: true,
          snapshotId: snapshot.id,
          score: scoreBreakdown.totalScore,
          warnings
        });
      } catch (error) {
        results.push({
          character,
          ok: false,
          warnings,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    await rankLeaderboardForSnapshot(snapshotDate, activeProfileRecord.id);

    const successCount = results.filter((result) => result.ok).length;
    const errorCount = results.length - successCount;
    const warningCount = results.reduce((count, result) => count + result.warnings.length, 0);
    const payload: PollJobResult = {
      snapshotDate: snapshotDateIso,
      processed: results.length,
      successCount,
      warningCount,
      errorCount,
      results
    };

    const status =
      errorCount === 0 ? JobStatus.SUCCESS : successCount > 0 ? JobStatus.PARTIAL_FAILURE : JobStatus.FAILED;

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status,
        finishedAt: new Date(),
        detailsJson: toPrismaJson(payload)
      }
    });

    return payload;
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
