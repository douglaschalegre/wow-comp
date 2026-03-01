import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ScoreProfileConfig, TrackedCharactersConfigFile } from "@/server/types";

const regionSchema = z.enum(["US", "EU"]);
const factionSchema = z.enum(["HORDE", "ALLIANCE"]);

const trackedCharacterConfigSchema = z.object({
  region: regionSchema,
  realmSlug: z
    .string()
    .min(1)
    .transform((value) => value.trim().toLowerCase()),
  characterName: z
    .string()
    .min(1)
    .transform((value) => value.trim()),
  faction: factionSchema,
  active: z.boolean().optional().default(true),
  notes: z.string().trim().max(500).optional()
});

const trackedCharactersConfigFileSchema = z
  .object({
    version: z.number().int().positive().default(1),
    characters: z.array(trackedCharacterConfigSchema)
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.characters.forEach((character, index) => {
      const key = `${character.region}:${character.realmSlug}:${character.characterName.toLowerCase()}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["characters", index],
          message: `Duplicate tracked character entry: ${key}`
        });
      }
      seen.add(key);
    });
  });

const scoreProfileConfigSchema = z.object({
  name: z.string().min(1),
  version: z.number().int().positive().default(1),
  weights: z.object({
    level: z.number().nonnegative().optional(),
    itemLevel: z.number().nonnegative().optional(),
    mythicPlusRating: z.number().nonnegative().optional(),
    bestKey: z.number().nonnegative().optional(),
    quests: z.number().nonnegative().optional(),
    reputations: z.number().nonnegative().optional(),
    encounters: z.number().nonnegative().optional(),
    achievementsStatistics: z.number().nonnegative().optional()
  }),
  normalizationCaps: z.object({
    level: z.number().positive().optional(),
    maxLevel: z.number().positive().optional(),
    completedQuestCount: z.number().positive().optional(),
    reputationProgressTotal: z.number().positive().optional(),
    averageItemLevel: z.number().positive().optional(),
    maxItemLevel: z.number().positive().optional(),
    encounterKillScore: z.number().positive().optional(),
    mythicPlusSeasonScore: z.number().positive().optional(),
    mythicPlusBestRunLevel: z.number().positive().optional(),
    achievementPoints: z.number().positive().optional(),
    statisticsCompositeValue: z.number().positive().optional()
  }),
  filters: z.object({
    questIds: z.array(z.number().int().nonnegative()).default([]),
    factionIds: z.array(z.number().int().nonnegative()).default([]),
    encounterIds: z.array(z.number().int().nonnegative()).default([]),
    mythicSeasonIds: z.array(z.number().int().nonnegative()).default([]),
    statisticIds: z.array(z.number().int().nonnegative()).default([])
  })
});

const DEFAULT_SCORE_PROFILE: ScoreProfileConfig = {
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
