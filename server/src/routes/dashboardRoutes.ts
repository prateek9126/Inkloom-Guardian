import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;

    // 1. Pending reviews count (ready for review + legacy pending_review)
    const pendingRes = await db.query(
      `SELECT COUNT(*)::int as count FROM content_submissions WHERE org_id = $1 AND status IN ('ready_for_review', 'pending_review')`,
      [orgId]
    );

    // 1b. Lifecycle status breakdown
    const lifecycleRes = await db.query(
      `SELECT status, COUNT(*)::int as count 
       FROM content_submissions 
       WHERE org_id = $1 
       GROUP BY status`,
      [orgId]
    );
    const lifecycleBreakdown = {
      readyForReview: 0,
      needsRevision: 0,
      analysisPending: 0,
      analysisComplete: 0,
      approved: 0,
      rejected: 0,
      draft: 0,
    };
    for (const row of lifecycleRes.rows) {
      if (row.status === 'ready_for_review' || row.status === 'pending_review') {
        lifecycleBreakdown.readyForReview += row.count;
      } else if (row.status === 'needs_revision' || row.status === 'revision_requested') {
        lifecycleBreakdown.needsRevision += row.count;
      } else if (row.status === 'analysis_pending') {
        lifecycleBreakdown.analysisPending += row.count;
      } else if (row.status === 'analysis_complete') {
        lifecycleBreakdown.analysisComplete += row.count;
      } else if (row.status === 'approved') {
        lifecycleBreakdown.approved += row.count;
      } else if (row.status === 'rejected') {
        lifecycleBreakdown.rejected += row.count;
      } else if (row.status === 'draft') {
        lifecycleBreakdown.draft += row.count;
      }
    }

    // 2. Verified claims count
    const claimsRes = await db.query(
      `SELECT COUNT(*)::int as count FROM approved_claims WHERE org_id = $1 AND verification_status = 'verified'`,
      [orgId]
    );

    // 3. Active guidelines count
    const guidelinesRes = await db.query(
      `SELECT COUNT(*)::int as count FROM brand_guidelines WHERE org_id = $1 AND is_active = true`,
      [orgId]
    );

    // 4. Active campaigns count
    const campaignsRes = await db.query(
      `SELECT COUNT(*)::int as count FROM campaigns WHERE org_id = $1 AND status = 'active'`,
      [orgId]
    );

    // 5. Total recent approvals
    const approvalsRes = await db.query(
      `SELECT COUNT(*)::int as count 
       FROM review_approvals ra
       JOIN content_submissions cs ON ra.content_id = cs.id
       WHERE cs.org_id = $1 AND ra.decision = 'approved'`,
      [orgId]
    );

    // 6. Unresolved risk issues count
    const reportsRes = await db.query(
      `SELECT rr.violations
       FROM risk_reports rr
       JOIN content_submissions cs ON rr.content_id = cs.id
       WHERE cs.org_id = $1`,
      [orgId]
    );

    let unresolvedIssuesCount = 0;
    for (const row of reportsRes.rows) {
      const violations = Array.isArray(row.violations) ? row.violations : [];
      unresolvedIssuesCount += violations.filter((v: any) => v.status === 'unresolved').length;
    }

    // 7. Risk level breakdown
    const riskBreakdownRes = await db.query(
      `SELECT risk_level, COUNT(*)::int as count
       FROM content_submissions
       WHERE org_id = $1
       GROUP BY risk_level`,
      [orgId]
    );

    const riskBreakdown: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const r of riskBreakdownRes.rows) {
      if (riskBreakdown[r.risk_level] !== undefined) {
        riskBreakdown[r.risk_level] = r.count;
      }
    }

    // 8. Recent Submissions (awaiting review or recently processed)
    const recentSubmissionsRes = await db.query(
      `SELECT cs.id, cs.title, cs.channel, cs.status, cs.risk_score, cs.risk_level, 
              COALESCE(cs.current_version, 1) as current_version, cs.assigned_reviewer_id, cs.created_at,
              u.full_name as author_name, c.name as campaign_name,
              rev.full_name as reviewer_name
       FROM content_submissions cs
       LEFT JOIN users u ON cs.author_id = u.id
       LEFT JOIN users rev ON cs.assigned_reviewer_id = rev.id
       LEFT JOIN campaigns c ON cs.campaign_id = c.id
       WHERE cs.org_id = $1
       ORDER BY cs.created_at DESC
       LIMIT 8`,
      [orgId]
    );

    // 9. Recent Audit Log Activity
    const recentActivityRes = await db.query(
      `SELECT a.id, a.action, a.resource_type, a.resource_id, a.details, a.created_at,
              u.full_name as user_name, u.role as user_role
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       WHERE a.org_id = $1
       ORDER BY a.created_at DESC
       LIMIT 8`,
      [orgId]
    );

    res.json({
      metrics: {
        pendingReviewsCount: pendingRes.rows[0]?.count || 0,
        verifiedClaimsCount: claimsRes.rows[0]?.count || 0,
        unresolvedIssuesCount,
        activeGuidelinesCount: guidelinesRes.rows[0]?.count || 0,
        activeCampaignsCount: campaignsRes.rows[0]?.count || 0,
        totalApprovalsCount: approvalsRes.rows[0]?.count || 0,
        riskBreakdown,
        lifecycleBreakdown,
      },
      recentSubmissions: recentSubmissionsRes.rows,
      recentActivity: recentActivityRes.rows,
    });
  } catch (err: any) {
    console.error('[Dashboard Stats Error]:', err);
    res.status(500).json({ error: 'Failed to retrieve dashboard stats: ' + err.message });
  }
});

export default router;
