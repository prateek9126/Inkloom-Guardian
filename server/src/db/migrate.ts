import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  console.log('[Migration] Checking database schema...');
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Split SQL commands cleanly by semicolons while respecting quotes/blocks if needed
  // Or execute as a single script
  try {
    await db.query(schemaSql);
    console.log('[Migration] Schema migration completed successfully.');
  } catch (err: any) {
    // If multiple statements in single query failed, split and run sequentially
    console.warn('[Migration] Batch execution notice, executing statement by statement...');
    const statements = schemaSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await db.query(statement);
      } catch (stmtError: any) {
        console.error(`[Migration Error] Failed on statement: ${statement.substring(0, 60)}...`);
        console.error(stmtError.message);
        throw stmtError;
      }
    }
    console.log('[Migration] Statement-by-statement schema migration completed.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
