import { runDailyAutomation, type DailyAutomationRunOptions, type DailyAutomationRunResult } from "@/jobs/daily-automation";

export interface DailyInvocationErrorBody {
  ok: false;
  error: string;
}

export type DailyInvocationBody = DailyAutomationRunResult | DailyInvocationErrorBody;
export type DailyInvocationLogLevel = "info" | "error";

export interface DailyInvocationResult {
  statusCode: 200 | 500;
  body: DailyInvocationBody;
  logPayload: Record<string, unknown>;
  logLevel: DailyInvocationLogLevel;
}

function serializeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runDailyInvocation(
  options: DailyAutomationRunOptions = {}
): Promise<DailyInvocationResult> {
  try {
    const result = await runDailyAutomation(options);
    const logPayload = {
      event: "daily_cron_run",
      ok: result.ok,
      mode: result.mode,
      snapshotDate: result.snapshotDate,
      pollStatus: result.poll.status,
      digestStatus: result.digest.status ?? null,
      digestVariant: result.digest.variant ?? null,
      digestError: result.digest.error ?? null
    };

    return {
      statusCode: result.ok ? 200 : 500,
      body: result,
      logPayload,
      logLevel: result.ok ? "info" : "error"
    };
  } catch (error) {
    const message = serializeError(error);
    return {
      statusCode: 500,
      body: {
        ok: false,
        error: message
      },
      logPayload: {
        event: "daily_cron_run_unhandled_error",
        error: message
      },
      logLevel: "error"
    };
  }
}
