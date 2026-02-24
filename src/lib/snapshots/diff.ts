import type { MetricDelta, NormalizedCharacterMetrics } from "@/lib/types";

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function buildMetricDelta(
  previous: NormalizedCharacterMetrics | null,
  current: NormalizedCharacterMetrics
): MetricDelta {
  const base = previous ?? {
    ...current,
    level: 0,
    averageItemLevel: 0,
    achievementPoints: 0,
    statisticsCompositeValue: 0,
    completedQuestCount: 0,
    reputationProgressTotal: 0,
    encounterKillScore: 0,
    mythicPlusRunsCount: 0,
    mythicPlusBestRunLevel: 0,
    mythicPlusSeasonScore: 0
  };

  const deltas = {
    level: round(current.level - base.level),
    averageItemLevel: round(current.averageItemLevel - base.averageItemLevel),
    achievementPoints: round(current.achievementPoints - base.achievementPoints),
    statisticsCompositeValue: round(current.statisticsCompositeValue - base.statisticsCompositeValue),
    completedQuestCount: round(current.completedQuestCount - base.completedQuestCount),
    reputationProgressTotal: round(current.reputationProgressTotal - base.reputationProgressTotal),
    encounterKillScore: round(current.encounterKillScore - base.encounterKillScore),
    mythicPlusRunsCount: round(current.mythicPlusRunsCount - base.mythicPlusRunsCount),
    mythicPlusBestRunLevel: round(current.mythicPlusBestRunLevel - base.mythicPlusBestRunLevel),
    mythicPlusSeasonScore: round(current.mythicPlusSeasonScore - base.mythicPlusSeasonScore)
  };

  const milestones: string[] = [];
  if (deltas.level > 0) milestones.push(`Level +${deltas.level}`);
  if (deltas.averageItemLevel >= 5) milestones.push(`Item level +${deltas.averageItemLevel.toFixed(1)}`);
  if (deltas.completedQuestCount >= 10) milestones.push(`Completed quests +${deltas.completedQuestCount}`);
  if (deltas.reputationProgressTotal >= 1000)
    milestones.push(`Reputation progress +${Math.round(deltas.reputationProgressTotal)}`);
  if (deltas.encounterKillScore >= 1) milestones.push(`Encounter progress +${deltas.encounterKillScore}`);
  if (deltas.mythicPlusBestRunLevel >= 1)
    milestones.push(`Mythic+ best key +${deltas.mythicPlusBestRunLevel}`);
  if (deltas.mythicPlusSeasonScore >= 50)
    milestones.push(`Mythic+ rating +${Math.round(deltas.mythicPlusSeasonScore)}`);
  if (deltas.achievementPoints >= 5) milestones.push(`Achievement points +${deltas.achievementPoints}`);

  return {
    fromFetchedAt: previous?.fetchedAt,
    toFetchedAt: current.fetchedAt,
    deltas,
    milestones
  };
}

