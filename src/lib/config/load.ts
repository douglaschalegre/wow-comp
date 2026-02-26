import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ScoreProfileConfig, TrackedCharactersConfigFile } from "@/lib/types";
import { scoreProfileConfigSchema, trackedCharactersConfigFileSchema } from "@/lib/config/schemas";
import { DEFAULT_SCORE_PROFILE } from "@/lib/scoring/defaults";

const CONFIG_DIR = path.join(process.cwd(), "config");

async function readJsonFile(fileName: string): Promise<unknown> {
  const fullPath = path.join(CONFIG_DIR, fileName);
  const contents = await readFile(fullPath, "utf8");
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Invalid JSON in ${fullPath}: ${(error as Error).message}`);
  }
}

export async function loadTrackedCharactersConfig(): Promise<TrackedCharactersConfigFile> {
  const parsed = trackedCharactersConfigFileSchema.parse(await readJsonFile("tracked-characters.json"));
  return {
    version: parsed.version,
    characters: parsed.characters.map((character) => ({
      ...character,
      realmSlug: character.realmSlug.toLowerCase(),
      characterName: character.characterName.trim()
    }))
  };
}

export async function loadScoreProfileConfig(): Promise<ScoreProfileConfig> {
  const parsed = scoreProfileConfigSchema.parse(await readJsonFile("score-profile.json"));
  const defaultProfile = DEFAULT_SCORE_PROFILE;
  const caps = parsed.normalizationCaps;

  return {
    name: parsed.name,
    version: parsed.version,
    weights: {
      ...defaultProfile.weights,
      ...parsed.weights
    },
    normalizationCaps: {
      ...defaultProfile.normalizationCaps,
      level: caps.level ?? caps.maxLevel ?? defaultProfile.normalizationCaps.level,
      completedQuestCount:
        caps.completedQuestCount ?? defaultProfile.normalizationCaps.completedQuestCount,
      reputationProgressTotal:
        caps.reputationProgressTotal ?? defaultProfile.normalizationCaps.reputationProgressTotal,
      averageItemLevel:
        caps.averageItemLevel ?? caps.maxItemLevel ?? defaultProfile.normalizationCaps.averageItemLevel,
      encounterKillScore: caps.encounterKillScore ?? defaultProfile.normalizationCaps.encounterKillScore,
      mythicPlusSeasonScore:
        caps.mythicPlusSeasonScore ?? defaultProfile.normalizationCaps.mythicPlusSeasonScore,
      mythicPlusBestRunLevel:
        caps.mythicPlusBestRunLevel ?? defaultProfile.normalizationCaps.mythicPlusBestRunLevel,
      achievementPoints: caps.achievementPoints ?? defaultProfile.normalizationCaps.achievementPoints,
      statisticsCompositeValue:
        caps.statisticsCompositeValue ?? defaultProfile.normalizationCaps.statisticsCompositeValue
    },
    filters: {
      ...defaultProfile.filters,
      ...parsed.filters
    }
  };
}

export function getConfigFilePath(fileName: string): string {
  return path.join(CONFIG_DIR, fileName);
}
