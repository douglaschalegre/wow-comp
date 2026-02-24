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
  if (!status) return "text-[#f1d27d]";
  if (status === "SUCCESS") return "text-[color:var(--good)]";
  if (status === "PARTIAL_FAILURE") return "text-[#f1d27d]";
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
    <main className="relative min-h-dvh px-4 pb-12 pt-8 md:px-[1.4rem] md:pb-[3.2rem] md:pt-[2.4rem]">
      <div className="mx-auto grid w-full max-w-[1200px] gap-[1.2rem]">
        <section
          aria-labelledby="league-title"
          className="relative overflow-hidden rounded-[18px] border border-[rgba(207,179,107,0.35)] bg-[rgba(8,9,10,0.72)] px-[1.1rem] pb-[1.2rem] pt-[1.1rem] shadow-heavy md:px-[1.25rem] md:pb-[1.35rem] md:pt-[1.2rem]"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(231,220,198,0.06), transparent 45%), linear-gradient(0deg, rgba(8,9,10,0.72), rgba(8,9,10,0.72))"
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-16 h-72 w-72 rounded-full opacity-90 blur-[2px]"
            style={{
              background: "radial-gradient(circle, rgba(207,179,107,0.28), transparent 70%)"
            }}
          />
          <div className="text-[0.78rem] uppercase tracking-[0.16em] text-[color:var(--text-muted)]">
            World of Warcraft Midnight Tracker
          </div>
          <h1
            id="league-title"
            className="mb-1 mt-[0.35rem] font-display text-[clamp(1.9rem,4vw,3rem)] leading-[1.03] tracking-[0.02em]"
            style={{ textWrap: "balance" }}
          >
            Progress League Leaderboard
          </h1>
          <p className="m-0 max-w-[66ch] text-[1.03rem] text-[color:var(--text-muted)]">
            Daily Blizzard API snapshots, composite progress scoring, and a ranked table for your
            Midnight race. Admin tools and Telegram digests are intentionally deferred in this
            phase.
          </p>
          <div className="mt-[0.95rem] flex flex-wrap gap-[0.55rem]">
            <span className="rounded-full border border-[rgba(207,179,107,0.32)] bg-[rgba(231,220,198,0.04)] px-[0.7rem] py-[0.4rem] text-[0.88rem]">
              Snapshot Date: <strong className="font-bold text-[#f7e2aa]">{formatSnapshotDate(data.snapshotDate)}</strong>
            </span>
            <span className="rounded-full border border-[rgba(207,179,107,0.32)] bg-[rgba(231,220,198,0.04)] px-[0.7rem] py-[0.4rem] text-[0.88rem]">
              Last Poll:{" "}
              <strong className="font-bold text-[#f7e2aa]">
                {data.lastJob?.finishedAt ? formatDate(data.lastJob.finishedAt) : "Not run"}
              </strong>
            </span>
            <span className="rounded-full border border-[rgba(207,179,107,0.32)] bg-[rgba(231,220,198,0.04)] px-[0.7rem] py-[0.4rem] text-[0.88rem]">
              Job Status:{" "}
              <strong className={`font-bold text-[#f7e2aa] ${jobStatusClass(data.lastJob?.status ?? null)}`}>
                {data.lastJob?.status ?? "UNKNOWN"}
              </strong>
            </span>
          </div>
        </section>

        <LeaderboardTable rows={tableRows} />

        {loadError ? (
          <section
            aria-labelledby="load-error-heading"
            className="rounded-[18px] border border-[rgba(207,179,107,0.22)] bg-[rgba(12,12,13,0.78)] p-4 shadow-heavy"
          >
            <h2
              id="load-error-heading"
              className="mb-[0.35rem] font-display text-[1.05rem] uppercase tracking-[0.08em]"
            >
              Leaderboard Load Error
            </h2>
            <p className="m-0 text-[color:var(--text-muted)]">
              The UI is working, but the database query failed. This is expected before setup is
              complete.
            </p>
            <pre className="mt-[0.45rem] whitespace-pre-wrap text-[#ffd4d4]">{loadError}</pre>
          </section>
        ) : null}
      </div>
    </main>
  );
}
