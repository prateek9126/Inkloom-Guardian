import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { auditService } from '../services/auditService.js';

const router = Router();

/**
 * List guidelines with optional filtering
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const { category, severity, search } = req.query;

    let sql = `
      SELECT bg.*, u.full_name as author_name
      FROM brand_guidelines bg
      LEFT JOIN users u ON bg.created_by = u.id
      WHERE bg.org_id = $1
    `;
    const params: any[] = [orgId];

    if (category) {
      params.push(category);
      sql += ` AND bg.category = $${params.length}`;
    }

    if (severity) {
      params.push(severity);
      sql += ` AND bg.severity = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (bg.title ILIKE $${params.length} OR bg.description ILIKE $${params.length})`;
    }

    sql += ' ORDER BY bg.updated_at DESC';

    const result = await db.query(sql, params);
    res.json({ guidelines: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch guidelines: ' + err.message });
  }
});

/**
 * Get single guideline
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;

    const result = await db.query(
      `SELECT bg.*, u.full_name as author_name
       FROM brand_guidelines bg
       LEFT JOIN users u ON bg.created_by = u.id
       WHERE bg.id = $1 AND bg.org_id = $2`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Guideline not found.' });
      return;
    }

    res.json({ guideline: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch guideline: ' + err.message });
  }
});

/**
 * Create brand guideline (Admin, Compliance Officer, Brand Manager)
 */
router.post('/', authenticate, authorizeRoles('admin', 'compliance_officer', 'brand_manager'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const { title, category, description, rules, severity = 'medium', is_active = true } = req.body;

    if (!title || !category || !description) {
      res.status(400).json({ error: 'Title, category, and description are required.' });
      return;
    }

    const result = await db.query(
      `INSERT INTO brand_guidelines 
        (org_id, title, category, description, rules, severity, is_active, version, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)
       RETURNING *`,
      [orgId, title.trim(), category, description.trim(), JSON.stringify(rules || {}), severity, is_active, userId]
    );

    const guideline = result.rows[0];

    await auditService.logEvent({
      orgId,
      userId,
      action: 'GUIDELINE_CREATED',
      resourceType: 'guideline',
      resourceId: guideline.id,
      details: { title: guideline.title, category: guideline.category, severity: guideline.severity },
      ipAddress: req.ip,
    });

    res.status(201).json({ guideline });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create guideline: ' + err.message });
  }
});

/**
 * Update brand guideline
 */
router.put('/:id', authenticate, authorizeRoles('admin', 'compliance_officer', 'brand_manager'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const { title, category, description, rules, severity, is_active } = req.body;

    // Check existence
    const check = await db.query('SELECT * FROM brand_guidelines WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Guideline not found.' });
      return;
    }

    const current = check.rows[0];
    const newVersion = current.version + 1;

    const result = await db.query(
      `UPDATE brand_guidelines
       SET title = COALESCE($1, title),
           category = COALESCE($2, category),
           description = COALESCE($3, description),
           rules = COALESCE($4, rules),
           severity = COALESCE($5, severity),
           is_active = COALESCE($6, is_active),
           version = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 AND org_id = $9
       RETURNING *`,
      [
        title ? title.trim() : null,
        category || null,
        description ? description.trim() : null,
        rules ? JSON.stringify(rules) : null,
        severity || null,
        is_active !== undefined ? is_active : null,
        newVersion,
        id,
        orgId,
      ]
    );

    const updated = result.rows[0];

    await auditService.logEvent({
      orgId,
      userId,
      action: 'GUIDELINE_UPDATED',
      resourceType: 'guideline',
      resourceId: updated.id,
      details: { title: updated.title, newVersion },
      ipAddress: req.ip,
    });

    res.json({ guideline: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update guideline: ' + err.message });
  }
});

/**
 * Delete brand guideline
 */
router.delete('/:id', authenticate, authorizeRoles('admin', 'compliance_officer', 'brand_manager'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;

    const check = await db.query('SELECT title FROM brand_guidelines WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Guideline not found.' });
      return;
    }

    await db.query('DELETE FROM brand_guidelines WHERE id = $1 AND org_id = $2', [id, orgId]);

    await auditService.logEvent({
      orgId,
      userId,
      action: 'GUIDELINE_DELETED',
      resourceType: 'guideline',
      resourceId: id,
      details: { title: check.rows[0].title },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Guideline successfully deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete guideline: ' + err.message });
  }
});

export default router;
