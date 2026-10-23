import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { auditService } from '../services/auditService.js';

const router = Router();

/**
 * List approved claims with optional filtering
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const { category, status, search } = req.query;

    let sql = 'SELECT * FROM approved_claims WHERE org_id = $1';
    const params: any[] = [orgId];

    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND verification_status = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (claim_statement ILIKE $${params.length} OR citation_reference ILIKE $${params.length})`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await db.query(sql, params);
    res.json({ claims: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch claims: ' + err.message });
  }
});

/**
 * Create a new approved claim with evidence
 */
router.post('/', authenticate, authorizeRoles('admin', 'compliance_officer', 'brand_manager'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const {
      claim_statement,
      category,
      verification_status = 'verified',
      citation_reference,
      evidence_url,
      expiration_date,
      approved_by,
    } = req.body;

    if (!claim_statement || !category || !citation_reference || !expiration_date) {
      res.status(400).json({ error: 'Claim statement, category, citation reference, and expiration date are required.' });
      return;
    }

    const approverName = approved_by || req.user!.full_name;

    const result = await db.query(
      `INSERT INTO approved_claims
        (org_id, claim_statement, category, verification_status, citation_reference, evidence_url, approved_by, expiration_date, usage_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
       RETURNING *`,
      [
        orgId,
        claim_statement.trim(),
        category,
        verification_status,
        citation_reference.trim(),
        evidence_url ? evidence_url.trim() : null,
        approverName,
        expiration_date,
      ]
    );

    const claim = result.rows[0];

    await auditService.logEvent({
      orgId,
      userId,
      action: 'CLAIM_CREATED',
      resourceType: 'claim',
      resourceId: claim.id,
      details: { claim: claim.claim_statement, category: claim.category, status: claim.verification_status },
      ipAddress: req.ip,
    });

    res.status(201).json({ claim });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create claim: ' + err.message });
  }
});

/**
 * Update an approved claim
 */
router.put('/:id', authenticate, authorizeRoles('admin', 'compliance_officer', 'brand_manager'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const {
      claim_statement,
      category,
      verification_status,
      citation_reference,
      evidence_url,
      expiration_date,
      approved_by,
      usage_count,
    } = req.body;

    const check = await db.query('SELECT * FROM approved_claims WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Claim record not found.' });
      return;
    }

    const result = await db.query(
      `UPDATE approved_claims
       SET claim_statement = COALESCE($1, claim_statement),
           category = COALESCE($2, category),
           verification_status = COALESCE($3, verification_status),
           citation_reference = COALESCE($4, citation_reference),
           evidence_url = COALESCE($5, evidence_url),
           expiration_date = COALESCE($6, expiration_date),
           approved_by = COALESCE($7, approved_by),
           usage_count = COALESCE($8, usage_count),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND org_id = $10
       RETURNING *`,
      [
        claim_statement ? claim_statement.trim() : null,
        category || null,
        verification_status || null,
        citation_reference ? citation_reference.trim() : null,
        evidence_url !== undefined ? evidence_url : null,
        expiration_date || null,
        approved_by || null,
        usage_count !== undefined ? usage_count : null,
        id,
        orgId,
      ]
    );

    const updated = result.rows[0];

    await auditService.logEvent({
      orgId,
      userId,
      action: 'CLAIM_UPDATED',
      resourceType: 'claim',
      resourceId: updated.id,
      details: { status: updated.verification_status, category: updated.category },
      ipAddress: req.ip,
    });

    res.json({ claim: updated });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update claim: ' + err.message });
  }
});

/**
 * Delete an approved claim
 */
router.delete('/:id', authenticate, authorizeRoles('admin', 'compliance_officer', 'brand_manager'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;

    const check = await db.query('SELECT claim_statement FROM approved_claims WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Claim record not found.' });
      return;
    }

    await db.query('DELETE FROM approved_claims WHERE id = $1 AND org_id = $2', [id, orgId]);

    await auditService.logEvent({
      orgId,
      userId,
      action: 'CLAIM_DELETED',
      resourceType: 'claim',
      resourceId: id,
      details: { statement: check.rows[0].claim_statement },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Claim record deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete claim: ' + err.message });
  }
});

export default router;
