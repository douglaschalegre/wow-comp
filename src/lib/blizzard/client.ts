import { Buffer } from "node:buffer";
import type { RegionCode } from "@/lib/types";
import { requireBlizzardCredentials } from "@/lib/env";

type NamespaceKind = "profile" | "dynamic" | "static";

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
  ) {
    return this.getJson<T>(region, "profile", pathName, options);
  }

  async dynamicJson<T>(
    region: RegionCode,
    pathName: string,
    options?: { locale?: string; query?: Record<string, string | number | undefined> }
  ) {
    return this.getJson<T>(region, "dynamic", pathName, options);
  }
}

export function isBlizzardNotFound(error: unknown): boolean {
  return error instanceof BlizzardApiError && error.status === 404;
}

