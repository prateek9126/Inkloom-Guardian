import { Router, Request, Response } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { policyLearningService } from '../services/policyLearningService.js';

const router = Router();

/**
 * Get high-level policy learning summary metrics
 */
router.get('/summary', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const summary = await policyLearningService.getPolicyLearningSummary(orgId);
    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve policy learning summary: ' + err.message });
  }
});

/**
 * Get frequently violated brand rules with acceptance rates
 */
router.get('/frequently-violated', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const stats = await policyLearningService.getFrequentlyViolatedRules(orgId);
    res.json({ rules: stats });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve frequently violated rules: ' + err.message });
  }
});

/**
 * Get approved correction examples based on past reviewer approvals
 * Explicitly distinguishes reviewer preference from factual evidence.
 */
router.get('/approved-examples', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const ruleId = req.query.ruleId as string | undefined;
    const queryText = req.query.queryText as string | undefined;

    const samples = await policyLearningService.getApprovedCorrectionExamples(orgId, ruleId, queryText);
    res.json({
      samples,
      disclaimer:
        'Observed reviewer decisions reflect corporate stylistic conventions and reviewer consensus. Past approval does not constitute proof of factual accuracy.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve approved examples: ' + err.message });
  }
});

/**
 * Get recurring content quality problems
 */
router.get('/recurring-issues', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const issues = await policyLearningService.getRecurringQualityProblems(orgId);
    res.json({ issues });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve recurring quality issues: ' + err.message });
  }
});

/**
 * Get candidate policy recommendations
 */
router.get('/recommendations', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const status = req.query.status as string | undefined;

    let sql = `
      SELECT pcr.*, u.full_name as reviewer_name
      FROM policy_candidate_recommendations pcr
      LEFT JOIN users u ON pcr.reviewed_by = u.id
      WHERE pcr.org_id = $1
    `;
    const params: any[] = [orgId];

    if (status) {
      params.push(status);
      sql += ` AND pcr.status = $${params.length}`;
    }

    sql += ` ORDER BY pcr.created_at DESC`;

    const result = await (await import('../db/db.js')).db.query(sql, params);
    res.json({ recommendations: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch candidate recommendations: ' + err.message });
  }
});

/**
 * Generate candidate policy recommendations based on accumulated feedback
 * Accessible to admins and brand managers.
 */
router.post(
  '/recommendations/generate',
  authenticate,
  authorizeRoles('admin', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.org_id;
      const userId = req.user!.id;

      const generated = await policyLearningService.generateCandidateRecommendations(orgId, userId);
      res.json({
        success: true,
        generatedCount: generated.length,
        recommendations: generated,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to generate recommendations: ' + err.message });
    }
  }
);

/**
 * Approve a candidate policy recommendation
 * STRICT CONSTRAINT: Authorized Admin or Brand Manager only.
 * Versions the target guideline or creates a new versioned rule.
 */
router.post(
  '/recommendations/:id/approve',
  authenticate,
  authorizeRoles('admin', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.org_id;
      const userId = req.user!.id;
      const { reviewNotes } = req.body;

      const result = await policyLearningService.approveCandidateRecommendation({
        recommendationId: id,
        orgId,
        adminUserId: userId,
        reviewNotes,
      });

      res.json({
        success: true,
        message: 'Policy recommendation approved and guideline versioned successfully.',
        recommendation: result.recommendation,
        updatedRule: result.updatedRule,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * Reject a candidate policy recommendation
 */
router.post(
  '/recommendations/:id/reject',
  authenticate,
  authorizeRoles('admin', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.org_id;
      const userId = req.user!.id;
      const { reviewNotes } = req.body;

      const rejected = await policyLearningService.rejectCandidateRecommendation({
        recommendationId: id,
        orgId,
        adminUserId: userId,
        reviewNotes,
      });

      res.json({
        success: true,
        message: 'Policy recommendation rejected.',
        recommendation: rejected,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * Record reviewer feedback manually or from review workflows
 */
router.post(
  '/feedback',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.org_id;
      const reviewerId = req.user!.id;
      const {
        submissionId,
        ruleId,
        ruleTitle,
        decisionType,
        originalText,
        suggestedCorrection,
        finalCorrection,
        reviewerNotes,
        contentCategory,
        isConfidential,
        retentionPolicyDays,
      } = req.body;

      if (!ruleTitle || !decisionType || !originalText) {
        res.status(400).json({
          error: 'ruleTitle, decisionType, and originalText are required.',
        });
        return;
      }

      const record = await policyLearningService.recordReviewerFeedback({
        orgId,
        submissionId,
        ruleId,
        ruleTitle,
        decisionType,
        originalText,
        suggestedCorrection,
        finalCorrection,
        reviewerId,
        reviewerNotes,
        contentCategory,
        isConfidential: Boolean(isConfidential),
        retentionPolicyDays: retentionPolicyDays ? parseInt(retentionPolicyDays, 10) : 365,
      });

      res.status(201).json({ success: true, record });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * List feedback records for administrator inspection
 */
router.get(
  '/feedback',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.user!.org_id;
      const { decisionType, status, ruleId, limit, offset } = req.query;

      const result = await policyLearningService.listFeedbackRecords(orgId, {
        decisionType: decisionType as string,
        status: status as string,
        ruleId: ruleId as string,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to list feedback records: ' + err.message });
    }
  }
);

/**
 * Update/correct a feedback record (Admin inspection)
 */
router.patch(
  '/feedback/:id',
  authenticate,
  authorizeRoles('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.org_id;
      const adminUserId = req.user!.id;
      const { reviewerNotes, status } = req.body;

      const updated = await policyLearningService.updateFeedbackRecord({
        feedbackId: id,
        orgId,
        adminUserId,
        reviewerNotes,
        status,
      });

      res.json({ success: true, record: updated });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

/**
 * Purge a feedback record per data retention policy (Admin only)
 */
router.delete(
  '/feedback/:id',
  authenticate,
  authorizeRoles('admin'),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const orgId = req.user!.org_id;
      const adminUserId = req.user!.id;
      const { reason } = req.body;

      if (!reason) {
        res.status(400).json({ error: 'Reason is required when purging feedback records.' });
        return;
      }

      await policyLearningService.purgeFeedbackRecord({
        feedbackId: id,
        orgId,
        adminUserId,
        reason,
      });

      res.json({ success: true, message: 'Feedback record successfully purged per retention policy.' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

export default router;
