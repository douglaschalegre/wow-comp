import { z } from "zod";

const regionSchema = z.enum(["US", "EU"]);
const factionSchema = z.enum(["HORDE", "ALLIANCE"]);

export const trackedCharacterConfigSchema = z.object({
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

export const trackedCharactersConfigFileSchema = z
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

export const scoreProfileConfigSchema = z.object({
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
    // Accept both canonical internal keys and compact config aliases.
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

export type TrackedCharacterConfigParsed = z.infer<typeof trackedCharacterConfigSchema>;
export type TrackedCharactersConfigFileParsed = z.infer<typeof trackedCharactersConfigFileSchema>;
export type ScoreProfileConfigParsed = z.infer<typeof scoreProfileConfigSchema>;
