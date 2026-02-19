import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/drizzle-schema.ts',
  out: './drizzle/migrations',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.NEON_DATABASE_URL || 'postgresql://neondb_owner:npg_wmEJX7uUcHp3@ep-steep-waterfall-a7j76g5z.ap-southeast-2.aws.neon.tech/neondb?sslmode=require',
  },
});

