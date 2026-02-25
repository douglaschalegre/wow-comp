import { LeaderboardTable } from "@/components/leaderboard-table";
import { getLatestLeaderboardView } from "@/lib/leaderboard/query";

export const dynamic = "force-dynamic";

type HomePageData = Awaited<ReturnType<typeof getLatestLeaderboardView>>;

const EMPTY_HOME_PAGE_DATA: HomePageData = {
  snapshotDate: null,
  rows: [],
  lastJob: null,
  scoreProfile: null
};

function formatDate(value: Date | null): string {
  if (!value) return "No snapshots yet";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(value);
}

function formatSnapshotDate(value: Date | null): string {
  if (!value) return "No snapshot data";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeZone: "UTC"
  }).format(value);
}

function jobStatusClass(status: string | null): string {
  if (!status) return "text-[color:var(--muted)]";
  if (status === "SUCCESS") return "text-white";
  if (status === "PARTIAL_FAILURE") return "text-zinc-200";
  return "text-white";
}

export default async function HomePage(): Promise<React.JSX.Element> {
  let data: HomePageData = EMPTY_HOME_PAGE_DATA;
  let loadError: string | null = null;

  try {
    data = await getLatestLeaderboardView();
  } catch (error) {
    data = EMPTY_HOME_PAGE_DATA;
    loadError = error instanceof Error ? error.message : String(error);
  }

  const tableRows = data.rows.map((row) => ({
    ...row,
    polledAtIso: row.polledAt.toISOString()
  }));

  return (
    <main className="min-h-dvh px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid w-full max-w-[1280px] gap-4 md:gap-5">
        <section
          aria-labelledby="league-title"
          className="overflow-hidden border border-[color:var(--line)] bg-[color:var(--panel)]"
        >
          <div className="grid gap-5 border-b border-[color:var(--line)] p-4 md:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,360px)]">
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <span className="text-[0.72rem] uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  WoW Midnight League
                </span>
                <span className="h-px flex-1 bg-[color:var(--line)]" />
              </div>
              <h1
                id="league-title"
                className="m-0 text-[clamp(1.8rem,4vw,3.1rem)] leading-[0.96] tracking-[0.02em] [font-family:var(--font-display),serif]"
                style={{ textWrap: "balance" }}
              >
                Midnight Progress
                <span className="mt-1 block text-zinc-200">Competition Board</span>
              </h1>

              <p className="m-0 max-w-[62ch] text-[0.98rem] leading-relaxed text-[color:var(--muted)] md:text-[1rem]">
                Compare character progress across your race into Midnight with a board that favors
                visible momentum: score, mythic push, gear climb, and day-over-day movement in one
                table.
              </p>

              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <div className="border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3 py-2">
                  <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--dim)]">
                    Ranking
                  </p>
                  <p className="mt-1 text-[0.88rem] leading-snug text-zinc-100">
                    Weighted composite score
                  </p>
                </div>
                <div className="border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3 py-2">
                  <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--dim)]">
                    Momentum
                  </p>
                  <p className="mt-1 text-[0.88rem] leading-snug text-zinc-100">
                    Daily deltas for rank and progress
                  </p>
                </div>
                <div className="border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3 py-2">
                  <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--dim)]">
                    Scope
                  </p>
                  <p className="mt-1 text-[0.88rem] leading-snug text-zinc-100">
                    US / EU tracked characters
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--muted)]">
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-black px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--horde)]" />
                  Horde
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--line)] bg-black px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-[color:var(--alliance)]" />
                  Alliance
                </span>
              </div>
            </div>

            <div className="grid content-start gap-3">
              <div className="border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3 py-3">
                <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--dim)]">
                  Snapshot (UTC)
                </p>
                <p className="mt-1 text-[0.92rem] leading-snug text-zinc-100">
                  {formatSnapshotDate(data.snapshotDate)}
                </p>
              </div>

              <div className="border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3 py-3">
                <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--dim)]">
                  Last Poll (UTC)
                </p>
                <p className="mt-1 text-[0.92rem] leading-snug text-zinc-100">
                  {data.lastJob?.finishedAt ? formatDate(data.lastJob.finishedAt) : "Not run"}
                </p>
              </div>

              <div className="border border-[color:var(--line)] bg-[color:var(--panel-2)] px-3 py-3">
                <p className="m-0 text-[0.68rem] uppercase tracking-[0.14em] text-[color:var(--dim)]">
                  Job Status
                </p>
                <p
                  className={`mt-1 text-[0.92rem] font-semibold tracking-[0.04em] [font-family:var(--font-mono),monospace] ${jobStatusClass(
                    data.lastJob?.status ?? null
                  )}`}
                >
                  {data.lastJob?.status ?? "UNKNOWN"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[color:var(--line)] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5">
            <p className="m-0 text-[0.9rem] leading-relaxed text-[color:var(--muted)]">
              Score remains the weighted ranking metric. Rank, quests, and reputation include
              current values with deltas inline when available.
            </p>
            <div className="inline-flex flex-wrap gap-2 text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--muted)]">
              <span className="rounded-full border border-[color:var(--line)] bg-black px-3 py-1">
                {tableRows.length} tracked
              </span>
              <span className="rounded-full border border-[color:var(--line)] bg-black px-3 py-1">
                Daily snapshots
              </span>
            </div>
          </div>
        </section>

        <LeaderboardTable rows={tableRows} />

        {loadError ? (
          <section
            aria-labelledby="load-error-heading"
            className="overflow-hidden border border-[color:var(--line)] bg-[color:var(--panel)] p-4"
          >
            <h2
              id="load-error-heading"
              className="mb-1 text-[1rem] uppercase tracking-[0.1em] text-white [font-family:var(--font-display),serif]"
            >
              Leaderboard Load Error
            </h2>
            <p className="m-0 text-[color:var(--muted)]">
              The UI is working, but the database query failed. This is expected before setup is
              complete.
            </p>
            <pre className="mt-3 whitespace-pre-wrap border border-[color:var(--line)] bg-black p-3 text-[0.84rem] leading-relaxed text-zinc-200 [font-family:var(--font-mono),monospace]">
              {loadError}
            </pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}
