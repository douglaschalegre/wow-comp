import type {
  DigestData,
  DigestLeaderboardRow,
  DigestMilestoneLine
} from "@/lib/telegram/query-digest-data";

const MAX_MESSAGE_LENGTH = 3900;
const TOP_ROWS_LIMIT = 10;
const TOP_MOVERS_LIMIT = 5;
const MILESTONES_LIMIT = 8;
const WARNINGS_LIMIT = 8;

function formatUtcDate(date: Date): string {
  return `${date.toISOString().slice(0, 10)} (UTC)`;
}

function formatSigned(value: number): string {
  const rounded = value.toFixed(2);
  return value >= 0 ? `+${rounded}` : rounded;
}

function formatScore(value: number): string {
  return value.toFixed(2);
}

function characterLabel(row: { characterName: string; region: "US" | "EU"; realmSlug: string }): string {
  return `${row.characterName} (${row.region}/${row.realmSlug})`;
}

function rankLabel(rank: number | null): string {
  return rank === null ? "?" : String(rank);
}

function renderLeaderboardRow(row: DigestLeaderboardRow): string {
  return `${rankLabel(row.rank)}. ${characterLabel(row)} | Score ${formatScore(row.totalScore)} | Δ ${formatSigned(
    row.dailyDelta
  )}`;
}

function renderMilestoneLine(line: DigestMilestoneLine): string {
  return `${rankLabel(line.rank)}. ${characterLabel(line)} | ${line.text} | score Δ ${formatSigned(line.dailyDelta)}`;
}

function withOverflowSuffix(lines: string[], limit: number): string[] {
  if (lines.length <= limit) return lines;
  const visible = lines.slice(0, limit);
  visible.push(`+${lines.length - limit} more`);
  return visible;
}

function pushSection(target: string[], title: string, lines: string[]) {
  if (lines.length === 0) return;
  target.push(title);
  target.push(...lines);
}

function truncateMessage(text: string, maxLength = MAX_MESSAGE_LENGTH): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, Math.max(0, maxLength - 3));
  const newlineIndex = slice.lastIndexOf("\n");
  if (newlineIndex > maxLength * 0.6) {
    return `${slice.slice(0, newlineIndex)}...`;
  }
  return `${slice}...`;
}

export function formatTelegramDigest(data: DigestData, leagueName: string): string {
  const lines: string[] = [];

  lines.push(leagueName);
  lines.push(`Snapshot: ${formatUtcDate(data.snapshotDate)}`);

  const pollParts = [`Poll: ${data.pollSummary.status}`];
  if (typeof data.pollSummary.warningCount === "number") {
    pollParts.push(`warnings=${data.pollSummary.warningCount}`);
  }
  if (typeof data.pollSummary.errorCount === "number") {
    pollParts.push(`errors=${data.pollSummary.errorCount}`);
  }
  lines.push(pollParts.join(" | "));

  if (data.variant === "poll_failure") {
    lines.push("");
    lines.push("Failure Summary");
    lines.push(data.failureMessage);
    return truncateMessage(lines.join("\n"));
  }

  lines.push(`Score Profile: ${data.scoreProfile.name} v${data.scoreProfile.version}`);

  const sectionLines: string[] = [];
  sectionLines.push(...withOverflowSuffix(data.rows.map(renderLeaderboardRow), TOP_ROWS_LIMIT));

  lines.push("");
  pushSection(lines, "Top Leaderboard", sectionLines.length > 0 ? sectionLines : ["No leaderboard rows found."]);

  const movers = withOverflowSuffix(data.topMovers.map(renderLeaderboardRow), TOP_MOVERS_LIMIT);
  if (movers.length > 0) {
    lines.push("");
    pushSection(lines, "Top Movers", movers);
  }

  const milestones = withOverflowSuffix(data.milestones.map(renderMilestoneLine), MILESTONES_LIMIT);
  if (milestones.length > 0) {
    lines.push("");
    pushSection(lines, "Notable Milestones", milestones);
  }

  const warnings = withOverflowSuffix(data.warnings, WARNINGS_LIMIT);
  if (warnings.length > 0) {
    lines.push("");
    pushSection(lines, "Warnings", warnings);
  }

  return truncateMessage(lines.join("\n"));
}
