import type { ScoreProfileConfig } from "@/lib/types";

export const DEFAULT_SCORE_PROFILE: ScoreProfileConfig = {
  name: "Midnight Default",
  version: 2,
  weights: {
    level: 40,
    itemLevel: 30,
    mythicPlusRating: 20,
    bestKey: 10,
    quests: 0,
    reputations: 0,
    encounters: 0,
    achievementsStatistics: 0
  },
  normalizationCaps: {
    level: 90,
    completedQuestCount: 1500,
    reputationProgressTotal: 250000,
    averageItemLevel: 700,
    encounterKillScore: 500,
    mythicPlusSeasonScore: 4000,
    mythicPlusBestRunLevel: 20,
    achievementPoints: 45000,
    statisticsCompositeValue: 25000
  },
  filters: {
    questIds: [],
    factionIds: [],
    encounterIds: [],
    mythicSeasonIds: [],
    statisticIds: []
  }
};
