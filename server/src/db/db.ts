import { Pool, QueryResult } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env.js';

export interface IDatabase {
  query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  isReady(): boolean;
  getEngineType(): string;
}

class DatabaseService implements IDatabase {
  private pgPool: Pool | null = null;
  private pglite: PGlite | null = null;
  private engineType: 'postgresql' | 'pglite' = 'postgresql';
  private ready: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    // Try external PostgreSQL first
    try {
      const pool = new Pool({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: 3000,
      });

      // Probe connection
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.pgPool = pool;
      this.engineType = 'postgresql';
      this.ready = true;
      console.log(`[DB] Connected successfully to PostgreSQL server at ${config.databaseUrl}`);
      return;
    } catch (pgError: any) {
      console.warn(`[DB] PostgreSQL server connection failed (${pgError.message}). Initializing embedded PGlite engine...`);
    }

    // Fallback to embedded PGlite (Real Postgres WebAssembly engine with local disk persistence)
    try {
      const dataDir = path.resolve(process.cwd(), 'data', 'pglite_store');
      if (!fs.existsSync(path.dirname(dataDir))) {
        fs.mkdirSync(path.dirname(dataDir), { recursive: true });
      }

      this.pglite = new PGlite(dataDir);
      await this.pglite.waitReady;
      this.engineType = 'pglite';
      this.ready = true;
      console.log(`[DB] Embedded PGlite PostgreSQL engine initialized at ${dataDir}`);
    } catch (pgliteError: any) {
      console.error(`[DB] Failed to initialize PGlite:`, pgliteError);
      throw pgliteError;
    }
  }

  public async ensureReady(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  public isReady(): boolean {
    return this.ready;
  }

  public getEngineType(): string {
    return this.engineType;
  }

  public async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    await this.ensureReady();

    if (this.engineType === 'postgresql' && this.pgPool) {
      const res = await this.pgPool.query(text, params);
      return {
        rows: res.rows as T[],
        rowCount: res.rowCount || res.rows.length,
      };
    }

    if (this.engineType === 'pglite' && this.pglite) {
      // PGlite supports postgres parameterized queries
      const res = await this.pglite.query(text, params);
      return {
        rows: (res.rows || []) as T[],
        rowCount: res.rows?.length || 0,
      };
    }

    throw new Error('Database service is not initialized.');
  }
}

export const db = new DatabaseService();
