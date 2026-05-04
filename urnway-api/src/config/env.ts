import { config } from 'dotenv';
import { z } from 'zod';

config({ path: '.env.local' });
config();

const developmentCorsOrigins = [
  'http://localhost:3000',
  'http://localhost:8081',
];

function sanitizeEnvValue(key: string, value: string | undefined) {
  if (!value) {
    return value;
  }

  const trimmed = value.trim().replace(/^['"]|['"]$/g, '');

  if (trimmed.startsWith(`${key}=`)) {
    return trimmed.slice(key.length + 1);
  }

  return trimmed;
}

function parseCorsOrigins(value: string | undefined, nodeEnv: string) {
  const origins = (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnv !== 'development') {
    return origins;
  }

  return Array.from(new Set([...developmentCorsOrigins, ...origins]));
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  MEZO_RPC_URL: z.string().url(),
  MEZO_CHAIN_ID: z.coerce.number().default(31611),
  MUSD_TOKEN_ADDRESS: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default('gpt-4.1-mini'),
  CORS_ORIGINS: z.array(z.string().min(1)).min(1),
});

export const env = envSchema.parse({
  ...process.env,
  DATABASE_URL: sanitizeEnvValue('DATABASE_URL', process.env.DATABASE_URL),
  REDIS_URL: sanitizeEnvValue('REDIS_URL', process.env.REDIS_URL),
  MUSD_TOKEN_ADDRESS: sanitizeEnvValue(
    'MUSD_TOKEN_ADDRESS',
    process.env.MUSD_TOKEN_ADDRESS
  ),
  OPENAI_API_KEY: sanitizeEnvValue('OPENAI_API_KEY', process.env.OPENAI_API_KEY),
  OPENAI_MODEL: sanitizeEnvValue('OPENAI_MODEL', process.env.OPENAI_MODEL),
  CORS_ORIGINS: parseCorsOrigins(
    sanitizeEnvValue(
      'CORS_ORIGINS',
      process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN
    ),
    process.env.NODE_ENV ?? 'development'
  ),
});
