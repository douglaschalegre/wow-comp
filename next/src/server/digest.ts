import {
  JobStatus,
  JobType,
  Prisma,
  TelegramDeliveryStatus,
  TelegramMessageType
} from "@prisma/client";
import { getTelegramDigestConfig, requireTelegramDigestSendConfig } from "@/server/env";
import { prisma } from "@/server/prisma";
import { sendTelegramMessage } from "@/server/telegram";

export interface DigestRunOptions {
  mode?: "preview" | "send";
  snapshotDate?: Date;
}

export interface DigestRunResult {
  snapshotDate: string;
  variant: "standings" | "poll_failure";
  status: "PREVIEW" | "SENT" | "SKIPPED_DUPLICATE";
  deliveryId?: string;
  telegramMessageId?: string;
  text: string;
  warnings: string[];
  pollSummary?: {
    status: "SUCCESS" | "PARTIAL_FAILURE" | "FAILED";
    errorCount?: number;
    warningCount?: number;
  };
}

type PollStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILED";

interface DigestPollSummary {
  pollJobRunId: string;
  status: PollStatus;
  warningCount?: number;
  errorCount?: number;
}

interface DigestScoreProfileSummary {
  name: string;
  version: number;
}

interface DigestLeaderboardRow {
  rank: number | null;
  characterName: string;
  region: "US" | "EU";
  realmSlug: string;
  totalScore: number;
  dailyDelta: number;
  level: number;
  itemLevel: number;
  mythicPlusRating: number;
  bestKeyLevel: number;
}

interface DigestMilestoneLine {
  rank: number | null;
  characterName: string;
  region: "US" | "EU";
  realmSlug: string;
  dailyDelta: number;
  text: string;
}

interface DigestStandingsData {
  variant: "standings";
  snapshotDate: Date;
  pollSummary: DigestPollSummary;
  scoreProfile: DigestScoreProfileSummary;
  rows: DigestLeaderboardRow[];
  topMovers: DigestLeaderboardRow[];
  milestones: DigestMilestoneLine[];
  warnings: string[];
}

interface DigestPollFailureData {
  variant: "poll_failure";
  snapshotDate: Date;
  pollSummary: DigestPollSummary;
  failureMessage: string;
  warnings: string[];
}

type DigestData = DigestStandingsData | DigestPollFailureData;

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

function asFiniteNumber(value: unknown, fallback = 0): number {
  return asNumber(value) ?? fallback;
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

function parseStatusMetrics(value: Prisma.JsonValue): {
  level: number;
  itemLevel: number;
  mythicPlusRating: number;
  bestKeyLevel: number;
} {
  const record = asRecord(value);

  return {
    level: asFiniteNumber(record?.level, 0),
    itemLevel: asFiniteNumber(record?.averageItemLevel, 0),
    mythicPlusRating: asFiniteNumber(record?.mythicPlusSeasonScore, 0),
    bestKeyLevel: asFiniteNumber(record?.mythicPlusBestRunLevel, 0)
  };
}

function rankSortValue(rank: number | null): number {
  return rank ?? Number.MAX_SAFE_INTEGER;
}

export function formatUtcSnapshotDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function queryDigestData(snapshotDate: Date): Promise<DigestData> {
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
      snapshot: {
        select: {
          normalizedMetricsJson: true
        }
      },
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

  const rows: DigestLeaderboardRow[] = scores.map((score) => {
    const metrics = parseStatusMetrics(score.snapshot.normalizedMetricsJson);

    return {
      rank: score.rank,
      characterName: score.trackedCharacter.characterName,
      region: score.trackedCharacter.region,
      realmSlug: score.trackedCharacter.realmSlug,
      totalScore: score.totalScore,
      dailyDelta: score.dailyDelta,
      level: metrics.level,
      itemLevel: metrics.itemLevel,
      mythicPlusRating: metrics.mythicPlusRating,
      bestKeyLevel: metrics.bestKeyLevel
    };
  });

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
          fromSnapshotId: true,
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
    if (!delta.fromSnapshotId) continue;

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

const MAX_MESSAGE_LENGTH = 3900;
const TOP_ROWS_LIMIT = 8;
const MILESTONES_LIMIT = 4;
const WARNINGS_LIMIT = 5;

function formatUtcDate(date: Date): string {
  return `${date.toISOString().slice(0, 10)} (UTC)`;
}

function formatSigned(value: number): string {
  const rounded = value.toFixed(2);
  return value >= 0 ? `+${rounded}` : rounded;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function formatItemLevel(value: number): string {
  return value.toFixed(1);
}

function characterLabel(row: { characterName: string; region: "US" | "EU"; realmSlug: string }): string {
  return `${row.characterName} (${row.region}/${row.realmSlug})`;
}

function rankLabel(rank: number | null): string {
  return rank === null ? "?" : String(rank);
}

function renderLeaderboardRow(row: DigestLeaderboardRow): string {
  return `#${rankLabel(row.rank)} ${characterLabel(row)} | score ${formatScore(row.totalScore)} (${formatSigned(
    row.dailyDelta
  )}) | lvl ${row.level} | ilvl ${formatItemLevel(row.itemLevel)} | m+ ${Math.round(
    row.mythicPlusRating
  )} (best ${row.bestKeyLevel})`;
}

function renderMilestoneLine(line: DigestMilestoneLine): string {
  return `#${rankLabel(line.rank)} ${characterLabel(line)}: ${line.text}`;
}

function withOverflowSuffix(lines: string[], limit: number): string[] {
  if (lines.length <= limit) return lines;
  const visible = lines.slice(0, limit);
  visible.push(`+${lines.length - limit} more`);
  return visible;
}

function pushSection(target: string[], title: string, lines: string[]): void {
  if (lines.length === 0) return;
  target.push(title);
  target.push(...lines);
}

function truncateMessage(text: string, maxLength = MAX_MESSAGE_LENGTH): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, Math.max(0, maxLength - 3));
  const newlineIndex = slice.lastIndexOf("\n");
  if (newlineIndex > maxLength * 0.6) {
    return `${slice.slice(0, newlineIndex)}...`;
  }
  return `${slice}...`;
}

function formatTelegramDigest(data: DigestData, leagueName: string): string {
  const lines: string[] = [];

  lines.push(`${leagueName} | ${formatUtcDate(data.snapshotDate)}`);

  const pollParts = [`Poll: ${data.pollSummary.status}`];
  if (data.variant === "standings") {
    pollParts.push(`chars=${data.rows.length}`);
  }
  if (typeof data.pollSummary.warningCount === "number") {
    pollParts.push(`warn=${data.pollSummary.warningCount}`);
  }
  if (typeof data.pollSummary.errorCount === "number") {
    pollParts.push(`err=${data.pollSummary.errorCount}`);
  }
  lines.push(pollParts.join(" | "));

  if (data.variant === "poll_failure") {
    lines.push("");
    lines.push(`Failure: ${data.failureMessage}`);
    return truncateMessage(lines.join("\n"));
  }

  lines.push(`Profile: ${data.scoreProfile.name} v${data.scoreProfile.version}`);

  lines.push("");
  const statusLines = withOverflowSuffix(data.rows.map(renderLeaderboardRow), TOP_ROWS_LIMIT);
  pushSection(lines, "Status", statusLines.length > 0 ? statusLines : ["No leaderboard rows found."]);

  const milestones = withOverflowSuffix(data.milestones.map(renderMilestoneLine), MILESTONES_LIMIT);
  if (milestones.length > 0) {
    lines.push("");
    pushSection(lines, "Changes", milestones);
  }

  const warnings = withOverflowSuffix(data.warnings, WARNINGS_LIMIT);
  if (warnings.length > 0) {
    lines.push("");
    pushSection(lines, "Warnings", warnings);
  }

  return truncateMessage(lines.join("\n"));
}

type DeliveryClaimResult =
  | {
      kind: "ready";
      deliveryId: string;
    }
  | {
      kind: "duplicate";
      deliveryId: string;
      messageText: string;
      telegramMessageId: string | null;
    }
  | {
      kind: "running";
      deliveryId: string;
    };

type TelegramDeliveryUniqueWhere = Prisma.TelegramDeliveryWhereUniqueInput;

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    message: String(error)
  };
}

function buildDeliveryWhere(chatId: string, deliveryDate: Date): TelegramDeliveryUniqueWhere {
  return {
    chatId_messageType_deliveryDate: {
      chatId,
      messageType: TelegramMessageType.DAILY_DIGEST,
      deliveryDate
    }
  };
}

async function claimTelegramDeliverySlot(params: {
  jobRunId: string;
  chatId: string;
  deliveryDate: Date;
  messageText: string;
}): Promise<DeliveryClaimResult> {
  const where = buildDeliveryWhere(params.chatId, params.deliveryDate);

  const existing = await prisma.telegramDelivery.findUnique({
    where,
    select: {
      id: true,
      status: true,
      messageText: true,
      telegramMessageId: true
    }
  });

  if (existing) {
    if (existing.status === TelegramDeliveryStatus.SENT) {
      return {
        kind: "duplicate",
        deliveryId: existing.id,
        messageText: existing.messageText,
        telegramMessageId: existing.telegramMessageId
      };
    }

    if (existing.status === TelegramDeliveryStatus.PENDING) {
      return {
        kind: "running",
        deliveryId: existing.id
      };
    }

    const updated = await prisma.telegramDelivery.update({
      where: { id: existing.id },
      data: {
        jobRunId: params.jobRunId,
        status: TelegramDeliveryStatus.PENDING,
        messageText: params.messageText,
        telegramMessageId: null,
        sentAt: null,
        errorJson: Prisma.JsonNull
      },
      select: { id: true }
    });

    return {
      kind: "ready",
      deliveryId: updated.id
    };
  }

  try {
    const created = await prisma.telegramDelivery.create({
      data: {
        jobRunId: params.jobRunId,
        chatId: params.chatId,
        messageType: TelegramMessageType.DAILY_DIGEST,
        deliveryDate: params.deliveryDate,
        messageText: params.messageText,
        status: TelegramDeliveryStatus.PENDING
      },
      select: { id: true }
    });

    return {
      kind: "ready",
      deliveryId: created.id
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return claimTelegramDeliverySlot(params);
    }
    throw error;
  }
}

async function markDeliveryFailed(deliveryId: string, error: unknown): Promise<void> {
  await prisma.telegramDelivery.update({
    where: { id: deliveryId },
    data: {
      status: TelegramDeliveryStatus.FAILED,
      errorJson: toPrismaJson(serializeError(error))
    }
  });
}

export function resolveDigestSnapshotDate(date?: Date): Date {
  return startOfUtcDay(date ?? new Date());
}

export async function runDigestJob(options: DigestRunOptions = {}): Promise<DigestRunResult> {
  const mode = options.mode ?? "preview";
  const snapshotDate = resolveDigestSnapshotDate(options.snapshotDate);
  const snapshotDateLabel = formatUtcSnapshotDate(snapshotDate);

  if (mode === "preview") {
    const leagueName = getTelegramDigestConfig().leagueName;
    const digestData = await queryDigestData(snapshotDate);
    const text = formatTelegramDigest(digestData, leagueName);

    return {
      snapshotDate: snapshotDateLabel,
      variant: digestData.variant,
      status: "PREVIEW",
      text,
      warnings: digestData.warnings,
      pollSummary: {
        status: digestData.pollSummary.status,
        warningCount: digestData.pollSummary.warningCount,
        errorCount: digestData.pollSummary.errorCount
      }
    };
  }

  const telegramConfig = requireTelegramDigestSendConfig();
  const jobRun = await prisma.jobRun.create({
    data: {
      jobType: JobType.DIGEST,
      status: JobStatus.RUNNING,
      snapshotDate
    },
    select: { id: true }
  });

  let deliveryId: string | undefined;
  let digestVariant: "standings" | "poll_failure" | undefined;
  let pollSummary:
    | {
        pollJobRunId: string;
        status: "SUCCESS" | "PARTIAL_FAILURE" | "FAILED";
        warningCount?: number;
        errorCount?: number;
      }
    | undefined;
  let messageText = "";

  try {
    const digestData = await queryDigestData(snapshotDate);
    digestVariant = digestData.variant;
    pollSummary = digestData.pollSummary;
    messageText = formatTelegramDigest(digestData, telegramConfig.leagueName);

    const claim = await claimTelegramDeliverySlot({
      jobRunId: jobRun.id,
      chatId: telegramConfig.chatId,
      deliveryDate: snapshotDate,
      messageText
    });

    if (claim.kind === "running") {
      throw new Error("DELIVERY_ALREADY_RUNNING: Another digest delivery is already in progress for this date.");
    }

    if (claim.kind === "duplicate") {
      await prisma.jobRun.update({
        where: { id: jobRun.id },
        data: {
          status: JobStatus.SUCCESS,
          finishedAt: new Date(),
          detailsJson: toPrismaJson({
            snapshotDate: snapshotDateLabel,
            variant: digestData.variant,
            outcome: "SKIPPED_DUPLICATE",
            deliveryId: claim.deliveryId,
            telegramMessageId: claim.telegramMessageId,
            pollJobRunId: digestData.pollSummary.pollJobRunId,
            pollStatus: digestData.pollSummary.status,
            warningCount: digestData.pollSummary.warningCount,
            errorCount: digestData.pollSummary.errorCount,
            messageLength: claim.messageText.length
          })
        }
      });

      return {
        snapshotDate: snapshotDateLabel,
        variant: digestData.variant,
        status: "SKIPPED_DUPLICATE",
        deliveryId: claim.deliveryId,
        telegramMessageId: claim.telegramMessageId ?? undefined,
        text: claim.messageText,
        warnings: digestData.warnings,
        pollSummary: {
          status: digestData.pollSummary.status,
          warningCount: digestData.pollSummary.warningCount,
          errorCount: digestData.pollSummary.errorCount
        }
      };
    }

    deliveryId = claim.deliveryId;

    const telegramResult = await sendTelegramMessage({
      botToken: telegramConfig.botToken,
      chatId: telegramConfig.chatId,
      text: messageText
    });

    await prisma.telegramDelivery.update({
      where: { id: deliveryId },
      data: {
        status: TelegramDeliveryStatus.SENT,
        telegramMessageId: telegramResult.messageId,
        sentAt: new Date(),
        messageText,
        errorJson: Prisma.JsonNull
      }
    });

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobStatus.SUCCESS,
        finishedAt: new Date(),
        detailsJson: toPrismaJson({
          snapshotDate: snapshotDateLabel,
          variant: digestData.variant,
          outcome: "SENT",
          deliveryId,
          telegramMessageId: telegramResult.messageId,
          pollJobRunId: digestData.pollSummary.pollJobRunId,
          pollStatus: digestData.pollSummary.status,
          warningCount: digestData.pollSummary.warningCount,
          errorCount: digestData.pollSummary.errorCount,
          messageLength: messageText.length
        })
      }
    });

    return {
      snapshotDate: snapshotDateLabel,
      variant: digestData.variant,
      status: "SENT",
      deliveryId,
      telegramMessageId: telegramResult.messageId,
      text: messageText,
      warnings: digestData.warnings,
      pollSummary: {
        status: digestData.pollSummary.status,
        warningCount: digestData.pollSummary.warningCount,
        errorCount: digestData.pollSummary.errorCount
      }
    };
  } catch (error) {
    if (deliveryId) {
      try {
        await markDeliveryFailed(deliveryId, error);
      } catch {
        // Best-effort: preserve original error.
      }
    }

    await prisma.jobRun.update({
      where: { id: jobRun.id },
      data: {
        status: JobStatus.FAILED,
        finishedAt: new Date(),
        detailsJson: toPrismaJson({
          snapshotDate: snapshotDateLabel,
          variant: digestVariant,
          outcome: "FAILED",
          deliveryId,
          pollJobRunId: pollSummary?.pollJobRunId,
          pollStatus: pollSummary?.status,
          warningCount: pollSummary?.warningCount,
          errorCount: pollSummary?.errorCount,
          messageLength: messageText.length || undefined,
          error: serializeError(error)
        })
      }
    });

    throw error;
  }
}
