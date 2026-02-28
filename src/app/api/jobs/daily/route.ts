import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runDailyInvocation } from "@/jobs/daily-invocation";
import { getCronSecret } from "@/lib/env";

export const runtime = "nodejs";

function noStoreJson(body: unknown, status: number): NextResponse {
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

export async function GET(request: NextRequest): Promise<NextResponse> {
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
  const execution = await runDailyInvocation({ dryRun });

  if (execution.logLevel === "info") {
    console.log(execution.logPayload);
  } else {
    console.error(execution.logPayload);
  }

  return noStoreJson(execution.body, execution.statusCode);
}
