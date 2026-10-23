import { db } from './db.js';

export async function runMigrations(): Promise<void> {
  console.log('[Migration] Verifying in-memory database schema tables...');
  await db.ensureReady();
  console.log('[Migration] In-memory database schema is ready.');
}

if (process.argv[1] && process.argv[1].endsWith('migrate.ts')) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
