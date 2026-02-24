import type { RawCharacterProgressBundle, ScoreProfileConfig, TrackedCharacterConfig } from "@/lib/types";
import { BlizzardClient, isBlizzardNotFound } from "@/lib/blizzard/client";

type EndpointFetcher = () => Promise<unknown>;

async function runOptionalEndpoint(
  endpointName: string,
  fetcher: EndpointFetcher
): Promise<{ data?: unknown; error?: string }> {
  try {
    const data = await fetcher();
    return { data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: `${endpointName}: ${message}` };
  }
}

function characterPath(character: TrackedCharacterConfig, suffix = "") {
  const realm = encodeURIComponent(character.realmSlug.toLowerCase());
  const name = encodeURIComponent(character.characterName.toLowerCase());
  return `/profile/wow/character/${realm}/${name}${suffix}`;
}

async function fetchCompletedQuestsWithFallback(
  client: BlizzardClient,
  character: TrackedCharacterConfig
) {
  try {
    return await client.profileJson(character.region, characterPath(character, "/quests/completed"));
  } catch (error) {
    if (!isBlizzardNotFound(error)) {
      throw error;
    }
    return client.profileJson(character.region, characterPath(character, "/quests"));
  }
}

async function fetchMythicSeasonIfConfigured(
  client: BlizzardClient,
  character: TrackedCharacterConfig,
  scoreProfile: ScoreProfileConfig
) {
  const seasonId = scoreProfile.filters.mythicSeasonIds[0];
  if (!seasonId) {
    return undefined;
  }
  return client.profileJson(character.region, characterPath(character, `/mythic-keystone-profile/season/${seasonId}`));
}

export async function fetchCharacterProgressBundle(
  client: BlizzardClient,
  character: TrackedCharacterConfig,
  scoreProfile: ScoreProfileConfig
): Promise<RawCharacterProgressBundle> {
  const [
    profileSummary,
    characterMedia,
    equipmentSummary,
    achievementsSummary,
    statisticsSummary,
    reputationsSummary,
    questsCompleted,
    encountersSummary,
    mythicKeystoneProfile,
    mythicKeystoneSeason
  ] = await Promise.all([
    runOptionalEndpoint("profileSummary", () => client.profileJson(character.region, characterPath(character))),
    runOptionalEndpoint("characterMedia", () =>
      client.profileJson(character.region, characterPath(character, "/character-media"))
    ),
    runOptionalEndpoint("equipmentSummary", () =>
      client.profileJson(character.region, characterPath(character, "/equipment"))
    ),
    runOptionalEndpoint("achievementsSummary", () =>
      client.profileJson(character.region, characterPath(character, "/achievements"))
    ),
    runOptionalEndpoint("statisticsSummary", () =>
      client.profileJson(character.region, characterPath(character, "/statistics"))
    ),
    runOptionalEndpoint("reputationsSummary", () =>
      client.profileJson(character.region, characterPath(character, "/reputations"))
    ),
    runOptionalEndpoint("questsCompleted", () => fetchCompletedQuestsWithFallback(client, character)),
    runOptionalEndpoint("encountersSummary", () =>
      client.profileJson(character.region, characterPath(character, "/encounters"))
    ),
    runOptionalEndpoint("mythicKeystoneProfile", () =>
      client.profileJson(character.region, characterPath(character, "/mythic-keystone-profile"))
    ),
    runOptionalEndpoint("mythicKeystoneSeason", () => fetchMythicSeasonIfConfigured(client, character, scoreProfile))
  ]);

  const endpointErrors: RawCharacterProgressBundle["endpointErrors"] = {};
  for (const [name, result] of Object.entries({
    profileSummary,
    characterMedia,
    equipmentSummary,
    achievementsSummary,
    statisticsSummary,
    reputationsSummary,
    questsCompleted,
    encountersSummary,
    mythicKeystoneProfile,
    mythicKeystoneSeason
  })) {
    if (result.error) {
      endpointErrors[name] = result.error;
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    profileSummary: profileSummary.data,
    characterMedia: characterMedia.data,
    equipmentSummary: equipmentSummary.data,
    achievementsSummary: achievementsSummary.data,
    statisticsSummary: statisticsSummary.data,
    reputationsSummary: reputationsSummary.data,
    questsCompleted: questsCompleted.data,
    encountersSummary: encountersSummary.data,
    mythicKeystoneProfile: mythicKeystoneProfile.data,
    mythicKeystoneSeason: mythicKeystoneSeason.data,
    endpointErrors
  };
}
