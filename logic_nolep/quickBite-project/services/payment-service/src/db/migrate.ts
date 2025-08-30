import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as dotenv from 'dotenv';
import postgres from 'postgres';
dotenv.config();

const runMigration = async () => {
   const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
   const db = drizzle(sql);

   console.log('Running migrations...');
   await migrate(db, { migrationsFolder: './src/migrations' });

   await sql.end();
   console.log('Migration completed');
}

runMigration().catch(console.error);