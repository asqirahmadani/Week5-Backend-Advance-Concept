import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

export default {
    dialect: 'postgresql',
    schema: './src/db/schema/*',
    out: './src/db/migrations',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    verbose: true
} satisfies Config;