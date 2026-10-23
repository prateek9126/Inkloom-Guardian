import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * List audit history with filtering
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const { resourceType, action, search, limit = '50', offset = '0' } = req.query;

    let sql = `
      SELECT a.*,
             u.full_name as user_name,
             u.email as user_email,
             u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.org_id = $1
    `;
    const params: any[] = [orgId];

    if (resourceType) {
      params.push(resourceType);
      sql += ` AND a.resource_type = $${params.length}`;
    }

    if (action) {
      params.push(action);
      sql += ` AND a.action = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (a.action ILIKE $${params.length} OR a.resource_id ILIKE $${params.length} OR u.full_name ILIKE $${params.length})`;
    }

    params.push(parseInt(limit as string, 10));
    sql += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;

    params.push(parseInt(offset as string, 10));
    sql += ` OFFSET $${params.length}`;

    const result = await db.query(sql, params);

    // Total count for pagination
    const countRes = await db.query(
      'SELECT COUNT(*)::int as total FROM audit_logs WHERE org_id = $1',
      [orgId]
    );

    res.json({
      logs: result.rows,
      total: countRes.rows[0]?.total || 0,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch audit logs: ' + err.message });
  }
});

/**
 * Export audit history as CSV or JSON
 */
router.get('/export', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const { format = 'json' } = req.query;

    const result = await db.query(
      `SELECT a.id, a.action, a.resource_type, a.resource_id, a.details, a.ip_address, a.created_at,
              u.full_name as user_name, u.email as user_email
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.org_id = $1
       ORDER BY a.created_at DESC
       LIMIT 500`,
      [orgId]
    );

    if (format === 'csv') {
      const headers = ['Log ID', 'Timestamp', 'User', 'Email', 'Action', 'Resource Type', 'Resource ID', 'IP Address', 'Details'];
      const rows = result.rows.map(r => [
        `"${r.id}"`,
        `"${r.created_at}"`,
        `"${r.user_name || 'System'}"`,
        `"${r.user_email || 'system@inkloom'}"`,
        `"${r.action}"`,
        `"${r.resource_type}"`,
        `"${r.resource_id}"`,
        `"${r.ip_address || ''}"`,
        `"${JSON.stringify(r.details).replace(/"/g, '""')}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="inkloom-audit-history.csv"');
      res.send(csvContent);
      return;
    }

    res.json({ exportedLogs: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export audit history: ' + err.message });
  }
});

export default router;
