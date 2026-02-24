"use client";

import { useEffect, useState } from "react";
import type { FactionCode } from "@/lib/types";
import styles from "./leaderboard-table.module.css";

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
  if (value === "NEW") return styles.deltaNew;
  if (value === null) return styles.deltaUnavailable;
  if (value > 0) return styles.deltaUp;
  if (value < 0) return styles.deltaDown;
  return styles.deltaFlat;
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
      <span className={`${styles.charPortrait} ${styles.charPortraitFallback}`} aria-hidden="true">
        {characterInitial(characterName)}
      </span>
    );
  }

  return (
    <img
      src={portraitUrl}
      alt={`${characterName} portrait`}
      className={`${styles.charPortrait} ${styles.charPortraitImage}`}
      loading="lazy"
      decoding="async"
      onError={() => setImageFailed(true)}
    />
  );
}

function HordeFactionGlyph() {
  return (
    <svg viewBox="0 0 24 24" className={styles.factionGlyph} aria-hidden="true" focusable="false">
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
    <svg viewBox="0 0 24 24" className={styles.factionGlyph} aria-hidden="true" focusable="false">
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
    return <span className={styles.factionFallback}>--</span>;
  }

  const isHorde = faction === "HORDE";
  const label = isHorde ? "Horde" : "Alliance";

  return (
    <span
      className={`${styles.factionBadge} ${isHorde ? styles.factionHorde : styles.factionAlliance}`}
      role="img"
      aria-label={label}
      title={label}
    >
      {isHorde ? <HordeFactionGlyph /> : <AllianceFactionGlyph />}
    </span>
  );
}

export function LeaderboardTable({ rows }: LeaderboardTableProps) {
  return (
    <section className={styles.tablePanel} aria-labelledby="leaderboard-heading">
      <div className={styles.tableHeader}>
        <div>
          <h2 id="leaderboard-heading" className={styles.tableTitle}>
            Current Standings
          </h2>
          <p className={styles.tableHint}>
            Momentum columns show progress since the previous snapshot. Score remains the weighted
            composite ranking metric.
          </p>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Character</th>
              <th scope="col" className={styles.factionHeader}>
                Faction
              </th>
              <th scope="col">Region</th>
              <th scope="col">Level</th>
              <th scope="col">ilvl</th>
              <th scope="col">M+ Rating</th>
              <th scope="col">Best Key</th>
              <th scope="col">Score</th>
              <th scope="col">Rank Δ</th>
              <th scope="col">Score Δ</th>
              <th scope="col">Quest Δ</th>
              <th scope="col">Rep Δ</th>
              <th scope="col">Updated (UTC)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={14}>
                  <div className={styles.emptyPanel}>
                    <h3 className={styles.emptyTitle}>No Leaderboard Data Yet</h3>
                    <p className={styles.emptyText}>
                      Configure characters in <code>config/tracked-characters.json</code>, set
                      Blizzard credentials and database settings, then run the polling job to
                      populate the standings.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.trackedCharacterId}>
                  <td>
                    <span className={styles.rankBadge}>{row.rank ?? "-"}</span>
                  </td>
                  <td>
                    <div className={styles.charCell}>
                      <CharacterPortrait portraitUrl={row.portraitUrl} characterName={row.characterName} />
                      <div className={styles.charIdentity}>
                        <span className={styles.charName}>{row.characterName}</span>
                        <span className={styles.charMeta}>{row.realmSlug}</span>
                      </div>
                    </div>
                  </td>
                  <td className={styles.factionCell}>
                    <FactionIconCell faction={row.faction} />
                  </td>
                  <td>{row.region}</td>
                  <td className={styles.numCell}>{Math.round(row.level)}</td>
                  <td className={styles.numCell}>{Math.round(row.itemLevel)}</td>
                  <td className={styles.numCell}>{Math.round(row.mythicPlusRating)}</td>
                  <td className={styles.numCell}>{formatBestKey(row.bestKeyLevel)}</td>
                  <td className={styles.scoreValue}>{row.totalScore.toFixed(2)}</td>
                  <td className={rankToneClass(row.rankChange)}>{formatRankChange(row.rankChange)}</td>
                  <td
                    className={toneClass(
                      row.dailyDelta,
                      styles.deltaUnavailable,
                      styles.deltaFlat,
                      styles.deltaUp,
                      styles.deltaDown
                    )}
                  >
                    {formatSigned(row.dailyDelta, 2)}
                  </td>
                  <td
                    className={toneClass(
                      row.questDelta,
                      styles.deltaUnavailable,
                      styles.deltaFlat,
                      styles.deltaUp,
                      styles.deltaDown
                    )}
                  >
                    {formatSignedNullable(row.questDelta, 0)}
                  </td>
                  <td
                    className={toneClass(
                      row.reputationDelta,
                      styles.deltaUnavailable,
                      styles.deltaFlat,
                      styles.deltaUp,
                      styles.deltaDown
                    )}
                  >
                    {formatSignedNullable(row.reputationDelta, 0)}
                  </td>
                  <td>{formatUtcDateTime(row.polledAtIso)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
