import { LeaderboardTable } from "@/components/leaderboard-table";
import { getLatestLeaderboardView } from "@/lib/leaderboard/query";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "No snapshots yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(value);
}

function formatSnapshotDate(value: Date | null) {
  if (!value) return "No snapshot data";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC"
  }).format(value);
}

function jobStatusClass(status: string | null) {
  if (!status) return "text-[#f0d598]";
  if (status === "SUCCESS") return "text-[color:var(--good)]";
  if (status === "PARTIAL_FAILURE") return "text-[#f0d598]";
  return "text-[color:var(--bad)]";
}

export default async function HomePage() {
  let data:
    | Awaited<ReturnType<typeof getLatestLeaderboardView>>
    | {
        snapshotDate: null;
        rows: [];
        lastJob: null;
        scoreProfile: null;
      };
  let loadError: string | null = null;

  try {
    data = await getLatestLeaderboardView();
  } catch (error) {
    data = { snapshotDate: null, rows: [], lastJob: null, scoreProfile: null };
    loadError = error instanceof Error ? error.message : String(error);
  }

  const tableRows = data.rows.map((row) => ({
    ...row,
    polledAtIso: row.polledAt.toISOString()
  }));

  return (
    <main className="relative min-h-dvh overflow-hidden px-4 pb-14 pt-8 md:px-6 md:pb-16 md:pt-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[8rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(139,223,255,0.18),transparent_70%)] blur-3xl" />
        <div className="absolute right-[-8rem] top-[3rem] h-[20rem] w-[20rem] rounded-full bg-[radial-gradient(circle,rgba(117,146,255,0.16),transparent_70%)] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/2 h-[22rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(224,197,138,0.08),transparent_72%)] blur-3xl" />
      </div>

      <div className="relative mx-auto grid w-full max-w-[1280px] gap-5">
        <section
          aria-labelledby="league-title"
          className="relative overflow-hidden rounded-[26px] border border-[rgba(139,223,255,0.16)] bg-[rgba(8,12,28,0.74)] p-4 [box-shadow:var(--shadow-heavy)] md:p-5"
          style={{
            backgroundImage:
              "radial-gradient(circle at 84% 18%, rgba(139,223,255,0.14), transparent 42%), radial-gradient(circle at 16% 12%, rgba(224,197,138,0.08), transparent 42%), linear-gradient(180deg, rgba(14,20,44,0.86), rgba(7,10,21,0.82))"
          }}
        >
          <div className="pointer-events-none absolute inset-[10px] rounded-[18px] border border-[rgba(224,197,138,0.08)]" />
          <div className="pointer-events-none absolute left-5 top-4 h-px w-32 bg-gradient-to-r from-[rgba(139,223,255,0.55)] to-transparent" />
          <div className="pointer-events-none absolute right-5 bottom-4 h-px w-32 bg-gradient-to-l from-[rgba(224,197,138,0.35)] to-transparent" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-90 blur-sm"
            style={{
              background: "radial-gradient(circle, rgba(139,223,255,0.28), transparent 70%)"
            }}
          />
          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)] lg:gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(139,223,255,0.22)] bg-[rgba(139,223,255,0.06)] px-3 py-1 text-[0.75rem] uppercase tracking-[0.18em] text-[rgba(205,235,255,0.9)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[rgba(139,223,255,0.9)] shadow-[0_0_12px_rgba(139,223,255,0.9)]" />
                WoW Midnight League
              </div>

              <h1
                id="league-title"
                className="mb-2 mt-3 text-[clamp(2rem,4.6vw,3.4rem)] leading-[0.98] tracking-[0.03em] [font-family:var(--font-display),serif]"
                style={{ textWrap: "balance" }}
              >
                Moonlit Progress
                <span className="mt-1 block text-[#dbeaff]">Competition Board</span>
              </h1>

              <p className="m-0 max-w-[60ch] text-[1rem] leading-relaxed text-[color:var(--text-muted)] md:text-[1.05rem]">
                Compare character progress across your race into Midnight with a board that favors
                visible momentum: score, mythic push, gear climb, and daily movement all in one
                war-table.
              </p>

              <div className="mt-4 flex flex-wrap gap-2.5">
                <span className="rounded-full border border-[rgba(224,197,138,0.25)] bg-[rgba(224,197,138,0.06)] px-3 py-1.5 text-[0.82rem] text-[rgba(233,220,188,0.95)]">
                  Weighted composite ranking
                </span>
                <span className="rounded-full border border-[rgba(139,223,255,0.2)] bg-[rgba(139,223,255,0.05)] px-3 py-1.5 text-[0.82rem] text-[rgba(213,240,255,0.95)]">
                  Momentum deltas tracked daily
                </span>
                <span className="rounded-full border border-[rgba(139,223,255,0.18)] bg-[rgba(20,32,64,0.5)] px-3 py-1.5 text-[0.82rem] text-[color:var(--text-muted)]">
                  Midnight theme / local-first MVP
                </span>
              </div>
            </div>

            <div className="grid gap-3 self-start">
              <div className="rounded-2xl border border-[rgba(139,223,255,0.14)] bg-[rgba(7,12,26,0.72)] p-3.5 shadow-[inset_0_0_0_1px_rgba(139,223,255,0.04)]">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                    Snapshot
                  </p>
                  <span className="h-px flex-1 bg-gradient-to-r from-[rgba(139,223,255,0.2)] to-transparent" />
                </div>
                <p className="m-0 text-sm leading-snug text-[#e9f5ff]">
                  {formatSnapshotDate(data.snapshotDate)}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-2xl border border-[rgba(224,197,138,0.14)] bg-[rgba(16,16,28,0.6)] p-3.5">
                  <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                    Last Poll
                  </p>
                  <p className="mt-1 text-[0.95rem] leading-snug text-[#f4e8bf]">
                    {data.lastJob?.finishedAt ? formatDate(data.lastJob.finishedAt) : "Not run"}
                  </p>
                </div>

                <div className="rounded-2xl border border-[rgba(139,223,255,0.14)] bg-[rgba(9,14,32,0.6)] p-3.5">
                  <p className="m-0 text-[0.72rem] uppercase tracking-[0.14em] text-[color:var(--text-muted)]">
                    Job Status
                  </p>
                  <p
                    className={`mt-1 text-[0.95rem] font-semibold tracking-[0.03em] ${jobStatusClass(
                      data.lastJob?.status ?? null
                    )}`}
                  >
                    {data.lastJob?.status ?? "UNKNOWN"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <LeaderboardTable rows={tableRows} />

        {loadError ? (
          <section
            aria-labelledby="load-error-heading"
            className="relative overflow-hidden rounded-[22px] border border-[rgba(255,159,174,0.18)] bg-[rgba(28,8,16,0.52)] p-4 [box-shadow:0_20px_60px_rgba(24,5,13,0.42)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(255,159,174,0.35)] to-transparent" />
            <h2
              id="load-error-heading"
              className="mb-[0.35rem] text-[1.05rem] uppercase tracking-[0.1em] text-[#ffd6de] [font-family:var(--font-display),serif]"
            >
              Leaderboard Load Error
            </h2>
            <p className="m-0 text-[rgba(255,226,232,0.8)]">
              The UI is working, but the database query failed. This is expected before setup is
              complete.
            </p>
            <pre className="mt-[0.55rem] whitespace-pre-wrap rounded-xl border border-[rgba(255,159,174,0.14)] bg-[rgba(255,159,174,0.03)] p-3 text-[0.86rem] leading-relaxed text-[#ffd4d4]">
              {loadError}
            </pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}
