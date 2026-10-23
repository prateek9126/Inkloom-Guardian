import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { campaignConsistencyService } from '../services/campaignConsistencyService.js';

const router = Router();

/**
 * Get Cross-Campaign Consistency Analysis for a campaign
 * Includes extracted facts, detected contradictions, and transparent score breakdown.
 */
router.get('/:campaignId', authenticate, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const orgId = req.user!.org_id;

    // Verify campaign existence and tenant isolation
    const campRes = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND org_id = $2',
      [campaignId, orgId]
    );

    if (campRes.rows.length === 0) {
      res.status(404).json({ error: 'Campaign not found or does not belong to your organization.' });
      return;
    }
    const campaign = campRes.rows[0];

    // Check if facts/contradictions exist. If none, auto-run initial scan
    const factsRes = await db.query(
      `SELECT cf.*, cs.title as asset_title, cs.channel
       FROM campaign_facts cf
       JOIN content_submissions cs ON cf.asset_id = cs.id
       WHERE cf.campaign_id = $1
       ORDER BY cf.created_at ASC`,
      [campaignId]
    );

    let facts = factsRes.rows;
    let contradictions: any[] = [];
    let scoreBreakdown: any = null;

    if (facts.length === 0) {
      // Run initial analysis
      const result = await campaignConsistencyService.analyzeCampaignConsistency(
        campaignId,
        orgId,
        req.user!.id
      );
      facts = result.facts;
      contradictions = result.contradictions;
      scoreBreakdown = result.scoreBreakdown;
    } else {
      const contraRes = await db.query(
        `SELECT cc.*, u.full_name as resolved_by_name
         FROM campaign_contradictions cc
         LEFT JOIN users u ON cc.resolved_by = u.id
         WHERE cc.campaign_id = $1
         ORDER BY 
           CASE cc.severity 
             WHEN 'critical' THEN 1 
             WHEN 'high' THEN 2 
             WHEN 'medium' THEN 3 
             ELSE 4 
           END,
           cc.created_at DESC`,
        [campaignId]
      );
      contradictions = contraRes.rows.map(c => ({
        ...c,
        conflicting_assets: typeof c.conflicting_assets === 'string' ? JSON.parse(c.conflicting_assets) : c.conflicting_assets,
      }));

      const scoreRes = await db.query(
        'SELECT * FROM campaign_consistency_scores WHERE campaign_id = $1',
        [campaignId]
      );
      if (scoreRes.rows.length > 0) {
        const rawBreakdown = scoreRes.rows[0].formula_breakdown;
        scoreBreakdown = typeof rawBreakdown === 'string' ? JSON.parse(rawBreakdown) : rawBreakdown;
      } else {
        const assetsRes = await db.query(
          'SELECT * FROM content_submissions WHERE campaign_id = $1 AND org_id = $2',
          [campaignId, orgId]
        );
        scoreBreakdown = campaignConsistencyService.calculateConsistencyScore(
          contradictions,
          campaign.target_channels,
          assetsRes.rows
        );
      }
    }

    res.json({
      campaign,
      facts,
      contradictions,
      scoreBreakdown,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve campaign consistency data: ' + err.message });
  }
});

/**
 * Trigger an on-demand Cross-Campaign Consistency Scan across all campaign assets
 */
router.post('/:campaignId/scan', authenticate, async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;

    const result = await campaignConsistencyService.analyzeCampaignConsistency(
      campaignId,
      orgId,
      userId
    );

    res.json({
      success: true,
      message: 'Cross-Campaign Consistency Scan completed successfully.',
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Consistency scan failed: ' + err.message });
  }
});

/**
 * Human Reviewer Action on an identified Contradiction
 * (resolve / exception / escalate)
 */
router.post('/contradictions/:contradictionId/review', authenticate, async (req: Request, res: Response) => {
  try {
    const { contradictionId } = req.params;
    const { action, notes } = req.body;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;

    if (!['resolve', 'exception', 'escalate'].includes(action)) {
      res.status(400).json({
        error: "Invalid action. Must be one of: 'resolve', 'exception', 'escalate'.",
      });
      return;
    }

    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      res.status(400).json({
        error: 'Reviewer justification notes are required for brand audit compliance.',
      });
      return;
    }

    const updated = await campaignConsistencyService.reviewContradiction(
      contradictionId,
      action as 'resolve' | 'exception' | 'escalate',
      notes,
      userId,
      orgId
    );

    res.json({
      success: true,
      message: `Contradiction marked as ${action}d successfully.`,
      contradiction: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to review contradiction: ' + err.message });
  }
});

/**
 * Get Review Audit Trail for a specific contradiction
 */
router.get('/contradictions/:contradictionId/history', authenticate, async (req: Request, res: Response) => {
  try {
    const { contradictionId } = req.params;
    const orgId = req.user!.org_id;

    // Tenant check
    const contraCheck = await db.query(
      `SELECT cc.id FROM campaign_contradictions cc
       JOIN campaigns c ON cc.campaign_id = c.id
       WHERE cc.id = $1 AND c.org_id = $2`,
      [contradictionId, orgId]
    );

    if (contraCheck.rows.length === 0) {
      res.status(404).json({ error: 'Contradiction not found.' });
      return;
    }

    const historyRes = await db.query(
      `SELECT cra.*, u.full_name as user_name, u.email as user_email
       FROM campaign_review_actions cra
       JOIN users u ON cra.user_id = u.id
       WHERE cra.contradiction_id = $1
       ORDER BY cra.created_at DESC`,
      [contradictionId]
    );

    res.json({ history: historyRes.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch review history: ' + err.message });
  }
});

export default router;
