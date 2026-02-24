"use client";

import { useEffect, useState } from "react";
import type { FactionCode } from "@/lib/types";

export interface LeaderboardTableRowUi {
  trackedCharacterId: string;
  rank: number | null;
  characterName: string;
  portraitUrl: string | null;
  faction: FactionCode | null;
  realmSlug: string;
  region: "US" | "EU";
  level: number;
  itemLevel: number;
  mythicPlusRating: number;
  bestKeyLevel: number;
  totalScore: number;
  rankChange: number | "NEW" | null;
  dailyDelta: number;
  questDelta: number | null;
  reputationDelta: number | null;
  polledAtIso: string;
}

interface LeaderboardTableProps {
  rows: LeaderboardTableRowUi[];
}

const TH_CLASS =
  "sticky top-0 z-[1] whitespace-nowrap border-b border-[rgba(139,223,255,0.12)] bg-[rgba(6,10,22,0.92)] px-3 py-3 text-left text-[0.7rem] uppercase tracking-[0.14em] text-[rgba(213,229,250,0.75)] backdrop-blur";

const TD_CLASS = "border-b border-[rgba(139,223,255,0.06)] px-3 py-3 align-middle";

const TD_NUM_CLASS = `${TD_CLASS} whitespace-nowrap text-center tabular-nums`;

function formatUtcDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(date);
}

function formatSigned(value: number, digits = 0) {
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}

function formatSignedNullable(value: number | null, digits = 0) {
  if (value === null) return "--";
  return formatSigned(value, digits);
}

function formatRankChange(value: number | "NEW" | null) {
  if (value === "NEW") return "NEW";
  if (value === null) return "--";
  if (value === 0) return "0";
  return value > 0 ? `+${value}` : `${value}`;
}

function toneClass(
  value: number | null,
  unavailableClass: string,
  neutralClass: string,
  posClass: string,
  negClass: string
) {
  if (value === null) return unavailableClass;
  if (value > 0) return posClass;
  if (value < 0) return negClass;
  return neutralClass;
}

function rankToneClass(value: number | "NEW" | null) {
  if (value === "NEW") return "text-[#f0d598] font-semibold";
  if (value === null) return "text-[rgba(213,229,250,0.35)]";
  if (value > 0) return "text-[color:var(--good)] font-semibold";
  if (value < 0) return "text-[color:var(--bad)] font-semibold";
  return "text-[color:var(--text-muted)]";
}

function formatBestKey(level: number) {
  return level > 0 ? `+${Math.round(level)}` : "--";
}

function characterInitial(name: string) {
  const trimmed = name.trim();
  return (trimmed[0] ?? "?").toUpperCase();
}

function rankBadgeClass(rank: number | null) {
  if (rank === 1) {
    return "border-[rgba(240,213,152,0.45)] bg-[radial-gradient(circle_at_30%_20%,rgba(240,213,152,0.2),transparent_70%)] text-[#f8e6ba] shadow-[0_0_18px_rgba(240,213,152,0.16)]";
  }
  if (rank === 2) {
    return "border-[rgba(174,214,255,0.34)] bg-[radial-gradient(circle_at_30%_20%,rgba(174,214,255,0.15),transparent_70%)] text-[#d8eeff]";
  }
  if (rank === 3) {
    return "border-[rgba(190,161,126,0.34)] bg-[radial-gradient(circle_at_30%_20%,rgba(190,161,126,0.14),transparent_70%)] text-[#ead5ba]";
  }
  return "border-[rgba(139,223,255,0.16)] bg-[rgba(139,223,255,0.05)] text-[rgba(232,244,255,0.9)]";
}

function CharacterPortrait({
  portraitUrl,
  characterName
}: {
  portraitUrl: string | null;
  characterName: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [portraitUrl]);

  if (!portraitUrl || imageFailed) {
    return (
      <span
        className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[14px] border border-[rgba(139,223,255,0.22)] text-[0.95rem] tracking-[0.04em] text-[#cfeeff] shadow-[inset_0_0_0_1px_rgba(6,10,22,0.4),0_8px_18px_rgba(0,0,0,0.24)] [font-family:var(--font-display),serif]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 22% 18%, rgba(139,223,255,0.16), transparent 65%), radial-gradient(circle at 78% 82%, rgba(224,197,138,0.09), transparent 68%), linear-gradient(180deg, rgba(15,22,46,0.9), rgba(8,11,23,0.9))"
        }}
        aria-hidden="true"
      >
        {characterInitial(characterName)}
        <span className="pointer-events-none absolute inset-0 rounded-[14px] border border-[rgba(224,197,138,0.08)]" />
      </span>
    );
  }

  return (
    <img
      src={portraitUrl}
      alt={`${characterName} portrait`}
      className="block h-11 w-11 shrink-0 rounded-[14px] border border-[rgba(139,223,255,0.22)] object-cover shadow-[inset_0_0_0_1px_rgba(6,10,22,0.35),0_8px_18px_rgba(0,0,0,0.24)]"
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  );
}

function HordeFactionGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="block h-4 w-4" aria-hidden="true" focusable="false">
      <path
        d="M12 3.1 15.2 6.4 13.6 9.1 17.2 12l-3.6 2.9 1.6 2.7-3.2 3.3-3.2-3.3 1.6-2.7L6.8 12l3.6-2.9-1.6-2.7Z"
        fill="currentColor"
      />
      <path
        d="M7.5 7.4 10 9.8M16.5 7.4 14 9.8M7.5 16.6 10 14.2M16.5 16.6 14 14.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AllianceFactionGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="block h-4 w-4" aria-hidden="true" focusable="false">
      <path
        d="M12 2.7 18.7 5.4v4.8c0 4.4-2.5 8.1-6.7 11.1-4.2-3-6.7-6.7-6.7-11.1V5.4Z"
        fill="currentColor"
      />
      <path
        d="M12 7.2 13.4 10.1l3.2.3-2.4 2 .7 3.1-2.9-1.7-2.9 1.7.7-3.1-2.4-2 3.2-.3Z"
        fill="rgba(7,10,18,0.65)"
      />
    </svg>
  );
}

function FactionIconCell({ faction }: { faction: FactionCode | null }) {
  if (!faction) {
    return <span className="text-[0.85rem] text-[rgba(213,229,250,0.4)]">--</span>;
  }

  const isHorde = faction === "HORDE";
  const label = isHorde ? "Horde" : "Alliance";

  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-[inset_0_0_0_1px_rgba(6,10,22,0.35)] ${
        isHorde
          ? "border-[rgba(255,159,174,0.25)] text-[#ffacb6]"
          : "border-[rgba(139,223,255,0.25)] text-[#9edfff]"
      }`}
      style={{
        backgroundImage: isHorde
          ? "radial-gradient(circle at 30% 25%, rgba(255,159,174,0.22), transparent 70%), linear-gradient(180deg, rgba(46,12,18,0.6), rgba(20,8,14,0.75))"
          : "radial-gradient(circle at 32% 25%, rgba(139,223,255,0.2), transparent 70%), linear-gradient(180deg, rgba(10,22,48,0.7), rgba(8,12,26,0.8))"
      }}
      role="img"
      aria-label={label}
      title={label}
    >
      {isHorde ? <HordeFactionGlyph /> : <AllianceFactionGlyph />}
    </span>
  );
}

function scoreBarWidth(score: number) {
  return `${Math.max(0, Math.min(100, score))}%`;
}

export function LeaderboardTable({ rows }: LeaderboardTableProps) {
  return (
    <section
      aria-labelledby="leaderboard-heading"
      className="relative overflow-hidden rounded-[26px] border border-[rgba(139,223,255,0.14)] bg-[rgba(8,12,26,0.76)] [box-shadow:var(--shadow-heavy)]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 8% 0%, rgba(139,223,255,0.08), transparent 35%), radial-gradient(circle at 92% 10%, rgba(224,197,138,0.06), transparent 38%), linear-gradient(180deg, rgba(11,17,37,0.88), rgba(7,10,22,0.82))"
      }}
    >
      <div className="pointer-events-none absolute inset-[10px] rounded-[18px] border border-[rgba(224,197,138,0.06)]" />

      <div className="relative border-b border-[rgba(139,223,255,0.1)] px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-[rgba(139,223,255,0.18)] bg-[rgba(139,223,255,0.04)] px-3 py-1 text-[0.72rem] uppercase tracking-[0.15em] text-[rgba(204,235,255,0.85)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgba(139,223,255,0.85)] shadow-[0_0_10px_rgba(139,223,255,0.8)]" />
              Midnight War-Table
            </div>
            <h2
              id="leaderboard-heading"
              className="m-0 text-[1.08rem] uppercase tracking-[0.07em] text-[#eaf4ff] [font-family:var(--font-display),serif] md:text-[1.15rem]"
            >
              Current Standings
            </h2>
            <p className="mt-1.5 max-w-[70ch] text-[0.9rem] leading-relaxed text-[color:var(--text-muted)]">
              Score remains the weighted ranking metric. Momentum columns track day-over-day movement
              in position, quests, and reputation to surface who is actually pushing.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-[rgba(224,197,138,0.2)] bg-[rgba(224,197,138,0.05)] px-3 py-1 text-[0.78rem] text-[rgba(240,227,193,0.95)]">
              {rows.length} tracked
            </span>
            <span className="rounded-full border border-[rgba(139,223,255,0.2)] bg-[rgba(139,223,255,0.04)] px-3 py-1 text-[0.78rem] text-[rgba(214,241,255,0.95)]">
              US / EU regions
            </span>
            <span className="rounded-full border border-[rgba(139,223,255,0.14)] bg-[rgba(14,22,48,0.55)] px-3 py-1 text-[0.78rem] text-[color:var(--text-muted)]">
              Daily snapshot cadence
            </span>
          </div>
        </div>
      </div>

      <div className="relative overflow-auto">
        <div className="pointer-events-none sticky left-0 top-0 z-[2] h-px w-full bg-gradient-to-r from-transparent via-[rgba(139,223,255,0.2)] to-transparent" />
        <table className="w-full min-w-[1480px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className={TH_CLASS}>
                Rank
              </th>
              <th scope="col" className={TH_CLASS}>
                Character
              </th>
              <th scope="col" className={`${TH_CLASS} text-center`}>
                Faction
              </th>
              {[
                "Region",
                "Level",
                "ilvl",
                "M+ Rating",
                "Best Key",
                "Score",
                "Rank Δ",
                "Score Δ",
                "Quest Δ",
                "Rep Δ",
                "Updated (UTC)"
              ].map((label) => (
                <th key={label} scope="col" className={TH_CLASS}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={14}>
                  <div className="m-4 rounded-2xl border border-[rgba(139,223,255,0.12)] bg-[rgba(8,12,24,0.62)] p-5 shadow-[inset_0_0_0_1px_rgba(139,223,255,0.03)]">
                    <h3 className="mb-1 text-[1rem] uppercase tracking-[0.08em] text-[#e9f5ff] [font-family:var(--font-display),serif]">
                      No Leaderboard Data Yet
                    </h3>
                    <p className="m-0 max-w-[80ch] leading-relaxed text-[color:var(--text-muted)]">
                      Configure characters in <code>config/tracked-characters.json</code>, set
                      Blizzard credentials and database settings, then run the polling job to
                      populate the standings.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const striped =
                  index % 2 === 0
                    ? "bg-[rgba(7,11,22,0.15)]"
                    : "bg-[rgba(139,223,255,0.01)]";
                const rowHover =
                  "hover:bg-[linear-gradient(90deg,rgba(139,223,255,0.035),rgba(224,197,138,0.02))]";
                const deltaPos = "text-[color:var(--good)] font-semibold";
                const deltaNeg = "text-[color:var(--bad)] font-semibold";
                const deltaNeutral = "text-[color:var(--text-muted)]";
                const deltaMissing = "text-[rgba(213,229,250,0.35)]";

                return (
                  <tr key={row.trackedCharacterId} className={`${striped} ${rowHover} transition-colors`}>
                    <td className={TD_CLASS}>
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-[0.95rem] [font-family:var(--font-display),serif] ${rankBadgeClass(
                          row.rank
                        )}`}
                      >
                        {row.rank ?? "-"}
                      </span>
                    </td>

                    <td className={TD_CLASS}>
                      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
                        <div className="relative">
                          <CharacterPortrait
                            portraitUrl={row.portraitUrl}
                            characterName={row.characterName}
                          />
                          <span
                            className={`pointer-events-none absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border border-[rgba(8,12,22,0.7)] ${
                              row.faction === "HORDE"
                                ? "bg-[radial-gradient(circle,rgba(255,159,174,0.95),rgba(146,46,62,0.95))]"
                                : row.faction === "ALLIANCE"
                                  ? "bg-[radial-gradient(circle,rgba(139,223,255,0.95),rgba(36,93,162,0.95))]"
                                  : "bg-[radial-gradient(circle,rgba(213,229,250,0.65),rgba(95,108,129,0.7))]"
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[1rem] font-semibold tracking-[0.01em] text-[#edf6ff]">
                              {row.characterName}
                            </span>
                            {row.rank === 1 ? (
                              <span className="shrink-0 rounded-full border border-[rgba(240,213,152,0.25)] bg-[rgba(240,213,152,0.06)] px-2 py-[2px] text-[0.68rem] uppercase tracking-[0.12em] text-[#f4e3b6]">
                                Lead
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[0.83rem] text-[color:var(--text-muted)]">
                            <span className="truncate">{row.realmSlug}</span>
                            <span className="inline-block h-1 w-1 rounded-full bg-[rgba(139,223,255,0.25)]" />
                            <span className="text-[rgba(213,229,250,0.55)]">#{row.trackedCharacterId.slice(-4)}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={`${TD_CLASS} text-center`}>
                      <FactionIconCell faction={row.faction} />
                    </td>

                    <td className={`${TD_NUM_CLASS} text-[0.92rem] text-[#e3f2ff]`}>{row.region}</td>
                    <td className={`${TD_NUM_CLASS} text-[0.92rem] text-[#e3f2ff]`}>
                      {Math.round(row.level)}
                    </td>
                    <td className={`${TD_NUM_CLASS} text-[0.92rem] text-[#e3f2ff]`}>
                      {Math.round(row.itemLevel)}
                    </td>
                    <td className={`${TD_NUM_CLASS} text-[0.92rem] text-[#d4efff]`}>
                      {Math.round(row.mythicPlusRating)}
                    </td>
                    <td className={`${TD_NUM_CLASS} text-[0.92rem] text-[#d4efff]`}>
                      {formatBestKey(row.bestKeyLevel)}
                    </td>

                    <td className={`${TD_CLASS} min-w-[120px]`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[1.03rem] leading-none text-[#f7e2aa] [font-family:var(--font-display),serif]">
                          {row.totalScore.toFixed(2)}
                        </span>
                        <span className="text-[0.72rem] uppercase tracking-[0.11em] text-[rgba(213,229,250,0.42)]">
                          score
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-[rgba(139,223,255,0.08)] bg-[rgba(255,255,255,0.02)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[rgba(139,223,255,0.9)] via-[rgba(160,214,255,0.95)] to-[rgba(224,197,138,0.85)] shadow-[0_0_12px_rgba(139,223,255,0.28)]"
                          style={{ width: scoreBarWidth(row.totalScore) }}
                        />
                      </div>
                    </td>

                    <td className={`${TD_NUM_CLASS} ${rankToneClass(row.rankChange)}`}>
                      {formatRankChange(row.rankChange)}
                    </td>
                    <td
                      className={`${TD_NUM_CLASS} ${toneClass(
                        row.dailyDelta,
                        deltaMissing,
                        deltaNeutral,
                        deltaPos,
                        deltaNeg
                      )}`}
                    >
                      {formatSigned(row.dailyDelta, 2)}
                    </td>
                    <td
                      className={`${TD_NUM_CLASS} ${toneClass(
                        row.questDelta,
                        deltaMissing,
                        deltaNeutral,
                        deltaPos,
                        deltaNeg
                      )}`}
                    >
                      {formatSignedNullable(row.questDelta, 0)}
                    </td>
                    <td
                      className={`${TD_NUM_CLASS} ${toneClass(
                        row.reputationDelta,
                        deltaMissing,
                        deltaNeutral,
                        deltaPos,
                        deltaNeg
                      )}`}
                    >
                      {formatSignedNullable(row.reputationDelta, 0)}
                    </td>

                    <td className={`${TD_CLASS} whitespace-nowrap text-[0.8rem] text-[rgba(213,229,250,0.72)]`}>
                      {formatUtcDateTime(row.polledAtIso)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

