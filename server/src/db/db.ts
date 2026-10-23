import { inMemoryDb, InMemoryDatabase } from './inMemoryDb.js';
import type { IDatabase, QueryResult } from './inMemoryDb.js';

export type { IDatabase, QueryResult };
export { InMemoryDatabase, inMemoryDb };
export const db = inMemoryDb;
export default db;
