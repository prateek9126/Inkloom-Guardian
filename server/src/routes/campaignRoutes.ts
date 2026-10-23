import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate } from '../middleware/auth.js';
import { auditService } from '../services/auditService.js';

const router = Router();

/**
 * List campaigns with linked asset metrics
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;

    const result = await db.query(
      `SELECT c.*,
              COUNT(cs.id)::int as content_count,
              COALESCE(AVG(cs.risk_score), 0)::int as avg_risk_score
       FROM campaigns c
       LEFT JOIN content_submissions cs ON c.id = cs.campaign_id
       WHERE c.org_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [orgId]
    );

    res.json({ campaigns: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campaigns: ' + err.message });
  }
});

/**
 * Create campaign
 */
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const { name, code, description, target_channels, status = 'active' } = req.body;

    if (!name || !code || !description) {
      res.status(400).json({ error: 'Campaign name, code, and description are required.' });
      return;
    }

    const channelsArray = Array.isArray(target_channels)
      ? target_channels
      : (target_channels || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    const result = await db.query(
      `INSERT INTO campaigns (org_id, name, code, description, target_channels, status, consistency_score)
       VALUES ($1, $2, $3, $4, $5, $6, 100)
       RETURNING *`,
      [orgId, name.trim(), code.trim().toUpperCase(), description.trim(), channelsArray, status]
    );

    const campaign = result.rows[0];

    await auditService.logEvent({
      orgId,
      userId,
      action: 'CAMPAIGN_CREATED',
      resourceType: 'campaign',
      resourceId: campaign.id,
      details: { name: campaign.name, code: campaign.code },
      ipAddress: req.ip,
    });

    res.status(201).json({ campaign });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create campaign: ' + err.message });
  }
});

/**
 * Get single campaign with linked content assets and cross-channel consistency analysis
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;

    const campaignRes = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND org_id = $2',
      [id, orgId]
    );

    if (campaignRes.rows.length === 0) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }

    const campaign = campaignRes.rows[0];

    // Fetch linked assets
    const assetsRes = await db.query(
      `SELECT cs.*, u.full_name as author_name
       FROM content_submissions cs
       LEFT JOIN users u ON cs.author_id = u.id
       WHERE cs.campaign_id = $1 AND cs.org_id = $2
       ORDER BY cs.created_at DESC`,
      [id, orgId]
    );

    // Cross-channel analysis calculation
    const assets = assetsRes.rows;
    const channelsRepresented = new Set(assets.map(a => a.channel));
    const targetChannels = campaign.target_channels || [];

    const missingChannels = targetChannels.filter((c: string) => !channelsRepresented.has(c));
    const averageRisk = assets.length > 0
      ? Math.round(assets.reduce((acc, a) => acc + (a.risk_score || 0), 0) / assets.length)
      : 0;

    const consistencyScore = Math.max(20, 100 - (missingChannels.length * 15) - Math.round(averageRisk * 0.4));

    res.json({
      campaign,
      assets,
      consistencyAnalysis: {
        targetChannels,
        activeChannels: Array.from(channelsRepresented),
        missingChannels,
        averageRiskScore: averageRisk,
        computedConsistencyScore: consistencyScore,
        totalAssets: assets.length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch campaign details: ' + err.message });
  }
});

/**
 * Update campaign
 */
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const orgId = req.user!.org_id;
    const { name, code, description, target_channels, status, consistency_score } = req.body;

    const check = await db.query('SELECT * FROM campaigns WHERE id = $1 AND org_id = $2', [id, orgId]);
    if (check.rows.length === 0) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }

    const result = await db.query(
      `UPDATE campaigns
       SET name = COALESCE($1, name),
           code = COALESCE($2, code),
           description = COALESCE($3, description),
           target_channels = COALESCE($4, target_channels),
           status = COALESCE($5, status),
           consistency_score = COALESCE($6, consistency_score),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND org_id = $8
       RETURNING *`,
      [
        name ? name.trim() : null,
        code ? code.trim().toUpperCase() : null,
        description ? description.trim() : null,
        target_channels ? (Array.isArray(target_channels) ? target_channels : [target_channels]) : null,
        status || null,
        consistency_score !== undefined ? consistency_score : null,
        id,
        orgId,
      ]
    );

    res.json({ campaign: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update campaign: ' + err.message });
  }
});

export default router;
