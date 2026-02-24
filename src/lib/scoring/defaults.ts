import type { ScoreProfileConfig } from "@/lib/types";

export const DEFAULT_SCORE_PROFILE: ScoreProfileConfig = {
  name: "Midnight Default",
  version: 1,
  weights: {
    quests: 30,
    reputations: 25,
    itemLevel: 15,
    encounters: 15,
    mythicPlus: 10,
    achievementsStatistics: 5
  },
  normalizationCaps: {
    completedQuestCount: 1500,
    reputationProgressTotal: 250000,
    averageItemLevel: 700,
    encounterKillScore: 500,
    mythicPlusComposite: 6000,
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

