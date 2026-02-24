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
  if (value === "NEW") return "text-[#f1d27d] font-bold";
  if (value === null) return "text-[rgba(247,240,222,0.45)]";
  if (value > 0) return "text-[color:var(--good)] font-bold";
  if (value < 0) return "text-[color:var(--bad)] font-bold";
  return "text-[color:var(--text-muted)]";
}

function formatBestKey(level: number) {
  return level > 0 ? `+${Math.round(level)}` : "--";
}

function characterInitial(name: string) {
  const trimmed = name.trim();
  return (trimmed[0] ?? "?").toUpperCase();
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
        className="inline-flex h-[2.35rem] w-[2.35rem] items-center justify-center rounded-xl border border-[rgba(207,179,107,0.2)] bg-[rgba(12,12,13,0.7)] text-[0.95rem] tracking-[0.04em] text-[#f1d27d] shadow-[inset_0_0_0_1px_rgba(8,9,10,0.3),0_4px_10px_rgba(0,0,0,0.18)] [font-family:var(--font-display),serif]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 24% 20%, rgba(231,220,198,0.14), transparent 68%), linear-gradient(0deg, rgba(12,12,13,0.7), rgba(12,12,13,0.7))"
        }}
        aria-hidden="true"
      >
        {characterInitial(characterName)}
      </span>
    );
  }

  return (
    <img
      src={portraitUrl}
      alt={`${characterName} portrait`}
      className="block h-[2.35rem] w-[2.35rem] rounded-xl border border-[rgba(207,179,107,0.2)] object-cover shadow-[inset_0_0_0_1px_rgba(8,9,10,0.3),0_4px_10px_rgba(0,0,0,0.18)]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 24% 20%, rgba(231,220,198,0.14), transparent 68%), linear-gradient(0deg, rgba(12,12,13,0.7), rgba(12,12,13,0.7))"
      }}
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
        fill="rgba(9, 10, 12, 0.62)"
      />
    </svg>
  );
}

function FactionIconCell({ faction }: { faction: FactionCode | null }) {
  if (!faction) {
    return <span className="text-[0.85rem] text-[rgba(247,240,222,0.45)]">--</span>;
  }

  const isHorde = faction === "HORDE";
  const label = isHorde ? "Horde" : "Alliance";

  return (
    <span
      className={`inline-flex h-[1.7rem] w-[1.7rem] items-center justify-center rounded-full border border-[rgba(231,220,198,0.18)] bg-[rgba(231,220,198,0.03)] shadow-[inset_0_0_0_1px_rgba(8,9,10,0.28)] ${
        isHorde
          ? "text-[#f28b7c] border-[rgba(242,139,124,0.28)] bg-[rgba(91,26,23,0.18)]"
          : "text-[#7db7ff] border-[rgba(125,183,255,0.28)] bg-[rgba(17,44,89,0.18)]"
      }`}
      style={
        isHorde
          ? {
              backgroundImage:
                "radial-gradient(circle at 30% 28%, rgba(242,139,124,0.18), transparent 70%), linear-gradient(0deg, rgba(91,26,23,0.18), rgba(91,26,23,0.18))"
            }
          : {
              backgroundImage:
                "radial-gradient(circle at 32% 28%, rgba(125,183,255,0.18), transparent 70%), linear-gradient(0deg, rgba(17,44,89,0.18), rgba(17,44,89,0.18))"
            }
      }
      role="img"
      aria-label={label}
      title={label}
    >
      {isHorde ? <HordeFactionGlyph /> : <AllianceFactionGlyph />}
    </span>
  );
}

export function LeaderboardTable({ rows }: LeaderboardTableProps) {
  const panelClass =
    "overflow-hidden rounded-[18px] border border-[rgba(207,179,107,0.22)] bg-[rgba(12,12,13,0.78)] [box-shadow:var(--shadow-heavy)]";

  return (
    <section className={panelClass} aria-labelledby="leaderboard-heading">
      <div className="flex items-center justify-between gap-4 border-b border-[rgba(207,179,107,0.16)] bg-gradient-to-b from-[rgba(207,179,107,0.05)] to-transparent px-4 py-[0.95rem]">
        <div>
          <h2
            id="leaderboard-heading"
            className="m-0 text-[1.05rem] uppercase tracking-[0.06em] [font-family:var(--font-display),serif]"
          >
            Current Standings
          </h2>
          <p className="mt-1 text-[0.9rem] text-[color:var(--text-muted)]">
            Momentum columns show progress since the previous snapshot. Score remains the weighted
            composite ranking metric.
          </p>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1480px] border-collapse">
          <thead>
            <tr>
              <th
                scope="col"
                className="whitespace-nowrap border-b border-[rgba(207,179,107,0.12)] px-3 py-[0.8rem] text-left text-[0.74rem] uppercase tracking-[0.12em] text-[color:var(--text-muted)]"
              >
                Rank
              </th>
              <th
                scope="col"
                className="whitespace-nowrap border-b border-[rgba(207,179,107,0.12)] px-3 py-[0.8rem] text-left text-[0.74rem] uppercase tracking-[0.12em] text-[color:var(--text-muted)]"
              >
                Character
              </th>
              <th
                scope="col"
                className="whitespace-nowrap border-b border-[rgba(207,179,107,0.12)] px-3 py-[0.8rem] text-center text-[0.74rem] uppercase tracking-[0.12em] text-[color:var(--text-muted)]"
              >
                Faction
              </th>
              {["Region", "Level", "ilvl", "M+ Rating", "Best Key", "Score", "Rank Δ", "Score Δ", "Quest Δ", "Rep Δ", "Updated (UTC)"].map(
                (label) => (
                  <th
                    key={label}
                    scope="col"
                    className="whitespace-nowrap border-b border-[rgba(207,179,107,0.12)] px-3 py-[0.8rem] text-left text-[0.74rem] uppercase tracking-[0.12em] text-[color:var(--text-muted)]"
                  >
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={14}>
                  <div className="m-3 rounded-[14px] border border-[rgba(207,179,107,0.16)] bg-[rgba(12,12,13,0.55)] p-4">
                    <h3 className="mb-[0.35rem] mt-0 text-[1rem] uppercase tracking-[0.06em] [font-family:var(--font-display),serif]">
                      No Leaderboard Data Yet
                    </h3>
                    <p className="m-0 text-[color:var(--text-muted)]">
                      Configure characters in <code>config/tracked-characters.json</code>, set
                      Blizzard credentials and database settings, then run the polling job to
                      populate the standings.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.trackedCharacterId}
                  className="hover:bg-[rgba(231,220,198,0.03)]"
                >
                  <td className="align-middle border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem]">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(207,179,107,0.24)] bg-[rgba(207,179,107,0.08)] [font-family:var(--font-display),serif]">
                      {row.rank ?? "-"}
                    </span>
                  </td>
                  <td className="align-middle border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem]">
                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.6rem]">
                      <CharacterPortrait portraitUrl={row.portraitUrl} characterName={row.characterName} />
                      <div className="grid min-w-0 gap-[0.15rem]">
                        <span className="text-[1rem] font-bold">{row.characterName}</span>
                        <span className="text-[0.85rem] text-[color:var(--text-muted)]">
                          {row.realmSlug}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] text-center align-middle">
                    <FactionIconCell faction={row.faction} />
                  </td>
                  <td className="align-middle border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem]">{row.region}</td>
                  <td className="whitespace-nowrap border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle tabular-nums">
                    {Math.round(row.level)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle tabular-nums">
                    {Math.round(row.itemLevel)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle tabular-nums">
                    {Math.round(row.mythicPlusRating)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle tabular-nums">
                    {formatBestKey(row.bestKeyLevel)}
                  </td>
                  <td className="whitespace-nowrap border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle text-[1.03rem] text-[#f7e2aa] [font-family:var(--font-display),serif]">
                    {row.totalScore.toFixed(2)}
                  </td>
                  <td
                    className={`border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle ${rankToneClass(row.rankChange)}`}
                  >
                    {formatRankChange(row.rankChange)}
                  </td>
                  <td
                    className={`border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle ${toneClass(
                      row.dailyDelta,
                      "text-[rgba(247,240,222,0.45)]",
                      "text-[color:var(--text-muted)]",
                      "text-[color:var(--good)] font-bold",
                      "text-[color:var(--bad)] font-bold"
                    )}`}
                  >
                    {formatSigned(row.dailyDelta, 2)}
                  </td>
                  <td
                    className={`border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle ${toneClass(
                      row.questDelta,
                      "text-[rgba(247,240,222,0.45)]",
                      "text-[color:var(--text-muted)]",
                      "text-[color:var(--good)] font-bold",
                      "text-[color:var(--bad)] font-bold"
                    )}`}
                  >
                    {formatSignedNullable(row.questDelta, 0)}
                  </td>
                  <td
                    className={`border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle ${toneClass(
                      row.reputationDelta,
                      "text-[rgba(247,240,222,0.45)]",
                      "text-[color:var(--text-muted)]",
                      "text-[color:var(--good)] font-bold",
                      "text-[color:var(--bad)] font-bold"
                    )}`}
                  >
                    {formatSignedNullable(row.reputationDelta, 0)}
                  </td>
                  <td className="border-b border-[rgba(207,179,107,0.07)] px-3 py-[0.8rem] align-middle">
                    {formatUtcDateTime(row.polledAtIso)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
