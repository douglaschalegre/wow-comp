import type { NormalizedCharacterMetrics, ScoreBreakdown, ScoreProfileConfig } from "@/lib/types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizedPercent(value: number, cap: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(cap) || cap <= 0) {
    return 0;
  }
  return clamp((value / cap) * 100, 0, 100);
}

export function scoreCharacter(
  metrics: NormalizedCharacterMetrics,
  scoreProfile: ScoreProfileConfig
): ScoreBreakdown {
  const warnings = [...metrics.warnings];
  const caps = scoreProfile.normalizationCaps;
  const weights = scoreProfile.weights;

  const achievementsPct = normalizedPercent(metrics.achievementPoints, caps.achievementPoints);
  const statsPct = normalizedPercent(metrics.statisticsCompositeValue, caps.statisticsCompositeValue);

  const normalizedCategories = {
    quests: normalizedPercent(metrics.completedQuestCount, caps.completedQuestCount),
    reputations: normalizedPercent(metrics.reputationProgressTotal, caps.reputationProgressTotal),
    itemLevel: normalizedPercent(metrics.averageItemLevel, caps.averageItemLevel),
    encounters: normalizedPercent(metrics.encounterKillScore, caps.encounterKillScore),
    mythicPlus: normalizedPercent(
      metrics.mythicPlusSeasonScore || metrics.mythicPlusBestRunLevel * 200 + metrics.mythicPlusRunsCount * 20,
      caps.mythicPlusComposite
    ),
    achievementsStatistics: clamp((achievementsPct + statsPct) / 2, 0, 100)
  };

  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) {
    warnings.push("Score profile total weight is zero. Returning zero score.");
  }

  const weightedContributions = {
    quests: (normalizedCategories.quests / 100) * weights.quests,
    reputations: (normalizedCategories.reputations / 100) * weights.reputations,
    itemLevel: (normalizedCategories.itemLevel / 100) * weights.itemLevel,
    encounters: (normalizedCategories.encounters / 100) * weights.encounters,
    mythicPlus: (normalizedCategories.mythicPlus / 100) * weights.mythicPlus,
    achievementsStatistics:
      (normalizedCategories.achievementsStatistics / 100) * weights.achievementsStatistics
  };

  const weightedTotal = Object.values(weightedContributions).reduce((sum, value) => sum + value, 0);
  const totalScore = totalWeight > 0 ? Number(((weightedTotal / totalWeight) * 100).toFixed(2)) : 0;

  return {
    totalScore,
    totalWeight,
    normalizedCategories,
    weightedContributions,
    warnings
  };
}
