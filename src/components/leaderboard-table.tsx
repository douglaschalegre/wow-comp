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
  completedQuestCount: number;
  reputationProgressTotal: number;
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

interface CharacterPortraitProps {
  portraitUrl: string | null;
  characterName: string;
}

const TH_CLASS =
  "sticky top-0 z-[1] whitespace-nowrap border-b border-[color:var(--line-strong)] bg-black px-3 py-2.5 text-left text-[0.68rem] font-medium uppercase tracking-[0.16em] text-[color:var(--muted)]";

const TD_CLASS = "border-b border-[color:var(--line)] px-3 py-3 align-middle";

const TD_NUM_CLASS = `${TD_CLASS} whitespace-nowrap text-center tabular-nums [font-family:var(--font-mono),monospace]`;

const WHOLE_NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0
});

function formatUtcDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(date);
}

function formatSigned(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits));
  const fixed = rounded.toFixed(digits);
  if (rounded > 0) return `+${fixed}`;
  return fixed;
}

function formatSignedInteger(value: number): string {
  const rounded = Math.round(value);
  const abs = WHOLE_NUMBER_FORMATTER.format(Math.abs(rounded));
  if (rounded > 0) return `+${abs}`;
  if (rounded < 0) return `-${abs}`;
  return "0";
}

function formatWholeNumber(value: number): string {
  return WHOLE_NUMBER_FORMATTER.format(Math.round(value));
}

function formatRankChange(value: number | "NEW" | null): string {
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
): string {
  if (value === null) return unavailableClass;
  if (value > 0) return posClass;
  if (value < 0) return negClass;
  return neutralClass;
}

function rankToneClass(value: number | "NEW" | null): string {
  if (value === "NEW") return "text-white font-semibold";
  if (value === null) return "text-[color:var(--dim)]";
  if (value > 0) return "text-white font-semibold";
  if (value < 0) return "text-zinc-300 font-semibold";
  return "text-[color:var(--muted)]";
}

function formatBestKey(level: number): string {
  return level > 0 ? `+${Math.round(level)}` : "--";
}

function characterInitial(name: string): string {
  const trimmed = name.trim();
  return (trimmed[0] ?? "?").toUpperCase();
}

function rankBadgeClass(rank: number | null): string {
  if (rank === 1) return "border-white bg-white text-black";
  if (rank === 2) return "border-zinc-300 bg-zinc-900 text-zinc-100";
  if (rank === 3) return "border-zinc-600 bg-zinc-950 text-zinc-200";
  return "border-[color:var(--line-strong)] bg-[color:var(--panel-2)] text-zinc-100";
}

function factionAccentClass(faction: FactionCode | null): string {
  if (faction === "HORDE") return "bg-[color:var(--horde)]";
  if (faction === "ALLIANCE") return "bg-[color:var(--alliance)]";
  return "bg-[color:var(--line-strong)]";
}

function leadBadgeClass(faction: FactionCode | null): string {
  if (faction === "HORDE") {
    return "border-[rgba(251,113,133,0.55)] bg-[rgba(251,113,133,0.14)] text-[#fda4af]";
  }
  if (faction === "ALLIANCE") {
    return "border-[rgba(96,165,250,0.6)] bg-[rgba(96,165,250,0.14)] text-[#93c5fd]";
  }
  return "border-[color:var(--line-strong)] bg-black text-zinc-200";
}

function CharacterPortrait({
  portraitUrl,
  characterName
}: CharacterPortraitProps): React.JSX.Element {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [portraitUrl]);

  if (!portraitUrl || imageFailed) {
    return (
      <span
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[color:var(--line-strong)] bg-[color:var(--panel-2)] text-sm text-zinc-100 [font-family:var(--font-display),serif]"
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
      className="block h-11 w-11 shrink-0 rounded-md border border-[color:var(--line-strong)] object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  );
}

export function LeaderboardTable({ rows }: LeaderboardTableProps): React.JSX.Element {
  return (
    <section
      aria-labelledby="leaderboard-heading"
      className="overflow-hidden border border-[color:var(--line)] bg-[color:var(--panel)]"
    >
      <div className="border-b border-[color:var(--line)] px-4 py-4 md:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="m-0 text-[0.7rem] uppercase tracking-[0.16em] text-[color:var(--muted)]">
              Leaderboard
            </p>
            <h2
              id="leaderboard-heading"
              className="mt-1 text-[1.05rem] uppercase tracking-[0.08em] text-white [font-family:var(--font-display),serif] md:text-[1.12rem]"
            >
              Current Standings
            </h2>
            <p className="mt-1.5 max-w-[72ch] text-[0.9rem] leading-relaxed text-[color:var(--muted)]">
              Score is the weighted ranking metric. Rank, quests, and reputation show current
              values with day-over-day deltas when available.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[0.75rem] uppercase tracking-[0.14em] text-[color:var(--muted)]">
            <span className="rounded-full border border-[color:var(--line)] bg-black px-3 py-1">
              {rows.length} tracked
            </span>
            <span className="rounded-full border border-[color:var(--line)] bg-black px-3 py-1">
              US / EU
            </span>
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
      </div>

      <div className="overflow-auto">
        <table className="w-full min-w-[1280px] border-collapse" aria-label="WoW character leaderboard">
          <thead>
            <tr>
              <th scope="col" className={TH_CLASS}>
                Rank
              </th>
              <th scope="col" className={TH_CLASS}>
                Character
              </th>
              {[
                { label: "Level", centered: true },
                { label: "ilvl", centered: true },
                { label: "M+ Rating", centered: true },
                { label: "Best Key", centered: true },
                { label: "Score", centered: true },
                { label: "Quests", centered: true },
                { label: "Rep", centered: true },
                { label: "Updated (UTC)", centered: false }
              ].map((column) => (
                <th
                  key={column.label}
                  scope="col"
                  className={column.centered ? `${TH_CLASS} text-center` : TH_CLASS}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10}>
                  <div className="m-4 border border-dashed border-[color:var(--line-strong)] bg-black p-5">
                    <h3 className="mb-1 text-[0.95rem] uppercase tracking-[0.08em] text-white [font-family:var(--font-display),serif]">
                      No Leaderboard Data Yet
                    </h3>
                    <p className="m-0 max-w-[80ch] leading-relaxed text-[color:var(--muted)]">
                      Configure characters in{" "}
                      <code className="rounded bg-[color:var(--panel-2)] px-1.5 py-0.5 text-zinc-200">
                        config/tracked-characters.json
                      </code>
                      , set Blizzard credentials and database settings, then run the polling job to
                      populate the standings.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const striped = index % 2 === 0 ? "bg-[rgba(255,255,255,0.015)]" : "bg-transparent";
                const rowHover = "hover:bg-[rgba(255,255,255,0.04)]";
                const deltaPos = "text-white font-semibold";
                const deltaNeg = "text-zinc-300 font-semibold";
                const deltaNeutral = "text-[color:var(--muted)]";
                const deltaMissing = "text-[color:var(--dim)]";

                return (
                  <tr key={row.trackedCharacterId} className={`${striped} ${rowHover} transition-colors`}>
                    <td className={TD_CLASS}>
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-[0.9rem] [font-family:var(--font-display),serif] ${rankBadgeClass(
                            row.rank
                          )}`}
                        >
                          {row.rank ?? "-"}
                        </span>
                        {row.rankChange !== null ? (
                          <span
                            className={`text-[0.78rem] tracking-[0.06em] [font-family:var(--font-mono),monospace] ${rankToneClass(
                              row.rankChange
                            )}`}
                          >
                            {formatRankChange(row.rankChange)}
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className={TD_CLASS}>
                      <div className="grid min-w-0 grid-cols-[2px_auto_minmax(0,1fr)] items-center gap-3">
                        <span
                          className={`h-11 w-[2px] rounded-full ${factionAccentClass(row.faction)}`}
                          aria-hidden="true"
                        />

                        <div className="relative">
                          <CharacterPortrait
                            portraitUrl={row.portraitUrl}
                            characterName={row.characterName}
                          />
                          <span
                            className={`pointer-events-none absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border border-black ${factionAccentClass(
                              row.faction
                            )}`}
                            aria-hidden="true"
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[0.98rem] font-semibold tracking-[0.01em] text-white">
                              {row.characterName}
                            </span>
                            {row.rank === 1 ? (
                              <span
                                className={`shrink-0 rounded-full border px-2 py-[2px] text-[0.65rem] uppercase tracking-[0.12em] ${leadBadgeClass(
                                  row.faction
                                )}`}
                              >
                                Lead
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-[0.8rem] text-[color:var(--muted)]">
                            <span className="truncate">{row.realmSlug}</span>
                            <span className="inline-block h-1 w-1 rounded-full bg-[color:var(--line-strong)]" />
                            <span className="[font-family:var(--font-mono),monospace] text-[color:var(--dim)]">
                              #{row.trackedCharacterId.slice(-4)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className={`${TD_NUM_CLASS} text-zinc-100`}>{Math.round(row.level)}</td>
                    <td className={`${TD_NUM_CLASS} text-zinc-100`}>{Math.round(row.itemLevel)}</td>
                    <td className={`${TD_NUM_CLASS} text-zinc-100`}>
                      {Math.round(row.mythicPlusRating)}
                    </td>
                    <td className={`${TD_NUM_CLASS} text-zinc-100`}>
                      {formatBestKey(row.bestKeyLevel)}
                    </td>
                    <td className={`${TD_NUM_CLASS} font-semibold text-white`}>
                      <div className="inline-flex items-center gap-1.5">
                        <span>{row.totalScore.toFixed(2)}</span>
                        <span
                          className={`text-[0.76rem] ${toneClass(
                            row.dailyDelta,
                            deltaMissing,
                            deltaNeutral,
                            deltaPos,
                            deltaNeg
                          )}`}
                        >
                          ({formatSigned(row.dailyDelta, 2)})
                        </span>
                      </div>
                    </td>
                    <td className={TD_NUM_CLASS}>
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-zinc-100">{formatWholeNumber(row.completedQuestCount)}</span>
                        {row.questDelta !== null ? (
                          <span
                            className={`text-[0.76rem] ${toneClass(
                              row.questDelta,
                              deltaMissing,
                              deltaNeutral,
                              deltaPos,
                              deltaNeg
                            )}`}
                          >
                            ({formatSignedInteger(row.questDelta)})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={TD_NUM_CLASS}>
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-zinc-100">
                          {formatWholeNumber(row.reputationProgressTotal)}
                        </span>
                        {row.reputationDelta !== null ? (
                          <span
                            className={`text-[0.76rem] ${toneClass(
                              row.reputationDelta,
                              deltaMissing,
                              deltaNeutral,
                              deltaPos,
                              deltaNeg
                            )}`}
                          >
                            ({formatSignedInteger(row.reputationDelta)})
                          </span>
                        ) : null}
                      </div>
                    </td>

                    <td className={`${TD_CLASS} whitespace-nowrap text-[0.8rem] text-[color:var(--muted)]`}>
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
