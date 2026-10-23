import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { riskAnalysisService } from '../services/riskAnalysisService.js';
import { auditService } from '../services/auditService.js';
import { SubmissionStatus } from '../types/index.js';

const router = Router();

/**
 * List submissions awaiting human review
 */
router.get('/pending', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;

    const result = await db.query(
      `SELECT cs.*,
              u.full_name as author_name,
              c.name as campaign_name,
              c.code as campaign_code,
              rr.overall_risk_score,
              rr.risk_category,
              rr.tone_score,
              rr.claims_score,
              rr.compliance_score,
              rev.full_name as assigned_reviewer_name
       FROM content_submissions cs
       LEFT JOIN users u ON cs.author_id = u.id
       LEFT JOIN campaigns c ON cs.campaign_id = c.id
       LEFT JOIN risk_reports rr ON cs.id = rr.content_id
       LEFT JOIN users rev ON cs.assigned_reviewer_id = rev.id
       WHERE cs.org_id = $1 AND cs.status IN ('ready_for_review', 'pending_review', 'needs_revision', 'revision_requested', 'analysis_complete')
       ORDER BY cs.risk_score DESC, cs.created_at ASC`,
      [orgId]
    );

    res.json({ pendingReviews: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch pending reviews: ' + err.message });
  }
});

/**
 * Submit human review decision (approved / rejected / needs_revision)
 */
router.post(
  '/decision',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.org_id;
      const reviewerId = req.user!.id;
      const reviewerRole = req.user!.role;
      const { content_id, decision, feedback_notes, conditions } = req.body;

      if (!content_id || !decision || !feedback_notes) {
        res.status(400).json({
          error: 'content_id, decision (approved/rejected/needs_revision), and feedback_notes are required.',
        });
        return;
      }

      const validDecisions: SubmissionStatus[] = ['approved', 'rejected', 'needs_revision'];
      if (!validDecisions.includes(decision)) {
        res.status(400).json({
          error: `Invalid decision "${decision}". Must be one of: [approved, rejected, needs_revision].`,
        });
        return;
      }

      const result = await riskAnalysisService.transitionLifecycleState({
        contentId: content_id,
        targetStatus: decision,
        userId: reviewerId,
        userRole: reviewerRole,
        orgId,
        notes: feedback_notes,
        conditions,
      });

      res.status(200).json({
        success: true,
        message: `Review decision "${decision}" recorded successfully.`,
        content: result.content,
        approval: result.reviewApproval,
      });
    } catch (err: any) {
      console.error('[Review Submit Error]:', err);
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * Backward-compatible endpoint for POST /reviews
 */
router.post(
  '/',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.org_id;
      const reviewerId = req.user!.id;
      const reviewerRole = req.user!.role;
      let { content_id, decision, feedback_notes, conditions } = req.body;

      if (decision === 'revision_requested') decision = 'needs_revision';

      const result = await riskAnalysisService.transitionLifecycleState({
        contentId: content_id,
        targetStatus: decision,
        userId: reviewerId,
        userRole: reviewerRole,
        orgId,
        notes: feedback_notes,
        conditions,
      });

      res.status(201).json({
        approval: result.reviewApproval,
        updatedStatus: decision,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * Assign reviewer to a content submission
 */
router.post(
  '/assign',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.org_id;
      const { content_id, reviewer_id } = req.body;

      if (!content_id) {
        res.status(400).json({ error: 'content_id is required.' });
        return;
      }

      const contentCheck = await db.query(
        'SELECT id, title FROM content_submissions WHERE id = $1 AND org_id = $2',
        [content_id, orgId]
      );
      if (contentCheck.rows.length === 0) {
        res.status(404).json({ error: 'Content submission not found.' });
        return;
      }

      let reviewerName = 'Unassigned';
      if (reviewer_id) {
        const revCheck = await db.query(
          'SELECT id, full_name FROM users WHERE id = $1 AND org_id = $2',
          [reviewer_id, orgId]
        );
        if (revCheck.rows.length === 0) {
          res.status(404).json({ error: 'Reviewer user not found in organization.' });
          return;
        }
        reviewerName = revCheck.rows[0].full_name;
      }

      await db.query(
        'UPDATE content_submissions SET assigned_reviewer_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [reviewer_id || null, content_id]
      );

      await auditService.logEvent({
        orgId,
        userId: req.user!.id,
        action: 'REVIEWER_ASSIGNED',
        resourceType: 'content',
        resourceId: content_id,
        details: { reviewerId: reviewer_id, reviewerName },
      });

      res.json({ success: true, assigned_reviewer_id: reviewer_id, reviewerName });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to assign reviewer: ' + err.message });
    }
  }
);

/**
 * Add a reviewer comment / note to a content submission
 */
router.post('/comments/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const { comment_text, is_internal_only = false } = req.body;

    if (!comment_text || typeof comment_text !== 'string' || comment_text.trim().length === 0) {
      res.status(400).json({ error: 'comment_text is required.' });
      return;
    }

    const check = await db.query(
      'SELECT id FROM content_submissions WHERE id = $1 AND org_id = $2',
      [contentId, orgId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }

    const commentRes = await db.query(
      `INSERT INTO submission_comments (content_id, user_id, comment_text, is_internal_only)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [contentId, userId, comment_text.trim(), !!is_internal_only]
    );

    const userRes = await db.query('SELECT full_name, role, email FROM users WHERE id = $1', [userId]);

    res.status(201).json({
      comment: {
        ...commentRes.rows[0],
        user_name: userRes.rows[0].full_name,
        user_role: userRes.rows[0].role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to post comment: ' + err.message });
  }
});

/**
 * Get all reviewer comments for a content submission
 */
router.get('/comments/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const orgId = req.user!.org_id;

    const check = await db.query(
      'SELECT id FROM content_submissions WHERE id = $1 AND org_id = $2',
      [contentId, orgId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }

    const result = await db.query(
      `SELECT sc.*, u.full_name as user_name, u.role as user_role, u.email as user_email
       FROM submission_comments sc
       JOIN users u ON sc.user_id = u.id
       WHERE sc.content_id = $1
       ORDER BY sc.created_at ASC`,
      [contentId]
    );

    res.json({ comments: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch comments: ' + err.message });
  }
});

/**
 * Get complete review decisions history and audit trail for a content submission
 */
router.get('/history/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const orgId = req.user!.org_id;

    const contentCheck = await db.query(
      'SELECT id, title, current_version FROM content_submissions WHERE id = $1 AND org_id = $2',
      [contentId, orgId]
    );

    if (contentCheck.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }

    const historyRes = await db.query(
      `SELECT ra.*, u.full_name as reviewer_name, u.role as reviewer_role, u.email as reviewer_email
       FROM review_approvals ra
       LEFT JOIN users u ON ra.reviewer_id = u.id
       WHERE ra.content_id = $1
       ORDER BY ra.created_at DESC`,
      [contentId]
    );

    const auditRes = await db.query(
      `SELECT al.*, u.full_name as user_name, u.role as user_role
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.resource_type = 'content' AND al.resource_id = $1 AND al.org_id = $2
       ORDER BY al.created_at DESC`,
      [contentId, orgId]
    );

    res.json({
      history: historyRes.rows,
      auditLogs: auditRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch review history: ' + err.message });
  }
});

/**
 * List all saved revision versions of a submission
 */
router.get('/versions/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const orgId = req.user!.org_id;

    const check = await db.query(
      'SELECT id, current_version FROM content_submissions WHERE id = $1 AND org_id = $2',
      [contentId, orgId]
    );
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }

    const versionsRes = await db.query(
      `SELECT cv.*, u.full_name as created_by_name
       FROM content_versions cv
       LEFT JOIN users u ON cv.created_by = u.id
       WHERE cv.content_id = $1
       ORDER BY cv.version_number DESC`,
      [contentId]
    );

    res.json({ versions: versionsRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch version history: ' + err.message });
  }
});

export default router;
