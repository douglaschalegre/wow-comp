import type { PollJobResult } from "@/lib/types";
import { runDigestJob, type DigestRunResult } from "./digest";
import { runPollJob } from "./poll";

type DailyAutomationMode = "send" | "dry_run";
type DailyPollStatus = "SUCCESS" | "PARTIAL_FAILURE" | "FAILED" | "ERROR";
type DailyDigestMode = "send" | "preview";

export interface DailyAutomationRunOptions {
  dryRun?: boolean;
}

export interface DailyAutomationRunResult {
  ok: boolean;
  mode: DailyAutomationMode;
  snapshotDate: string;
  startedAt: string;
  finishedAt: string;
  poll: {
    status: DailyPollStatus;
    summary?: PollJobResult;
    error?: string;
  };
  digest: {
    attempted: boolean;
    mode: "send" | "preview";
    status?: DigestRunResult["status"];
    variant?: DigestRunResult["variant"];
    deliveryId?: string;
    telegramMessageId?: string;
    warningCount?: number;
    error?: string;
  };
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parsePollSnapshotDate(snapshotDateIso: string): Date {
  return startOfUtcDay(new Date(snapshotDateIso));
}

function serializeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function derivePollStatus(result: PollJobResult): Exclude<DailyPollStatus, "ERROR"> {
  if (result.errorCount === 0) return "SUCCESS";
  if (result.successCount > 0) return "PARTIAL_FAILURE";
  return "FAILED";
}

export async function runDailyAutomation(
  options: DailyAutomationRunOptions = {}
): Promise<DailyAutomationRunResult> {
  const startedAt = new Date();
  const baseSnapshotDate = startOfUtcDay(startedAt);
  const mode: DailyAutomationMode = options.dryRun ? "dry_run" : "send";
  const digestMode: DailyDigestMode = options.dryRun ? "preview" : "send";

  let pollResult: PollJobResult | undefined;
  let pollError: string | undefined;
  let pollStatus: DailyPollStatus = "ERROR";

  try {
    pollResult = await runPollJob();
    pollStatus = derivePollStatus(pollResult);
  } catch (error) {
    pollError = serializeErrorMessage(error);
  }

  let digestResult: DigestRunResult | undefined;
  let digestError: string | undefined;
  const pollSnapshotDate = pollResult ? parsePollSnapshotDate(pollResult.snapshotDate) : undefined;
  const digestSnapshotDate = pollSnapshotDate ?? baseSnapshotDate;

  try {
    digestResult = await runDigestJob({
      mode: digestMode,
      snapshotDate: digestSnapshotDate
    });
  } catch (error) {
    digestError = serializeErrorMessage(error);
  }

  const fallbackSnapshotDate = formatUtcDate(pollSnapshotDate ?? baseSnapshotDate);
  const snapshotDate = digestResult?.snapshotDate ?? fallbackSnapshotDate;
  const finishedAt = new Date();

  return {
    ok: !digestError,
    mode,
    snapshotDate,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    poll: {
      status: pollStatus,
      summary: pollResult,
      error: pollError
    },
    digest: {
      attempted: true,
      mode: digestMode,
      status: digestResult?.status,
      variant: digestResult?.variant,
      deliveryId: digestResult?.deliveryId,
      telegramMessageId: digestResult?.telegramMessageId,
      warningCount: digestResult?.warnings.length,
      error: digestError
    }
  };
}
