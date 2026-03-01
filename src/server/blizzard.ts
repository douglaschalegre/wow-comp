import { Buffer } from "node:buffer";
import type { RawCharacterProgressBundle, RegionCode, ScoreProfileConfig, TrackedCharacterConfig } from "@/server/types";
import { requireBlizzardCredentials } from "@/server/env";

type NamespaceKind = "profile" | "dynamic" | "static";

type EndpointFetcher = () => Promise<unknown>;

interface OAuthToken {
  accessToken: string;
  expiresAt: number;
}

const tokenCache = new Map<string, OAuthToken>();

export class BlizzardApiError extends Error {
  status: number;
  body?: string;

  constructor(message: string, status: number, body?: string) {
    super(message);
    this.name = "BlizzardApiError";
    this.status = status;
    this.body = body;
  }
}

function regionHost(region: RegionCode): string {
  const normalized = region.toLowerCase();
  return `https://${normalized}.api.blizzard.com`;
}

async function getAccessToken(): Promise<string> {
  const creds = requireBlizzardCredentials();
  const cacheKey = `${creds.clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.accessToken;
  }

  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const response = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new BlizzardApiError("Failed to get Blizzard OAuth token", response.status, body);
  }

  const payload = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache.set(cacheKey, {
    accessToken: payload.access_token,
    expiresAt: Date.now() + payload.expires_in * 1000
  });

  return payload.access_token;
}

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

function characterPath(character: TrackedCharacterConfig, suffix = ""): string {
  const realm = encodeURIComponent(character.realmSlug.toLowerCase());
  const name = encodeURIComponent(character.characterName.toLowerCase());
  return `/profile/wow/character/${realm}/${name}${suffix}`;
}

async function fetchCompletedQuestsWithFallback(
  client: BlizzardClient,
  character: TrackedCharacterConfig
): Promise<unknown> {
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
): Promise<unknown> {
  const seasonId = scoreProfile.filters.mythicSeasonIds[0];
  if (!seasonId) {
    return undefined;
  }
  return client.profileJson(character.region, characterPath(character, `/mythic-keystone-profile/season/${seasonId}`));
}

export class BlizzardClient {
  constructor(private readonly locale = process.env.LOCALE_DEFAULT || "en_US") {}

  async getJson<T>(
    region: RegionCode,
    namespaceKind: NamespaceKind,
    pathName: string,
    options?: { locale?: string; query?: Record<string, string | number | undefined> }
  ): Promise<T> {
    const token = await getAccessToken();
    const url = new URL(`${regionHost(region)}${pathName}`);
    url.searchParams.set("namespace", `${namespaceKind}-${region.toLowerCase()}`);
    url.searchParams.set("locale", options?.locale ?? this.locale);

    for (const [key, value] of Object.entries(options?.query ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new BlizzardApiError(
        `Blizzard API request failed (${response.status}) for ${pathName}`,
        response.status,
        body
      );
    }

    return (await response.json()) as T;
  }

  async profileJson<T>(
    region: RegionCode,
    pathName: string,
    options?: { locale?: string; query?: Record<string, string | number | undefined> }
  ): Promise<T> {
    return this.getJson<T>(region, "profile", pathName, options);
  }
}

export function isBlizzardNotFound(error: unknown): boolean {
  return error instanceof BlizzardApiError && error.status === 404;
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
