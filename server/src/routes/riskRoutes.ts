import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { riskAnalysisService, DEFAULT_RISK_CONFIG } from '../services/riskAnalysisService.js';
import { auditService } from '../services/auditService.js';

const router = Router();

/**
 * Get organization's risk scoring configuration
 */
router.get('/config', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const config = await riskAnalysisService.getScoringConfig(orgId);
    res.json({ config });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch scoring configuration: ' + err.message });
  }
});

/**
 * Update organization's risk scoring configuration (Admin only)
 */
router.put('/config', authenticate, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const { config } = req.body;

    if (!config || typeof config !== 'object') {
      res.status(400).json({ error: 'Valid config object is required.' });
      return;
    }

    const mergedConfig = {
      ...DEFAULT_RISK_CONFIG,
      ...config,
    };

    await db.query(
      `UPDATE system_settings
       SET risk_scoring_config = $1, updated_at = CURRENT_TIMESTAMP
       WHERE org_id = $2`,
      [JSON.stringify(mergedConfig), orgId]
    );

    await auditService.logEvent({
      orgId,
      userId: req.user!.id,
      action: 'RISK_SCORING_CONFIG_UPDATED',
      resourceType: 'system_settings',
      resourceId: orgId,
      details: { updatedKeys: Object.keys(config) },
      ipAddress: req.ip,
    });

    res.json({ success: true, config: mergedConfig });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update scoring configuration: ' + err.message });
  }
});

/**
 * Get detailed explainable risk analysis report for a content piece
 */
router.get('/report/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const orgId = req.user!.org_id;

    // Verify ownership
    const contentRes = await db.query(
      `SELECT cs.*, u.full_name as author_name, c.name as campaign_name, c.code as campaign_code,
              rev.full_name as assigned_reviewer_name
       FROM content_submissions cs
       LEFT JOIN users u ON cs.author_id = u.id
       LEFT JOIN campaigns c ON cs.campaign_id = c.id
       LEFT JOIN users rev ON cs.assigned_reviewer_id = rev.id
       WHERE cs.id = $1 AND cs.org_id = $2`,
      [contentId, orgId]
    );

    if (contentRes.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }

    const content = contentRes.rows[0];

    const reportRes = await db.query(
      'SELECT * FROM risk_reports WHERE content_id = $1 ORDER BY created_at DESC LIMIT 1',
      [contentId]
    );

    if (reportRes.rows.length === 0) {
      // Auto-scan if no report generated yet
      const scanReport = await riskAnalysisService.scanContent(contentId, orgId, req.user!.id);
      res.json({
        content,
        report: scanReport,
      });
      return;
    }

    const report = reportRes.rows[0];

    // Safe JSON parser helper
    const parseField = (val: any, fallback: any) => {
      if (!val) return fallback;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return fallback; }
      }
      return val;
    };

    res.json({
      content,
      report: {
        ...report,
        violations: parseField(report.violations, []),
        unsubstantiated_claims: parseField(report.unsubstantiated_claims, []),
        suggested_disclaimers: parseField(report.suggested_disclaimers, []),
        contributing_issues: parseField(report.contributing_issues, []),
        unresolved_uncertainties: parseField(report.unresolved_uncertainties, []),
        remediation_steps: parseField(report.remediation_steps, []),
        scoring_formula_breakdown: parseField(report.scoring_formula_breakdown, null),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch risk report: ' + err.message });
  }
});

/**
 * Trigger an on-demand explainable risk scan
 */
router.post('/scan/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;

    const report = await riskAnalysisService.scanContent(contentId, orgId, userId);
    const contentRes = await db.query('SELECT * FROM content_submissions WHERE id = $1', [contentId]);

    res.json({
      success: true,
      content: contentRes.rows[0],
      report,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Risk scan failed: ' + err.message });
  }
});

/**
 * Risk Reduction Comparison between two revision versions
 */
router.get('/compare/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const { old = '1', new: newVer } = req.query;
    const orgId = req.user!.org_id;

    // Check ownership
    const contentRes = await db.query(
      'SELECT id, current_version FROM content_submissions WHERE id = $1 AND org_id = $2',
      [contentId, orgId]
    );

    if (contentRes.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }

    const currentVer = contentRes.rows[0].current_version || 1;
    const oldVersionNum = parseInt(String(old), 10);
    const newVersionNum = newVer ? parseInt(String(newVer), 10) : currentVer;

    const comparison = await riskAnalysisService.compareRevisions(contentId, oldVersionNum, newVersionNum);
    res.json({ comparison });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to generate revision comparison: ' + err.message });
  }
});

/**
 * Update individual violation status (e.g. accepted fix, ignored with reason)
 */
router.patch('/violations/:contentId/:violationId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId, violationId } = req.params;
    const { status, justification } = req.body;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;

    const reportRes = await db.query(
      `SELECT rr.* FROM risk_reports rr
       JOIN content_submissions cs ON rr.content_id = cs.id
       WHERE rr.content_id = $1 AND cs.org_id = $2`,
      [contentId, orgId]
    );

    if (reportRes.rows.length === 0) {
      res.status(404).json({ error: 'Risk report not found.' });
      return;
    }

    const report = reportRes.rows[0];
    const violations = Array.isArray(report.violations) ? report.violations : JSON.parse(report.violations || '[]');

    const violationIndex = violations.findIndex((v: any) => v.id === violationId);
    if (violationIndex === -1) {
      res.status(404).json({ error: 'Violation finding not found in this report.' });
      return;
    }

    violations[violationIndex].status = status;
    if (justification) {
      violations[violationIndex].justification = justification;
    }

    await db.query(
      'UPDATE risk_reports SET violations = $1 WHERE id = $2',
      [JSON.stringify(violations), report.id]
    );

    // Re-evaluate explainable risk score since violation status changed (e.g. accepted fix removes penalty!)
    const updatedReport = await riskAnalysisService.scanContent(contentId, orgId, userId, false);

    res.json({
      success: true,
      updatedViolation: violations[violationIndex],
      newRiskScore: updatedReport.overall_risk_score,
      newRiskCategory: updatedReport.risk_category,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update violation finding: ' + err.message });
  }
});

export default router;
