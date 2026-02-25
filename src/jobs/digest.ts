import {
  JobStatus,
  JobType,
  Prisma,
  TelegramDeliveryStatus,
  TelegramMessageType
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getTelegramDigestConfig, requireTelegramDigestSendConfig } from "@/lib/env";
import { sendTelegramMessage } from "@/lib/telegram/client";
import { formatTelegramDigest } from "@/lib/telegram/format-digest";
import { formatUtcSnapshotDate, queryDigestData } from "@/lib/telegram/query-digest-data";

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

export function parseSnapshotDateArg(raw: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) {
    throw new Error(`Invalid --snapshot-date value "${raw}". Expected YYYY-MM-DD.`);
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid --snapshot-date value "${raw}". Expected a real calendar date.`);
  }

  return parsed;
}

export function digestJobUsage(): string {
  return [
    "Usage: npm run job:digest [-- --send] [--snapshot-date=YYYY-MM-DD]",
    "",
    "Options:",
    "  --send                     Send the digest to Telegram (default is preview-only)",
    "  --snapshot-date=YYYY-MM-DD Use a specific UTC snapshot date",
    "  --snapshot-date YYYY-MM-DD Same as above",
    "  --help                     Show this help"
  ].join("\n");
}
