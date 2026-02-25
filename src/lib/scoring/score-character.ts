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
    level: normalizedPercent(metrics.level, caps.level),
    itemLevel: normalizedPercent(metrics.averageItemLevel, caps.averageItemLevel),
    mythicPlusRating: normalizedPercent(metrics.mythicPlusSeasonScore, caps.mythicPlusSeasonScore),
    bestKey: normalizedPercent(metrics.mythicPlusBestRunLevel, caps.mythicPlusBestRunLevel),
    quests: normalizedPercent(metrics.completedQuestCount, caps.completedQuestCount),
    reputations: normalizedPercent(metrics.reputationProgressTotal, caps.reputationProgressTotal),
    encounters: normalizedPercent(metrics.encounterKillScore, caps.encounterKillScore),
    achievementsStatistics: clamp((achievementsPct + statsPct) / 2, 0, 100)
  };

  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) {
    warnings.push("Score profile total weight is zero. Returning zero score.");
  }

  const weightedContributions = {
    level: (normalizedCategories.level / 100) * weights.level,
    itemLevel: (normalizedCategories.itemLevel / 100) * weights.itemLevel,
    mythicPlusRating: (normalizedCategories.mythicPlusRating / 100) * weights.mythicPlusRating,
    bestKey: (normalizedCategories.bestKey / 100) * weights.bestKey,
    quests: (normalizedCategories.quests / 100) * weights.quests,
    reputations: (normalizedCategories.reputations / 100) * weights.reputations,
    encounters: (normalizedCategories.encounters / 100) * weights.encounters,
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
