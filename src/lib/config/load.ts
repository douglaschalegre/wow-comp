import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ScoreProfileConfig, TrackedCharactersConfigFile } from "@/lib/types";
import { scoreProfileConfigSchema, trackedCharactersConfigFileSchema } from "@/lib/config/schemas";

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
  return parsed;
}

export function getConfigFilePath(fileName: string): string {
  return path.join(CONFIG_DIR, fileName);
}

