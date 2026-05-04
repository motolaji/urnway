import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });
config();

const sanitizeEnvValue = (value: string) => {
  const prefixes = ['DATABASE_URL=', 'REDIS_URL='];
  let next = value.trim();
  let changed = true;

  while (changed) {
    changed = false;

    for (const prefix of prefixes) {
      if (next.startsWith(prefix)) {
        next = next.slice(prefix.length).trim();
        changed = true;
      }
    }
  }

  return next;
};

const databaseUrl = sanitizeEnvValue(process.env.DATABASE_URL ?? '');

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run Drizzle commands');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
