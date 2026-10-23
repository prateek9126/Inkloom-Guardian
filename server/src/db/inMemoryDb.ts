import crypto from 'crypto';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface IDatabase {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  isReady(): boolean;
  getEngineType(): string;
  ensureReady(): Promise<void>;
  resetAll(): Promise<void>;
  getTables(): Map<string, any[]>;
}

export class InMemoryDatabase implements IDatabase {
  private tables: Map<string, any[]> = new Map();
  private ready: boolean = true;

  constructor() {
    this.initTables();
  }

  public initTables(): void {
    const tableNames = [
      'organizations',
      'users',
      'brand_guidelines',
      'approved_claims',
      'evidence_sources',
      'source_passages',
      'campaigns',
      'content_submissions',
      'extracted_claims',
      'claim_corrections',
      'risk_reports',
      'review_approvals',
      'audit_logs',
      'system_settings',
      'campaign_facts',
      'campaign_contradictions',
      'campaign_consistency_scores',
      'campaign_review_actions',
      'content_versions',
      'submission_comments',
      'reviewer_feedback_records',
      'policy_candidate_recommendations',
    ];
    for (const name of tableNames) {
      if (!this.tables.has(name)) {
        this.tables.set(name, []);
      }
    }
  }

  public async ensureReady(): Promise<void> {
    this.ready = true;
  }

  public isReady(): boolean {
    return this.ready;
  }

  public getEngineType(): string {
    return 'in-memory';
  }

  public async resetAll(): Promise<void> {
    for (const key of this.tables.keys()) {
      this.tables.set(key, []);
    }
    this.initTables();
  }

  public getTables(): Map<string, any[]> {
    return this.tables;
  }

  public getTable(name: string): any[] {
    const lower = name.toLowerCase();
    if (!this.tables.has(lower)) {
      this.tables.set(lower, []);
    }
    return this.tables.get(lower)!;
  }

  /**
   * Main query entry point
   */
  public async query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
    const rawSql = text.trim();
    if (!rawSql) {
      return { rows: [], rowCount: 0 };
    }

    // Skip DDL statements (CREATE TABLE, ALTER TABLE, CREATE INDEX, etc.) gracefully
    if (
      /^(CREATE|ALTER|DROP|BEGIN|COMMIT|ROLLBACK)\b/i.test(rawSql)
    ) {
      return { rows: [], rowCount: 0 };
    }

    const firstWord = rawSql.split(/\s+/)[0].toUpperCase();

    try {
      if (firstWord === 'INSERT') {
        return this.handleInsert<T>(rawSql, params);
      }
      if (firstWord === 'SELECT') {
        return this.handleSelect<T>(rawSql, params);
      }
      if (firstWord === 'UPDATE') {
        return this.handleUpdate<T>(rawSql, params);
      }
      if (firstWord === 'DELETE') {
        return this.handleDelete<T>(rawSql, params);
      }
    } catch (err: any) {
      console.error(`[InMemoryDB Error] SQL: ${rawSql.slice(0, 150)}...`, err);
      throw err;
    }

    return { rows: [], rowCount: 0 };
  }

  // =========================================================================
  // INSERT HANDLER
  // =========================================================================
  private handleInsert<T>(sql: string, params: any[]): QueryResult<T> {
    // INSERT INTO tableName (col1, col2, ...) VALUES (...), (...) [ON CONFLICT ...] [RETURNING ...]
    const match = sql.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+)$/i);
    if (!match) {
      throw new Error(`[InMemoryDB] Unable to parse INSERT query: ${sql}`);
    }

    const tableName = match[1].toLowerCase();
    const columns = match[2].split(',').map((c) => c.trim().toLowerCase());
    const rest = match[3].trim();

    // Check for RETURNING clause
    let returningClause: string[] | null = null;
    let valuesPart = rest;
    const retMatch = rest.match(/\s+RETURNING\s+([\s\S]+)$/i);
    if (retMatch) {
      returningClause = retMatch[1].split(',').map((c) => c.trim().toLowerCase());
      valuesPart = rest.slice(0, retMatch.index).trim();
    }

    // Check for ON CONFLICT clause
    let onConflictCol: string | null = null;
    let onConflictDoUpdate: string | null = null;
    const conflictMatch = valuesPart.match(/\s+ON\s+CONFLICT(?:\s*\(([^)]+)\))?\s+DO\s+(UPDATE\s+SET\s+[\s\S]+|NOTHING)$/i);
    if (conflictMatch) {
      onConflictCol = conflictMatch[1] ? conflictMatch[1].trim().toLowerCase() : null;
      if (conflictMatch[2].toUpperCase().startsWith('UPDATE')) {
        onConflictDoUpdate = conflictMatch[2].replace(/^UPDATE\s+SET\s+/i, '').trim();
      }
      valuesPart = valuesPart.slice(0, conflictMatch.index).trim();
    }

    // Parse value tuples: (val1, val2, ...), (val3, val4, ...)
    const tuples = this.parseValueTuples(valuesPart);
    const table = this.getTable(tableName);
    const insertedRows: any[] = [];

    for (const tuple of tuples) {
      const row: Record<string, any> = {};

      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const valToken = tuple[i];
        row[col] = this.resolveValueToken(valToken, params);
      }

      // Default fields if omitted
      if (row.id === undefined) {
        row.id = crypto.randomUUID();
      }
      const nowIso = new Date().toISOString();
      if (row.created_at === undefined) {
        row.created_at = nowIso;
      }
      if (row.updated_at === undefined) {
        row.updated_at = nowIso;
      }

      // Handle ON CONFLICT
      if (onConflictCol) {
        const existingIdx = table.findIndex((r) => r[onConflictCol!] === row[onConflictCol!]);
        if (existingIdx !== -1) {
          if (onConflictDoUpdate) {
            // Apply ON CONFLICT DO UPDATE SET col1 = val1, col2 = EXCLUDED.col2
            this.applyUpdateAssignments(table[existingIdx], onConflictDoUpdate, params, row);
            table[existingIdx].updated_at = nowIso;
            insertedRows.push(table[existingIdx]);
            continue;
          } else {
            // DO NOTHING
            continue;
          }
        }
      }

      table.push(row);
      insertedRows.push(row);
    }

    const projected = this.projectReturning(insertedRows, returningClause);
    return {
      rows: projected as T[],
      rowCount: insertedRows.length,
    };
  }

  // =========================================================================
  // UPDATE HANDLER
  // =========================================================================
  private handleUpdate<T>(sql: string, params: any[]): QueryResult<T> {
    // UPDATE tableName [AS alias] SET col = val, ... [WHERE ...] [RETURNING ...]
    const match = sql.match(/^UPDATE\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?\s+SET\s+([\s\S]+)$/i);
    if (!match) {
      throw new Error(`[InMemoryDB] Unable to parse UPDATE query: ${sql}`);
    }

    const tableName = match[1].toLowerCase();
    const alias = match[2] ? match[2].toLowerCase() : tableName;
    let rest = match[3].trim();

    // Extract RETURNING
    let returningClause: string[] | null = null;
    const retMatch = rest.match(/\s+RETURNING\s+([\s\S]+)$/i);
    if (retMatch) {
      returningClause = retMatch[1].split(',').map((c) => c.trim().toLowerCase());
      rest = rest.slice(0, retMatch.index).trim();
    }

    // Extract WHERE
    let whereClause: string | null = null;
    const whereMatch = rest.match(/\s+WHERE\s+([\s\S]+)$/i);
    let setAssignments = rest;
    if (whereMatch) {
      whereClause = whereMatch[1].trim();
      setAssignments = rest.slice(0, whereMatch.index).trim();
    }

    const table = this.getTable(tableName);
    const updatedRows: any[] = [];

    for (const row of table) {
      const rowContext = { [alias]: row, ...row };
      if (!whereClause || this.evaluateWhere(whereClause, rowContext, params)) {
        this.applyUpdateAssignments(row, setAssignments, params);
        if (row.updated_at !== undefined) {
          row.updated_at = new Date().toISOString();
        }
        updatedRows.push(row);
      }
    }

    const projected = this.projectReturning(updatedRows, returningClause);
    return {
      rows: projected as T[],
      rowCount: updatedRows.length,
    };
  }

  // =========================================================================
  // DELETE HANDLER
  // =========================================================================
  private handleDelete<T>(sql: string, params: any[]): QueryResult<T> {
    // DELETE FROM tableName [WHERE ...]
    const match = sql.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([\s\S]+))?$/i);
    if (!match) {
      throw new Error(`[InMemoryDB] Unable to parse DELETE query: ${sql}`);
    }

    const tableName = match[1].toLowerCase();
    const whereClause = match[2] ? match[2].trim() : null;
    const table = this.getTable(tableName);

    if (!whereClause) {
      const count = table.length;
      table.length = 0;
      return { rows: [], rowCount: count };
    }

    let deletedCount = 0;
    for (let i = table.length - 1; i >= 0; i--) {
      const row = table[i];
      if (this.evaluateWhere(whereClause, row, params)) {
        table.splice(i, 1);
        deletedCount++;
      }
    }

    return { rows: [], rowCount: deletedCount };
  }

  // =========================================================================
  // SELECT HANDLER
  // =========================================================================
  private handleSelect<T>(sql: string, params: any[]): QueryResult<T> {
    // Subquery in FROM: SELECT COUNT(*)::int as count FROM (SELECT ...) [AS alias]
    const subqueryCountMatch = sql.match(/^SELECT\s+COUNT\s*\(\s*\*\s*\)(?:::int)?(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?\s+FROM\s*\(([\s\S]+)\)(?:\s+(?:AS\s+)?[a-zA-Z0-9_]+)?$/i);
    if (subqueryCountMatch) {
      const outCol = subqueryCountMatch[1] || 'count';
      const innerSql = subqueryCountMatch[2].trim();
      const innerRes = this.handleSelect(innerSql, params);
      return { rows: [{ [outCol]: innerRes.rowCount }] as any[], rowCount: 1 };
    }

    // SELECT <columns> FROM <table> [alias] [JOIN...] [WHERE...] [GROUP BY...] [ORDER BY...] [LIMIT...] [OFFSET...]
    const fromMatch = sql.match(/FROM\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?([\s\S]*)$/i);
    if (!fromMatch) {
      // Could be SELECT 1
      if (/SELECT\s+1/i.test(sql)) {
        return { rows: [{ '?column?': 1 }] as any[], rowCount: 1 };
      }
      throw new Error(`[InMemoryDB] Unable to parse SELECT query: ${sql}`);
    }

    const selectColumnsRaw = sql.slice(6, fromMatch.index).trim();
    const primaryTable = fromMatch[1].toLowerCase();
    const candidateAlias = fromMatch[2] ? fromMatch[2].toLowerCase() : null;
    let rest = fromMatch[3].trim();

    const sqlKeywords = ['where', 'join', 'left', 'inner', 'right', 'full', 'group', 'order', 'limit', 'offset', 'having'];
    let primaryAlias = primaryTable;
    if (candidateAlias) {
      if (sqlKeywords.includes(candidateAlias)) {
        rest = candidateAlias + ' ' + rest;
      } else {
        primaryAlias = candidateAlias;
      }
    }

    // 1. Parse LIMIT & OFFSET
    let limit: number | null = null;
    let offset: number = 0;

    const limitMatch = rest.match(/(?:^|\s+)LIMIT\s+(\$?\d+)/i);
    if (limitMatch) {
      const tok = limitMatch[1];
      limit = tok.startsWith('$') ? parseInt(params[parseInt(tok.slice(1), 10) - 1], 10) : parseInt(tok, 10);
      rest = (rest.slice(0, limitMatch.index) + ' ' + rest.slice(limitMatch.index! + limitMatch[0].length)).trim();
    }

    const offsetMatch = rest.match(/(?:^|\s+)OFFSET\s+(\$?\d+)/i);
    if (offsetMatch) {
      const tok = offsetMatch[1];
      offset = tok.startsWith('$') ? parseInt(params[parseInt(tok.slice(1), 10) - 1], 10) : parseInt(tok, 10);
      rest = (rest.slice(0, offsetMatch.index) + ' ' + rest.slice(offsetMatch.index! + offsetMatch[0].length)).trim();
    }

    // 2. Parse ORDER BY
    let orderByClause: string | null = null;
    const orderMatch = rest.match(/(?:^|\s+)ORDER\s+BY\s+([\s\S]+?)(?=$)/i);
    if (orderMatch) {
      orderByClause = orderMatch[1].trim();
      rest = rest.slice(0, orderMatch.index).trim();
    }

    // 3. Parse GROUP BY
    let groupByClause: string | null = null;
    const groupMatch = rest.match(/(?:^|\s+)GROUP\s+BY\s+([\s\S]+?)(?=$)/i);
    if (groupMatch) {
      groupByClause = groupMatch[1].trim();
      rest = rest.slice(0, groupMatch.index).trim();
    }

    // 4. Parse WHERE
    let whereClause: string | null = null;
    const whereMatch = rest.match(/(?:^|\s+)WHERE\s+([\s\S]+?)(?=$)/i);
    let joinsPart = rest;
    if (whereMatch) {
      whereClause = whereMatch[1].trim();
      joinsPart = rest.slice(0, whereMatch.index).trim();
    }

    // 5. Parse JOINs
    const joins = this.parseJoins(joinsPart);

    // Initial table rows
    let currentRows = this.getTable(primaryTable).map((r) => ({
      _primary: r,
      [primaryAlias]: r,
      ...r,
    }));

    // Perform JOINs
    for (const j of joins) {
      currentRows = this.executeJoin(currentRows, j, params);
    }

    // Apply WHERE filtering
    if (whereClause) {
      currentRows = currentRows.filter((row) => this.evaluateWhere(whereClause!, row, params));
    }

    // Apply GROUP BY or Aggregate functions
    let resultRows: any[] = [];
    const isAggregate = /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(selectColumnsRaw);

    if (groupByClause || (isAggregate && currentRows.length >= 0)) {
      resultRows = this.executeGroupBy(currentRows, groupByClause, selectColumnsRaw, params, primaryAlias);
    } else {
      // Normal projection
      resultRows = currentRows.map((row) => this.projectColumns(row, selectColumnsRaw, primaryAlias));
    }

    // Apply ORDER BY
    if (orderByClause) {
      resultRows = this.executeOrderBy(resultRows, orderByClause);
    }

    // Apply OFFSET & LIMIT
    if (offset > 0) {
      resultRows = resultRows.slice(offset);
    }
    if (limit !== null && limit !== undefined && !isNaN(limit)) {
      resultRows = resultRows.slice(0, limit);
    }

    return {
      rows: resultRows as T[],
      rowCount: resultRows.length,
    };
  }

  // =========================================================================
  // JOIN EXECUTION
  // =========================================================================
  private parseJoins(raw: string): any[] {
    const joins: any[] = [];
    if (!raw.trim()) return joins;

    const joinRegex = /(?:^|\s+)(LEFT\s+|INNER\s+)?JOIN\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?\s+ON\s+([\s\S]+?)(?=(?:\s+(?:LEFT\s+|INNER\s+)?JOIN\b)|$)/gi;
    let match;
    while ((match = joinRegex.exec(raw)) !== null) {
      const type = match[1] && match[1].toUpperCase().includes('LEFT') ? 'LEFT' : 'INNER';
      const table = match[2].toLowerCase();
      const alias = match[3] ? match[3].toLowerCase() : table;
      const onCondition = match[4].trim();
      joins.push({ type, table, alias, onCondition });
    }
    return joins;
  }

  private executeJoin(leftRows: any[], join: any, params: any[]): any[] {
    const rightTable = this.getTable(join.table);
    const result: any[] = [];

    // Parse ON: e.g. "a.user_id = u.id" or "cs.campaign_id = c.id"
    const onMatch = join.onCondition.match(/([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)/);

    for (const leftRow of leftRows) {
      let matched = false;

      for (const rightRow of rightTable) {
        const combined = {
          ...leftRow,
          [join.alias]: rightRow,
        };

        let conditionMet = false;
        if (onMatch) {
          const leftVal = this.getDottedValue(combined, onMatch[1]);
          const rightVal = this.getDottedValue(combined, onMatch[2]);
          conditionMet = leftVal !== undefined && rightVal !== undefined && String(leftVal) === String(rightVal);
        } else {
          conditionMet = this.evaluateWhere(join.onCondition, combined, params);
        }

        if (conditionMet) {
          matched = true;
          result.push({
            ...leftRow,
            [join.alias]: rightRow,
            ...rightRow, // flatten for easy access if no collisions
          });
        }
      }

      if (!matched && join.type === 'LEFT') {
        result.push({
          ...leftRow,
          [join.alias]: null,
        });
      }
    }

    return result;
  }

  // =========================================================================
  // WHERE CLAUSE EVALUATION
  // =========================================================================
  public evaluateWhere(whereClause: string, row: any, params: any[]): boolean {
    const clause = whereClause.trim();
    if (!clause) return true;

    // Split on top-level ORs (respecting parentheses)
    const orParts = this.splitTopLevel(clause, /\s+OR\s+/i);
    if (orParts.length > 1) {
      return orParts.some((part) => this.evaluateWhere(part, row, params));
    }

    // Split on top-level ANDs (respecting parentheses)
    const andParts = this.splitTopLevel(clause, /\s+AND\s+/i);
    if (andParts.length > 1) {
      return andParts.every((part) => this.evaluateWhere(part, row, params));
    }

    // Strip wrapping parentheses: (expr)
    if (clause.startsWith('(') && clause.endsWith(')')) {
      const inner = clause.slice(1, -1).trim();
      return this.evaluateWhere(inner, row, params);
    }

    // Evaluate single condition
    return this.evaluateSingleCondition(clause, row, params);
  }

  private evaluateSingleCondition(cond: string, row: any, params: any[]): boolean {
    const c = cond.trim();

    // 1. IS NULL / IS NOT NULL
    const isNullMatch = c.match(/^([a-zA-Z0-9_.]+)\s+IS\s+(NOT\s+)?NULL$/i);
    if (isNullMatch) {
      const val = this.getDottedValue(row, isNullMatch[1]);
      const isNot = Boolean(isNullMatch[2]);
      const isNull = val === null || val === undefined;
      return isNot ? !isNull : isNull;
    }

    // 2. IN (subquery)
    const inSubqueryMatch = c.match(/^([a-zA-Z0-9_.]+)\s+(?:NOT\s+)?IN\s*\(\s*(SELECT[\s\S]+)\s*\)$/i);
    if (inSubqueryMatch) {
      const leftVal = this.getDottedValue(row, inSubqueryMatch[1]);
      const subquery = inSubqueryMatch[2];
      const isNot = /NOT\s+IN/i.test(c);
      // Run subquery synchronously
      const subRes = this.handleSelect(subquery, params);
      const subValues = new Set(subRes.rows.map((r: any) => Object.values(r)[0]));
      const has = subValues.has(leftVal);
      return isNot ? !has : has;
    }

    // 3. IN ($1, $2, ...) or IN ('a', 'b')
    const inListMatch = c.match(/^([a-zA-Z0-9_.]+)\s+(?:(NOT)\s+)?IN\s*\(([^)]+)\)$/i);
    if (inListMatch) {
      const leftVal = this.getDottedValue(row, inListMatch[1]);
      const isNot = Boolean(inListMatch[2]);
      const listTokens = inListMatch[3].split(',').map((s) => s.trim());
      const values = listTokens.map((tok) => this.resolveValueToken(tok, params));
      const has = values.some((v) => String(v) === String(leftVal));
      return isNot ? !has : has;
    }

    // 4. ANY ($1) or = ANY($1)
    const anyMatch = c.match(/(?:([a-zA-Z0-9_.]+)\s*=\s*ANY\s*\(([^)]+)\)|ANY\s*\(([^)]+)\)\s*=\s*([a-zA-Z0-9_.]+))/i);
    if (anyMatch) {
      const colToken = anyMatch[1] || anyMatch[4];
      const paramToken = anyMatch[2] || anyMatch[3];
      const leftVal = this.getDottedValue(row, colToken);
      const rightArray = this.resolveValueToken(paramToken, params);
      if (Array.isArray(rightArray)) {
        return rightArray.some((v) => String(v) === String(leftVal));
      }
      return false;
    }

    // 5. ILIKE / LIKE
    const likeMatch = c.match(/^([a-zA-Z0-9_.]+)\s+(NOT\s+)?(I?LIKE)\s+(.+)$/i);
    if (likeMatch) {
      const leftVal = String(this.getDottedValue(row, likeMatch[1]) ?? '');
      const isNot = Boolean(likeMatch[2]);
      const isCaseInsensitive = likeMatch[3].toUpperCase() === 'ILIKE';
      const rawPattern = this.resolveValueToken(likeMatch[4].trim(), params);
      const pattern = String(rawPattern || '')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.');
      const regex = new RegExp(`^${pattern}$`, isCaseInsensitive ? 'i' : '');
      const matched = regex.test(leftVal);
      return isNot ? !matched : matched;
    }

    // 6. Binary Operators: =, !=, <>, >=, <=, >, <
    const binMatch = c.match(/^(LOWER\([^)]+\)|[a-zA-Z0-9_.]+)\s*(=|!=|<>|>=|<=|>|<)\s*(LOWER\([^)]+\)|[\s\S]+)$/i);
    if (binMatch) {
      let leftExpr = binMatch[1].trim();
      const op = binMatch[2];
      let rightExpr = binMatch[3].trim();

      let leftVal: any;
      if (/^LOWER\(([^)]+)\)$/i.test(leftExpr)) {
        const inner = leftExpr.match(/^LOWER\(([^)]+)\)$/i)![1].trim();
        leftVal = String(this.getDottedValue(row, inner) ?? '').toLowerCase();
      } else {
        leftVal = this.getDottedValue(row, leftExpr);
      }

      let rightVal: any;
      if (/^LOWER\(([^)]+)\)$/i.test(rightExpr)) {
        const inner = rightExpr.match(/^LOWER\(([^)]+)\)$/i)![1].trim();
        rightVal = String(this.resolveValueToken(inner, params) ?? '').toLowerCase();
      } else {
        rightVal = this.resolveValueToken(rightExpr, params);
      }

      if (op === '=' || op === '==') {
        if (leftVal === null && rightVal === null) return true;
        if (typeof leftVal === 'boolean' || typeof rightVal === 'boolean') {
          return Boolean(leftVal) === Boolean(rightVal);
        }
        return String(leftVal) === String(rightVal);
      }
      if (op === '!=' || op === '<>') {
        return String(leftVal) !== String(rightVal);
      }
      if (op === '>') return Number(leftVal) > Number(rightVal);
      if (op === '>=') return Number(leftVal) >= Number(rightVal);
      if (op === '<') return Number(leftVal) < Number(rightVal);
      if (op === '<=') return Number(leftVal) <= Number(rightVal);
    }

    // Boolean column check (e.g. "is_active", "is_demo")
    const boolVal = this.getDottedValue(row, c);
    return Boolean(boolVal);
  }

  // =========================================================================
  // GROUP BY & AGGREGATIONS
  // =========================================================================
  private executeGroupBy(rows: any[], groupBy: string | null, selectColsRaw: string, params: any[], primaryAlias: string): any[] {
    const groups: Map<string, any[]> = new Map();

    const groupKeys = groupBy ? groupBy.split(',').map((k) => k.trim()) : ['__all__'];

    for (const row of rows) {
      const keyParts = groupKeys.map((k) => {
        if (k === '__all__') return '__all__';
        // Handle expressions like COALESCE(rfr.rule_id::text, rfr.rule_title)
        if (/COALESCE/i.test(k)) {
          const matchCoalesce = k.match(/COALESCE\s*\(([^,]+),\s*([^)]+)\)/i);
          if (matchCoalesce) {
            const v1 = this.getDottedValue(row, matchCoalesce[1].replace(/::text/gi, '').trim());
            const v2 = this.getDottedValue(row, matchCoalesce[2].trim());
            return String(v1 ?? v2 ?? '');
          }
        }
        return String(this.getDottedValue(row, k) ?? '');
      });
      const groupHash = keyParts.join(':::');
      if (!groups.has(groupHash)) {
        groups.set(groupHash, []);
      }
      groups.get(groupHash)!.push(row);
    }

    const projectedRows: any[] = [];
    for (const [, groupRows] of groups.entries()) {
      const firstRow = groupRows[0] || {};
      const outRow: Record<string, any> = {};

      const colDefs = this.splitColumns(selectColsRaw);
      for (const colDef of colDefs) {
        const aliasMatch = colDef.match(/([\s\S]+?)\s+(?:AS\s+)?([a-zA-Z0-9_]+)$/i);
        const colExpr = aliasMatch ? aliasMatch[1].trim() : colDef.trim();
        let outName = aliasMatch ? aliasMatch[2].trim() : colExpr;
        if (!aliasMatch && outName.includes('.')) {
          outName = outName.split('.').pop()!;
        }

        // COUNT(*)
        if (/^COUNT\s*\(\s*\*\s*\)(?:::int)?$/i.test(colExpr)) {
          outRow[outName] = groupRows.length;
          continue;
        }

        // COUNT(col)
        const countColMatch = colExpr.match(/^COUNT\s*\(\s*([^)]+)\s*\)(?:::int)?$/i);
        if (countColMatch) {
          const cName = countColMatch[1].trim();
          outRow[outName] = groupRows.filter((r) => this.getDottedValue(r, cName) !== null && this.getDottedValue(r, cName) !== undefined).length;
          continue;
        }

        // SUM(CASE WHEN ... THEN 1 ELSE 0 END)
        const sumCaseMatch = colExpr.match(/^SUM\s*\(\s*CASE\s+WHEN\s+([\s\S]+?)\s+THEN\s+(\d+)\s+ELSE\s+(\d+)\s+END\s*\)(?:::int)?$/i);
        if (sumCaseMatch) {
          const caseCond = sumCaseMatch[1];
          const thenVal = parseInt(sumCaseMatch[2], 10);
          const elseVal = parseInt(sumCaseMatch[3], 10);
          let sum = 0;
          for (const gr of groupRows) {
            sum += this.evaluateWhere(caseCond, gr, params) ? thenVal : elseVal;
          }
          outRow[outName] = sum;
          continue;
        }

        // AVG(col)
        const avgMatch = colExpr.match(/(?:COALESCE\s*\(\s*)?AVG\s*\(\s*([^)]+)\s*\)(?:,\s*(\d+)\s*\))?(?:::int)?/i);
        if (avgMatch) {
          const cName = avgMatch[1].trim();
          const defaultVal = avgMatch[2] ? parseInt(avgMatch[2], 10) : 0;
          let sum = 0;
          let count = 0;
          for (const gr of groupRows) {
            const val = this.getDottedValue(gr, cName);
            if (val !== null && val !== undefined) {
              sum += Number(val);
              count++;
            }
          }
          outRow[outName] = count > 0 ? Math.round(sum / count) : defaultVal;
          continue;
        }

        // Ordinary field from first row
        if (colExpr.endsWith('.*')) {
          const tbl = colExpr.slice(0, -2);
          const sourceObj = firstRow[tbl] || firstRow._primary || firstRow;
          Object.assign(outRow, sourceObj);
        } else {
          outRow[outName] = this.getDottedValue(firstRow, colExpr);
        }
      }

      projectedRows.push(outRow);
    }

    return projectedRows;
  }

  // =========================================================================
  // PROJECTION & ORDERING HELPERS
  // =========================================================================
  private projectColumns(row: any, selectColsRaw: string, primaryAlias: string): any {
    if (selectColsRaw.trim() === '*' || selectColsRaw.trim() === `${primaryAlias}.*`) {
      return { ...(row._primary || row[primaryAlias] || row) };
    }

    const out: Record<string, any> = {};
    const colDefs = this.splitColumns(selectColsRaw);

    for (const colDef of colDefs) {
      const aliasMatch = colDef.match(/([\s\S]+?)\s+(?:AS\s+)?([a-zA-Z0-9_]+)$/i);
      const colExpr = aliasMatch ? aliasMatch[1].trim() : colDef.trim();
      let outName = aliasMatch ? aliasMatch[2].trim() : colExpr;
      if (!aliasMatch && outName.includes('.')) {
        outName = outName.split('.').pop()!;
      }

      if (colExpr.endsWith('.*')) {
        const tbl = colExpr.slice(0, -2);
        const sourceObj = row[tbl] || (tbl === primaryAlias ? row._primary : null) || row;
        if (sourceObj) {
          Object.assign(out, sourceObj);
        }
        continue;
      }

      // COUNT(*)::int as count for 1 row
      if (/^COUNT\s*\(\s*\*\s*\)(?:::int)?$/i.test(colExpr)) {
        out[outName] = 1;
        continue;
      }

      out[outName] = this.getDottedValue(row, colExpr);
    }

    return out;
  }

  private projectReturning(rows: any[], returningCols: string[] | null): any[] {
    if (!returningCols || returningCols.length === 0) {
      return [];
    }
    if (returningCols.includes('*')) {
      return rows.map((r) => ({ ...r }));
    }
    return rows.map((r) => {
      const proj: Record<string, any> = {};
      for (const col of returningCols) {
        proj[col] = r[col];
      }
      return proj;
    });
  }

  private executeOrderBy(rows: any[], orderByClause: string): any[] {
    const orderItems = orderByClause.split(',').map((s) => s.trim());

    return [...rows].sort((a, b) => {
      for (const item of orderItems) {
        // Handle CASE cc.severity WHEN 'critical' THEN 1 ...
        if (/^CASE\b/i.test(item)) {
          const valA = this.evaluateSeverityOrder(a);
          const valB = this.evaluateSeverityOrder(b);
          if (valA !== valB) return valA - valB;
          continue;
        }

        const match = item.match(/^([a-zA-Z0-9_.]+)(?:\s+(ASC|DESC))?$/i);
        if (match) {
          const col = match[1];
          const dir = match[2] && match[2].toUpperCase() === 'DESC' ? -1 : 1;
          const valA = this.getDottedValue(a, col);
          const valB = this.getDottedValue(b, col);

          if (valA === valB) continue;
          if (valA === null || valA === undefined) return 1 * dir;
          if (valB === null || valB === undefined) return -1 * dir;

          if (valA < valB) return -1 * dir;
          if (valA > valB) return 1 * dir;
        }
      }
      return 0;
    });
  }

  private evaluateSeverityOrder(row: any): number {
    const sev = String(row.severity || '').toLowerCase();
    if (sev === 'critical') return 1;
    if (sev === 'high') return 2;
    if (sev === 'medium') return 3;
    return 4;
  }

  // =========================================================================
  // UTILITIES & PARSERS
  // =========================================================================
  private parseValueTuples(raw: string): string[][] {
    const tuples: string[][] = [];
    let depth = 0;
    let currentTuple = '';
    let inQuotes = false;
    let quoteChar = '';

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if ((ch === "'" || ch === '"') && raw[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        } else if (quoteChar === ch) {
          inQuotes = false;
        }
      }

      if (!inQuotes) {
        if (ch === '(') {
          if (depth === 0) {
            currentTuple = '';
            depth++;
            continue;
          }
          depth++;
        } else if (ch === ')') {
          depth--;
          if (depth === 0) {
            tuples.push(this.splitCsv(currentTuple));
            continue;
          }
        }
      }

      if (depth > 0) {
        currentTuple += ch;
      }
    }

    return tuples;
  }

  private splitCsv(raw: string): string[] {
    const parts: string[] = [];
    let cur = '';
    let inQuotes = false;
    let quoteChar = '';
    let depth = 0;

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if ((ch === "'" || ch === '"') && raw[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        } else if (quoteChar === ch) {
          inQuotes = false;
        }
      }

      if (!inQuotes) {
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        if (ch === ')' || ch === ']' || ch === '}') depth--;
        if (ch === ',' && depth === 0) {
          parts.push(cur.trim());
          cur = '';
          continue;
        }
      }
      cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }

  private splitColumns(raw: string): string[] {
    return this.splitCsv(raw);
  }

  private splitTopLevel(raw: string, delimRegex: RegExp): string[] {
    const parts: string[] = [];
    let cur = '';
    let depth = 0;
    let inQuotes = false;
    let quoteChar = '';

    const tokens = raw.split(/(\s+|\(|\)|'|")/);
    let buffer = '';

    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if ((ch === "'" || ch === '"') && raw[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = ch;
        } else if (quoteChar === ch) {
          inQuotes = false;
        }
      }

      if (!inQuotes) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }

      if (depth === 0 && !inQuotes) {
        const slice = raw.slice(i);
        const match = slice.match(delimRegex);
        if (match && match.index === 0) {
          parts.push(buffer.trim());
          buffer = '';
          i += match[0].length - 1;
          continue;
        }
      }

      buffer += ch;
    }

    if (buffer.trim()) {
      parts.push(buffer.trim());
    }

    return parts.length > 0 ? parts : [raw];
  }

  public resolveValueToken(tok: string, params: any[]): any {
    if (!tok) return null;
    const t = tok.trim();

    // Parameter: $1, $2, ...
    if (/^\$\d+$/.test(t)) {
      const idx = parseInt(t.slice(1), 10) - 1;
      let val = params[idx];
      // Auto parse JSON if it is a JSON string passed into a jsonb/array column
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }

    // String literal: 'hello' or "hello"
    if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
      const inner = t.slice(1, -1).replace(/''/g, "'");
      // Strip ::jsonb or ::text
      return inner;
    }

    // Stripped casts: '[]'::jsonb or '{}'::jsonb
    if (/^'(\[\]|\{\})'::jsonb$/i.test(t)) {
      return t.includes('[]') ? [] : {};
    }

    // Booleans and Null
    if (/^TRUE$/i.test(t)) return true;
    if (/^FALSE$/i.test(t)) return false;
    if (/^NULL$/i.test(t)) return null;

    // Numbers
    if (/^-?\d+(\.\d+)?$/.test(t)) {
      return t.includes('.') ? parseFloat(t) : parseInt(t, 10);
    }

    // Subquery: (SELECT ...)
    if (t.startsWith('(') && t.endsWith(')')) {
      const inner = t.slice(1, -1).trim();
      if (/^SELECT\s+/i.test(inner)) {
        const subRes = this.handleSelect(inner, params);
        if (subRes.rows.length > 0) {
          const firstRow = subRes.rows[0] as Record<string, any>;
          return Object.values(firstRow)[0];
        }
        return null;
      }
    }

    // Array literal: '{}' or '{...}'
    if (t === "'{}'") return [];

    // CURRENT_TIMESTAMP or NOW()
    if (/^(CURRENT_TIMESTAMP|NOW\(\))$/i.test(t)) {
      return new Date().toISOString();
    }

    return t;
  }

  private applyUpdateAssignments(row: any, setPart: string, params: any[], excludedRow?: any): void {
    const assignments = this.splitCsv(setPart);
    for (const assign of assignments) {
      const match = assign.match(/^([a-zA-Z0-9_.]+)\s*=\s*([\s\S]+)$/);
      if (!match) continue;

      const col = match[1].includes('.') ? match[1].split('.')[1] : match[1];
      const expr = match[2].trim();

      // EXCLUDED.col in ON CONFLICT
      if (/^EXCLUDED\.([a-zA-Z0-9_]+)$/i.test(expr)) {
        const exCol = expr.match(/^EXCLUDED\.([a-zA-Z0-9_]+)$/i)![1].toLowerCase();
        if (excludedRow && excludedRow[exCol] !== undefined) {
          row[col] = excludedRow[exCol];
        }
        continue;
      }

      // COALESCE($1, col)
      const coalesceMatch = expr.match(/^COALESCE\s*\(\s*(\$\d+)\s*,\s*([a-zA-Z0-9_.]+)\s*\)$/i);
      if (coalesceMatch) {
        const paramIdx = parseInt(coalesceMatch[1].slice(1), 10) - 1;
        const paramVal = params[paramIdx];
        if (paramVal !== undefined && paramVal !== null) {
          row[col] = paramVal;
        }
        continue;
      }

      // version = version + 1
      if (new RegExp(`^${col}\\s*\\+\\s*(\\d+)$`, 'i').test(expr)) {
        const add = parseInt(expr.match(/\d+$/)![0], 10);
        row[col] = (Number(row[col]) || 0) + add;
        continue;
      }

      // is_outdated = NOT is_outdated
      if (new RegExp(`^NOT\\s+${col}$`, 'i').test(expr)) {
        row[col] = !row[col];
        continue;
      }

      // Standard assignment
      row[col] = this.resolveValueToken(expr, params);
    }
  }

  private getDottedValue(row: any, pathStr: string): any {
    if (!row) return undefined;
    const clean = pathStr.replace(/::(text|int|jsonb)/gi, '').trim();

    // Direct match
    if (row[clean] !== undefined) {
      return row[clean];
    }

    // Table alias dotted match: a.id or u.full_name
    if (clean.includes('.')) {
      const parts = clean.split('.');
      const prefix = parts[0];
      const field = parts[1];

      if (row[prefix] && typeof row[prefix] === 'object' && row[prefix][field] !== undefined) {
        return row[prefix][field];
      }
      if (row[field] !== undefined) {
        return row[field];
      }
    }

    return undefined;
  }
}

export const inMemoryDb = new InMemoryDatabase();
