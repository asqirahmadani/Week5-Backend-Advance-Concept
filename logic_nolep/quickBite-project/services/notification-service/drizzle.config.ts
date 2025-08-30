import type { Config } from 'drizzle-kit'

export default {
    dialect: "postgresql",
    schema: './src/db/schema.ts',
    out: './src/migrations',
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
    verbose: true,
    strict: true
} satisfies Config