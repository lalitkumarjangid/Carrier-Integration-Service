
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const ConfigSchema = z.object({
  ups: z.object({
    clientId: z.string().min(1, 'UPS_CLIENT_ID is required'),
    clientSecret: z.string().min(1, 'UPS_CLIENT_SECRET is required'),
    accountNumber: z.string().min(1, 'UPS_ACCOUNT_NUMBER is required'),
    baseUrl: z.string().url().default('https://onlinetools.ups.com'),
    ratingApiVersion: z.string().default('v2409'),
  }),
  http: z.object({
    timeout: z.number().int().positive().default(10_000),
  }),
  transactionSource: z.string().default('CybershipCIS'),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

/**
 * Build configuration from environment variables.
 * Throws a descriptive error if required variables are missing.
 */
export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const raw = {
    ups: {
      clientId: env.UPS_CLIENT_ID ?? '',
      clientSecret: env.UPS_CLIENT_SECRET ?? '',
      accountNumber: env.UPS_ACCOUNT_NUMBER ?? '',
      baseUrl: env.UPS_BASE_URL ?? 'https://onlinetools.ups.com',
      ratingApiVersion: env.UPS_RATING_API_VERSION ?? 'v2409',
    },
    http: {
      timeout: Number(env.HTTP_TIMEOUT ?? 10_000),
    },
    transactionSource: env.TRANSACTION_SOURCE ?? 'CybershipCIS',
    logLevel: env.LOG_LEVEL ?? 'info',
  };

  return ConfigSchema.parse(raw);
}
