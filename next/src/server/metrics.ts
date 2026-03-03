import type {
  MetricDelta,
  NormalizedCharacterMetrics,
  RawCharacterProgressBundle,
  ScoreBreakdown,
  ScoreProfileConfig,
  TrackedCharacterConfig
} from "@/server/types";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizedPercent(value: number, cap: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(cap) || cap <= 0) {
    return 0;
  }
  return clamp((value / cap) * 100, 0, 100);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function deepCollectNumbers(value: unknown): number[] {
  if (typeof value === "number" && Number.isFinite(value)) {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => deepCollectNumbers(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((child) => deepCollectNumbers(child));
  }
  return [];
}

function extractCompletedQuestCount(questsPayload: unknown): number {
  const q = asRecord(questsPayload);
  if (!q) return 0;
  return (
    num(q.total_quests) ??
    num(q.completed_quests) ??
    num(q.total_completed) ??
    asArray(q.quests).length ??
    0
  );
}

function extractAverageItemLevel(equipmentPayload: unknown): number {
  const eq = asRecord(equipmentPayload);
  if (!eq) return 0;
  const averageItemLevelObj = asRecord(eq.average_item_level) ?? asRecord(eq.averageItemLevel);
  const equippedItemLevelObj = asRecord(eq.equipped_item_level) ?? asRecord(eq.equippedItemLevel);
  const direct =
    num(eq.average_item_level) ??
    num(eq.equipped_item_level) ??
    num(eq.averageItemLevel) ??
    num(eq.equippedItemLevel) ??
    num(averageItemLevelObj?.value) ??
    num(equippedItemLevelObj?.value);
  if (direct) return direct;

  const primaryItems = asArray(eq.equipped_items);
  const items = primaryItems.length > 0 ? primaryItems : asArray(eq.equippedItems);
  if (items.length === 0) return 0;

  let total = 0;
  let count = 0;
  for (const item of items) {
    const itemRecord = asRecord(item);
    const levelRecord = asRecord(itemRecord?.level) ?? asRecord(itemRecord?.item_level);
    const level =
      num(itemRecord?.level) ??
      num(itemRecord?.item_level) ??
      num(levelRecord?.value) ??
      num(asRecord(levelRecord?.display_string)?.value);
    if (level !== undefined) {
      total += level;
      count += 1;
    }
  }
  return count > 0 ? total / count : 0;
}

function extractAchievementPoints(achievementsPayload: unknown): number {
  const a = asRecord(achievementsPayload);
  if (!a) return 0;
  return num(a.total_points) ?? num(a.totalPoints) ?? num(a.points) ?? 0;
}

function extractStatisticsComposite(statisticsPayload: unknown, statisticIds: number[]): number {
  if (!statisticsPayload) return 0;
  if (statisticIds.length === 0) {
    const numbers = deepCollectNumbers(statisticsPayload);
    return numbers.slice(0, 200).reduce((sum, value) => sum + Math.max(0, value), 0);
  }

  let total = 0;
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = asRecord(node);
    if (!record) return;

    const id = num(record.id);
    if (id !== undefined && statisticIds.includes(id)) {
      total += num(record.quantity) ?? num(record.value) ?? 0;
    }
    for (const child of Object.values(record)) {
      walk(child);
    }
  };
  walk(statisticsPayload);
  return total;
}

function extractReputationMetrics(reputationsPayload: unknown, scoreProfile: ScoreProfileConfig) {
  const rep = asRecord(reputationsPayload);
  const reputations = asArray(rep?.reputations);
  const allowedFactions = new Set(scoreProfile.filters.factionIds);

  const breakdown: NormalizedCharacterMetrics["reputationBreakdown"] = [];
  for (const entry of reputations) {
    const record = asRecord(entry);
    const faction = asRecord(record?.faction);
    const standing = asRecord(record?.standing);
    const factionId = num(faction?.id);

    if (allowedFactions.size > 0 && factionId !== undefined && !allowedFactions.has(factionId)) {
      continue;
    }

    const rawValue =
      num(standing?.raw) ??
      num(standing?.value) ??
      num(record?.raw) ??
      num(record?.value) ??
      0;
    const maxValue = num(standing?.max) ?? num(standing?.max_value) ?? num(record?.max) ?? 0;
    const progress =
      maxValue > 0 ? Math.max(0, Math.min(maxValue, rawValue)) : Math.max(0, rawValue);

    breakdown.push({
      factionId: factionId ?? undefined,
      name: typeof faction?.name === "string" ? faction.name : undefined,
      progress,
      rawValue: rawValue || undefined,
      maxValue: maxValue || undefined
    });
  }

  return {
    breakdown,
    total: breakdown.reduce((sum, item) => sum + item.progress, 0)
  };
}

function extractEncounterMetrics(encountersPayload: unknown, scoreProfile: ScoreProfileConfig) {
  const encounters = asRecord(encountersPayload);
  const allowedEncounterIds = new Set(scoreProfile.filters.encounterIds);
  const encounterIdsCompleted = new Set<number>();
  let encounterKillScore = 0;

  const visit = (node: unknown, depth = 0) => {
    if (depth > 8) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child, depth + 1);
      return;
    }
    const record = asRecord(node);
    if (!record) return;

    const encounter = asRecord(record.encounter);
    const encounterId = num(record.id) ?? num(encounter?.id);
    const completedCount =
      num(record.completed_count) ??
      num(record.completedCount) ??
      num(record.count) ??
      num(record.kills) ??
      num(record.total_count);
    const lastKilledTimestamp = record.last_kill_timestamp ?? record.lastKillTimestamp;
    const hasKillSignal = completedCount !== undefined || lastKilledTimestamp !== undefined;

    if (encounterId !== undefined && hasKillSignal) {
      if (allowedEncounterIds.size === 0 || allowedEncounterIds.has(encounterId)) {
        encounterIdsCompleted.add(encounterId);
        encounterKillScore += Math.max(1, completedCount ?? 1);
      }
    }

    for (const child of Object.values(record)) {
      if (typeof child === "object" && child !== null) {
        visit(child, depth + 1);
      }
    }
  };

  visit(encounters);
  return {
    encounterKillScore,
    encounterIdsCompleted: [...encounterIdsCompleted]
  };
}

function extractMythicPlusMetrics(mythicProfilePayload: unknown, mythicSeasonPayload: unknown) {
  const combined = [mythicProfilePayload, mythicSeasonPayload].filter(Boolean);
  let bestRunLevel = 0;
  let runsCount = 0;
  let seasonScore = 0;

  for (const payload of combined) {
    const record = asRecord(payload);
    if (!record) continue;

    const currentRating = asRecord(record.current_mythic_rating);
    seasonScore = Math.max(
      seasonScore,
      num(currentRating?.rating) ??
        num(record.current_mythic_rating_rating) ??
        num(record.mythic_rating) ??
        0
    );

    const allRuns = [
      ...asArray(record.best_runs),
      ...asArray(record.current_period_best_runs),
      ...asArray(record.season_best_runs),
      ...asArray(record.best_keystone_runs)
    ];
    runsCount += allRuns.length;

    for (const run of allRuns) {
      const runRecord = asRecord(run);
      bestRunLevel = Math.max(bestRunLevel, num(runRecord?.keystone_level) ?? num(runRecord?.level) ?? 0);
    }
  }

  return { bestRunLevel, runsCount, seasonScore };
}

function extractCharacterLevel(profileSummary: unknown): number {
  const p = asRecord(profileSummary);
  if (!p) return 0;
  return num(p.level) ?? num(p.character_level) ?? num(p.effective_level) ?? 0;
}

function round(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function normalizeCharacterProgressBundle(
  bundle: RawCharacterProgressBundle,
  character: TrackedCharacterConfig,
  scoreProfile: ScoreProfileConfig
): NormalizedCharacterMetrics {
  const warnings = Object.values(bundle.endpointErrors).filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  const reputation = extractReputationMetrics(bundle.reputationsSummary, scoreProfile);
  const encounters = extractEncounterMetrics(bundle.encountersSummary, scoreProfile);
  const mythicPlus = extractMythicPlusMetrics(bundle.mythicKeystoneProfile, bundle.mythicKeystoneSeason);

  return {
    schemaVersion: 1,
    fetchedAt: bundle.fetchedAt,
    region: character.region,
    realmSlug: character.realmSlug,
    characterName: character.characterName,
    level: extractCharacterLevel(bundle.profileSummary),
    averageItemLevel: extractAverageItemLevel(bundle.equipmentSummary),
    achievementPoints: extractAchievementPoints(bundle.achievementsSummary),
    statisticsCompositeValue: extractStatisticsComposite(
      bundle.statisticsSummary,
      scoreProfile.filters.statisticIds
    ),
    completedQuestCount: extractCompletedQuestCount(bundle.questsCompleted),
    reputationProgressTotal: reputation.total,
    reputationBreakdown: reputation.breakdown,
    encounterKillScore: encounters.encounterKillScore,
    encounterIdsCompleted: encounters.encounterIdsCompleted,
    mythicPlusRunsCount: mythicPlus.runsCount,
    mythicPlusBestRunLevel: mythicPlus.bestRunLevel,
    mythicPlusSeasonScore: mythicPlus.seasonScore,
    warnings
  };
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
