import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().optional(),
  BLIZZARD_CLIENT_ID: z.string().optional(),
  BLIZZARD_CLIENT_SECRET: z.string().optional(),
  LOCALE_DEFAULT: z.string().default("en_US"),
  APP_TIMEZONE: z.string().default("UTC"),
  TELEGRAM_ENABLED: z.string().default("false"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  TELEGRAM_LEAGUE_NAME: z.string().default("WoW Midnight League")
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(): ServerEnv {
  return serverEnvSchema.parse(process.env);
}

export function requireBlizzardCredentials() {
  const env = getServerEnv();
  if (!env.BLIZZARD_CLIENT_ID || !env.BLIZZARD_CLIENT_SECRET) {
    throw new Error(
      "Missing BLIZZARD_CLIENT_ID or BLIZZARD_CLIENT_SECRET. Set them in your environment before running polling jobs."
    );
  }
  return {
    clientId: env.BLIZZARD_CLIENT_ID,
    clientSecret: env.BLIZZARD_CLIENT_SECRET
  };
}

function isTruthyEnv(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export interface TelegramDigestConfig {
  enabled: boolean;
  botToken?: string;
  chatId?: string;
  leagueName: string;
}

export function getTelegramDigestConfig(): TelegramDigestConfig {
  const env = getServerEnv();

  return {
    enabled: isTruthyEnv(env.TELEGRAM_ENABLED),
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    leagueName: env.TELEGRAM_LEAGUE_NAME
  };
}

export function requireTelegramDigestSendConfig() {
  const config = getTelegramDigestConfig();

  if (!config.enabled) {
    throw new Error(
      "Telegram digest sending is disabled. Set TELEGRAM_ENABLED=true to run the digest job in send mode."
    );
  }

  if (!config.botToken || !config.chatId) {
    throw new Error(
      "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID. Set both env vars before running the digest job in send mode."
    );
  }

  return {
    botToken: config.botToken,
    chatId: config.chatId,
    leagueName: config.leagueName
  };
}
