import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().optional(),
  BLIZZARD_CLIENT_ID: z.string().optional(),
  BLIZZARD_CLIENT_SECRET: z.string().optional(),
  LOCALE_DEFAULT: z.string().default("en_US"),
  APP_TIMEZONE: z.string().default("UTC")
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

