import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { upload, extractContentFromFile } from '../middleware/upload.js';
import { riskAnalysisService } from '../services/riskAnalysisService.js';
import { auditService } from '../services/auditService.js';

const router = Router();

/**
 * List content submissions with filtering
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const { status, campaignId, channel, riskLevel, search } = req.query;

    let sql = `
      SELECT cs.*,
             u.full_name as author_name,
             c.name as campaign_name,
             c.code as campaign_code,
             rev.full_name as assigned_reviewer_name
      FROM content_submissions cs
      LEFT JOIN users u ON cs.author_id = u.id
      LEFT JOIN campaigns c ON cs.campaign_id = c.id
      LEFT JOIN users rev ON cs.assigned_reviewer_id = rev.id
      WHERE cs.org_id = $1
    `;
    const params: any[] = [orgId];

    if (status) {
      params.push(status);
      sql += ` AND cs.status = $${params.length}`;
    }

    if (campaignId) {
      params.push(campaignId);
      sql += ` AND cs.campaign_id = $${params.length}`;
    }

    if (channel) {
      params.push(channel);
      sql += ` AND cs.channel = $${params.length}`;
    }

    if (riskLevel) {
      params.push(riskLevel);
      sql += ` AND cs.risk_level = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (cs.title ILIKE $${params.length} OR cs.content_body ILIKE $${params.length})`;
    }

    sql += ' ORDER BY cs.created_at DESC';

    const result = await db.query(sql, params);
    res.json({ submissions: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch content submissions: ' + err.message });
  }
});

/**
 * Submit content (supports text directly, or file upload: PDF, images, TXT)
 */
router.post('/', authenticate, upload.single('attachment'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const authorId = req.user!.id;
    const { title, channel, campaign_id, auto_scan = 'true', submit_for_review = 'false' } = req.body;
    let content_body = req.body.content_body || '';

    let file_attachment_url: string | null = null;
    let file_type: string | null = null;

    if (req.file) {
      file_attachment_url = `/uploads/${req.file.filename}`;
      file_type = req.file.mimetype;

      if (!content_body || content_body.trim().length === 0) {
        content_body = await extractContentFromFile(req.file.path, req.file.originalname);
      }
    }

    if (!title || !channel || !content_body) {
      res.status(400).json({ error: 'Title, channel, and content body (or document file) are required.' });
      return;
    }

    const campaignIdVal = campaign_id && campaign_id !== 'none' && campaign_id !== '' ? campaign_id : null;
    const initialStatus = submit_for_review === 'true' || submit_for_review === true ? 'ready_for_review' : 'draft';

    const result = await db.query(
      `INSERT INTO content_submissions
        (org_id, campaign_id, author_id, title, channel, content_body, original_content_body,
         file_attachment_url, file_type, status, risk_score, risk_level, current_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 'low', 1)
       RETURNING *`,
      [
        orgId,
        campaignIdVal,
        authorId,
        title.trim(),
        channel.trim(),
        content_body.trim(),
        content_body.trim(),
        file_attachment_url,
        file_type,
        initialStatus,
      ]
    );

    const submission = result.rows[0];

    // Run automatic risk scan if requested
    let scanReport = null;
    if (auto_scan === 'true' || auto_scan === true) {
      try {
        scanReport = await riskAnalysisService.scanContent(submission.id, orgId, authorId, initialStatus === 'draft');
      } catch (scanErr: any) {
        console.warn('[AutoScan Warning]:', scanErr.message);
      }
    }

    // Snapshot version 1
    await riskAnalysisService.createRevisionSnapshot(
      submission.id,
      authorId,
      'Initial content creation (v1)'
    );

    await auditService.logEvent({
      orgId,
      userId: authorId,
      action: 'CONTENT_SUBMITTED',
      resourceType: 'content',
      resourceId: submission.id,
      details: { title: submission.title, channel: submission.channel, status: submission.status, version: 1 },
      ipAddress: req.ip,
    });

    const refreshed = await db.query('SELECT * FROM content_submissions WHERE id = $1', [submission.id]);

    res.status(201).json({
      submission: refreshed.rows[0],
      scanReport,
    });
  } catch (err: any) {
    console.error('[Content Submit Error]:', err);
    res.status(500).json({ error: 'Failed to create content submission: ' + err.message });
  }
});

/**
 * Get content submission details
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;

    const result = await db.query(
      `SELECT cs.*,
              u.full_name as author_name,
              u.email as author_email,
              c.name as campaign_name,
              c.code as campaign_code,
              rev.full_name as assigned_reviewer_name
       FROM content_submissions cs
       LEFT JOIN users u ON cs.author_id = u.id
       LEFT JOIN campaigns c ON cs.campaign_id = c.id
       LEFT JOIN users rev ON cs.assigned_reviewer_id = rev.id
       WHERE cs.id = $1 AND cs.org_id = $2`,
      [id, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }

    res.json({ submission: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch content submission: ' + err.message });
  }
});

/**
 * Run or re-run risk analysis scan on submission
 */
router.post('/:id/scan', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;

    const scanResult = await riskAnalysisService.scanContent(id, orgId, userId);
    const refreshed = await db.query('SELECT * FROM content_submissions WHERE id = $1', [id]);

    res.json({
      submission: refreshed.rows[0],
      scanReport: scanResult,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to execute risk scan: ' + err.message });
  }
});

/**
 * Submit content draft for human review (Draft / Analysis Complete -> Ready for Review)
 */
router.post('/:id/submit-for-review', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const userRole = req.user!.role;

    const result = await riskAnalysisService.transitionLifecycleState({
      contentId: id,
      targetStatus: 'ready_for_review',
      userId,
      userRole,
      orgId,
      notes: 'Submitted for human review by author',
    });

    res.json({
      success: true,
      message: 'Content draft submitted for human review.',
      submission: result.content,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * Update / Revise content submission text with automatic version snapshotting
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const userRole = req.user!.role;
    const { title, channel, content_body, campaign_id, status, change_summary } = req.body;

    const check = await db.query('SELECT * FROM content_submissions WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }
    const current = check.rows[0];

    // RBAC: Content creators can only edit their own submissions
    if (userRole === 'content_creator' && current.author_id !== userId) {
      res.status(403).json({ error: 'Forbidden: You are only authorized to revise your own content submissions.' });
      return;
    }

    // RBAC: Content creators cannot change status to 'approved' or 'rejected'
    if (userRole === 'content_creator' && (status === 'approved' || status === 'rejected')) {
      res.status(403).json({ error: 'Forbidden: Content creators cannot approve or reject content.' });
      return;
    }

    const campaignIdVal = campaign_id === 'none' ? null : campaign_id;
    const isBodyChanged = content_body && content_body.trim() !== current.content_body.trim();

    let newVersionNumber = current.current_version || 1;

    if (isBodyChanged) {
      // 1. Snapshot the existing version before modifying
      const existingVerCheck = await db.query(
        'SELECT id FROM content_versions WHERE content_id = $1 AND version_number = $2',
        [id, newVersionNumber]
      );
      if (existingVerCheck.rows.length === 0) {
        await riskAnalysisService.createRevisionSnapshot(id, userId, `Snapshot of v${newVersionNumber}`);
      }

      // 2. Increment version number for the new revision
      newVersionNumber += 1;
    }

    const newStatus = isBodyChanged ? 'analysis_pending' : (status || current.status);

    const updateRes = await db.query(
      `UPDATE content_submissions
       SET title = COALESCE($1, title),
           channel = COALESCE($2, channel),
           content_body = COALESCE($3, content_body),
           campaign_id = COALESCE($4, campaign_id),
           status = $5,
           current_version = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND org_id = $8
       RETURNING *`,
      [
        title ? title.trim() : null,
        channel || null,
        content_body ? content_body.trim() : null,
        campaignIdVal !== undefined ? campaignIdVal : null,
        newStatus,
        newVersionNumber,
        id,
        orgId,
      ]
    );

    let scanReport = null;
    if (isBodyChanged) {
      // Re-scan with explainable risk engine
      scanReport = await riskAnalysisService.scanContent(id, orgId, userId, true);

      // Snapshot the new revision (e.g. v2)
      await riskAnalysisService.createRevisionSnapshot(
        id,
        userId,
        change_summary || `Revised content draft (v${newVersionNumber})`
      );

      await auditService.logEvent({
        orgId,
        userId,
        action: 'CONTENT_REVISED',
        resourceType: 'content',
        resourceId: id,
        details: {
          previousVersion: current.current_version || 1,
          newVersion: newVersionNumber,
          previousRiskScore: current.risk_score,
          newRiskScore: scanReport.overall_risk_score,
          changeSummary: change_summary,
        },
      });
    }

    const refreshed = await db.query('SELECT * FROM content_submissions WHERE id = $1', [id]);
    res.json({
      submission: refreshed.rows[0],
      scanReport,
      version: newVersionNumber,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update content submission: ' + err.message });
  }
});

/**
 * Delete content submission
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;

    await db.query('DELETE FROM content_submissions WHERE id = $1 AND org_id = $2', [id, orgId]);
    res.json({ success: true, message: 'Content submission deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete content submission: ' + err.message });
  }
});

export default router;
