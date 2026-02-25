import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDailyAutomation } from "@/jobs/daily-automation";
import { getCronSecret } from "@/lib/env";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function safeEqualText(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return timingSafeEqual(aBuffer, bBuffer);
}

function isAuthorized(request: NextRequest, secret: string): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  return safeEqualText(authHeader, `Bearer ${secret}`);
}

function isDryRunRequest(request: NextRequest): boolean {
  const raw = request.nextUrl.searchParams.get("dryRun");
  if (!raw) return false;

  const normalized = raw.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function serializeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function GET(request: NextRequest) {
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return noStoreJson(
      {
        ok: false,
        error: "CRON_SECRET is not configured."
      },
      503
    );
  }

  if (!isAuthorized(request, cronSecret)) {
    return noStoreJson(
      {
        ok: false,
        error: "Unauthorized."
      },
      401
    );
  }

  const dryRun = isDryRunRequest(request);

  try {
    const result = await runDailyAutomation({ dryRun });
    const status = result.ok ? 200 : 500;

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

    if (result.ok) {
      console.log(logPayload);
    } else {
      console.error(logPayload);
    }

    return noStoreJson(result, status);
  } catch (error) {
    const message = serializeError(error);
    console.error({
      event: "daily_cron_run_unhandled_error",
      error: message
    });

    return noStoreJson(
      {
        ok: false,
        error: message
      },
      500
    );
  }
}
