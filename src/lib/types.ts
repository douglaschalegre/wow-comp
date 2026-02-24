export type RegionCode = "US" | "EU";
export type FactionCode = "HORDE" | "ALLIANCE";

export interface TrackedCharacterConfig {
  region: RegionCode;
  realmSlug: string;
  characterName: string;
  faction: FactionCode;
  active?: boolean;
  notes?: string;
}

export interface TrackedCharactersConfigFile {
  version: number;
  characters: TrackedCharacterConfig[];
}

export interface ScoreWeights {
  quests: number;
  reputations: number;
  itemLevel: number;
  encounters: number;
  mythicPlus: number;
  achievementsStatistics: number;
}

export interface ScoreNormalizationCaps {
  completedQuestCount: number;
  reputationProgressTotal: number;
  averageItemLevel: number;
  encounterKillScore: number;
  mythicPlusComposite: number;
  achievementPoints: number;
  statisticsCompositeValue: number;
}

export interface ScoreFilterConfig {
  questIds: number[];
  factionIds: number[];
  encounterIds: number[];
  mythicSeasonIds: number[];
  statisticIds: number[];
}

export interface ScoreProfileConfig {
  name: string;
  version: number;
  weights: ScoreWeights;
  normalizationCaps: ScoreNormalizationCaps;
  filters: ScoreFilterConfig;
}

export interface ReputationMetric {
  factionId?: number;
  name?: string;
  progress: number;
  rawValue?: number;
  maxValue?: number;
}

export interface NormalizedCharacterMetrics {
  schemaVersion: number;
  fetchedAt: string;
  region: RegionCode;
  realmSlug: string;
  characterName: string;
  level: number;
  averageItemLevel: number;
  achievementPoints: number;
  statisticsCompositeValue: number;
  completedQuestCount: number;
  reputationProgressTotal: number;
  reputationBreakdown: ReputationMetric[];
  encounterKillScore: number;
  encounterIdsCompleted: number[];
  mythicPlusRunsCount: number;
  mythicPlusBestRunLevel: number;
  mythicPlusSeasonScore: number;
  warnings: string[];
}

export interface MetricDelta {
  fromFetchedAt?: string;
  toFetchedAt: string;
  deltas: {
    level: number;
    averageItemLevel: number;
    achievementPoints: number;
    statisticsCompositeValue: number;
    completedQuestCount: number;
    reputationProgressTotal: number;
    encounterKillScore: number;
    mythicPlusRunsCount: number;
    mythicPlusBestRunLevel: number;
    mythicPlusSeasonScore: number;
  };
  milestones: string[];
}

export interface ScoreBreakdown {
  totalScore: number;
  totalWeight: number;
  normalizedCategories: {
    quests: number;
    reputations: number;
    itemLevel: number;
    encounters: number;
    mythicPlus: number;
    achievementsStatistics: number;
  };
  weightedContributions: {
    quests: number;
    reputations: number;
    itemLevel: number;
    encounters: number;
    mythicPlus: number;
    achievementsStatistics: number;
  };
  warnings: string[];
}

export interface RawCharacterProgressBundle {
  fetchedAt: string;
  profileSummary?: unknown;
  characterMedia?: unknown;
  equipmentSummary?: unknown;
  achievementsSummary?: unknown;
  statisticsSummary?: unknown;
  reputationsSummary?: unknown;
  questsCompleted?: unknown;
  encountersSummary?: unknown;
  mythicKeystoneProfile?: unknown;
  mythicKeystoneSeason?: unknown;
  endpointErrors: Partial<Record<string, string>>;
}

export interface PollCharacterResult {
  character: TrackedCharacterConfig;
  ok: boolean;
  snapshotId?: string;
  score?: number;
  warnings: string[];
  error?: string;
}

export interface PollJobResult {
  snapshotDate: string;
  processed: number;
  successCount: number;
  warningCount: number;
  errorCount: number;
  results: PollCharacterResult[];
}
