import { Router, Request, Response } from 'express';
import { db } from '../db/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { claimVerificationService } from '../services/claimVerificationService.js';
import { auditService } from '../services/auditService.js';

const router = Router();

/**
 * Get verified claims and evidence graph for a content submission
 */
router.get('/content/:contentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const orgId = req.user!.org_id;

    // Verify content ownership
    const contentRes = await db.query(
      `SELECT cs.*, u.full_name as author_name, c.name as campaign_name
       FROM content_submissions cs
       LEFT JOIN users u ON cs.author_id = u.id
       LEFT JOIN campaigns c ON cs.campaign_id = c.id
       WHERE cs.id = $1 AND cs.org_id = $2`,
      [contentId, orgId]
    );

    if (contentRes.rows.length === 0) {
      res.status(404).json({ error: 'Content submission not found.' });
      return;
    }
    const content = contentRes.rows[0];

    // Fetch extracted claims with joined passage & document details
    const claimsRes = await db.query(
      `SELECT ec.*,
              sp.page_number, sp.section_header, sp.content as passage_content,
              es.id as document_id, es.title as document_title, es.version as document_version,
              es.document_type, es.is_outdated as document_is_outdated,
              bg.title as matched_rule_title, bg.severity as matched_rule_severity,
              u.full_name as reviewer_name
       FROM extracted_claims ec
       LEFT JOIN source_passages sp ON ec.matched_passage_id = sp.id
       LEFT JOIN evidence_sources es ON sp.document_id = es.id
       LEFT JOIN brand_guidelines bg ON ec.matched_rule_id = bg.id
       LEFT JOIN users u ON ec.reviewed_by = u.id
       WHERE ec.content_id = $1
       ORDER BY ec.created_at ASC`,
      [contentId]
    );

    const claims = claimsRes.rows.map(r => ({
      ...r,
      confidence_score: parseFloat(r.confidence_score),
      matched_passage: r.matched_passage_id ? {
        id: r.matched_passage_id,
        document_id: r.document_id,
        document_title: r.document_title,
        document_version: r.document_version,
        document_type: r.document_type,
        is_outdated: r.document_is_outdated,
        page_number: r.page_number,
        section_header: r.section_header,
        content: r.passage_content,
      } : null,
    }));

    // Fetch passages for graph
    const passagesRes = await db.query(
      `SELECT sp.*, es.title as document_title, es.document_type, es.version as document_version, es.is_outdated
       FROM source_passages sp
       JOIN evidence_sources es ON sp.document_id = es.id
       WHERE es.org_id = $1`,
      [orgId]
    );

    const rulesRes = await db.query('SELECT * FROM brand_guidelines WHERE org_id = $1', [orgId]);

    const evidenceGraph = claimVerificationService.buildEvidenceGraph(
      content,
      claims,
      passagesRes.rows,
      rulesRes.rows
    );

    const total = claims.length;
    const supported = claims.filter(c => c.classification === 'Supported').length;
    const contradicted = claims.filter(c => c.classification === 'Contradicted').length;
    const unverified = claims.filter(c => c.classification === 'Unverified').length;
    const needsReview = claims.filter(c => c.classification === 'Needs Human Review').length;

    res.json({
      content,
      claims,
      evidenceGraph,
      summary: {
        total,
        supported,
        contradicted,
        unverified,
        needsReview,
        integrityScore: total === 0 ? 100 : Math.max(0, Math.round(((supported * 1.0) + (needsReview * 0.4) - (contradicted * 1.5)) / total * 100)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to retrieve claim verification analysis: ' + err.message });
  }
});

/**
 * Re-run claim verification analysis
 */
router.post('/content/:contentId/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const { contentId } = req.params;
    const orgId = req.user!.org_id;
    const userId = req.user!.id;

    const result = await claimVerificationService.verifyContentClaims(contentId, orgId, userId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to execute claim verification: ' + err.message });
  }
});

/**
 * Human review decision on an individual extracted claim (confirm, reject, amend)
 */
router.post(
  '/claim/:claimId/review',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager'),
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const orgId = req.user!.org_id;
      const reviewerId = req.user!.id;
      const { decision, notes, amended_classification } = req.body;

      if (!decision || !['confirmed', 'rejected', 'amended'].includes(decision)) {
        res.status(400).json({ error: 'Decision must be one of: confirmed, rejected, amended.' });
        return;
      }

      // Check claim exists
      const claimCheck = await db.query(
        `SELECT ec.*, cs.org_id
         FROM extracted_claims ec
         JOIN content_submissions cs ON ec.content_id = cs.id
         WHERE ec.id = $1 AND cs.org_id = $2`,
        [claimId, orgId]
      );

      if (claimCheck.rows.length === 0) {
        res.status(404).json({ error: 'Claim finding not found.' });
        return;
      }

      const claim = claimCheck.rows[0];
      const newClassification = decision === 'amended' && amended_classification
        ? amended_classification
        : claim.classification;

      const updateRes = await db.query(
        `UPDATE extracted_claims
         SET status = $1,
             reviewer_decision = $2,
             reviewer_notes = $3,
             classification = $4,
             reviewed_by = $5,
             reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6
         RETURNING *`,
        [
          decision,
          decision,
          notes ? notes.trim() : null,
          newClassification,
          reviewerId,
          claimId,
        ]
      );

      await auditService.logEvent({
        orgId,
        userId: reviewerId,
        action: 'CLAIM_DECISION_RECORDED',
        resourceType: 'claim',
        resourceId: claimId,
        details: {
          decision,
          claimText: claim.claim_text,
          priorClassification: claim.classification,
          newClassification,
          notes,
        },
        ipAddress: req.ip,
      });

      res.json({ updatedClaim: updateRes.rows[0] });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to record review decision: ' + err.message });
    }
  }
);

/**
 * Apply suggested correction to content body while preserving original text
 */
router.post(
  '/claim/:claimId/apply-correction',
  authenticate,
  authorizeRoles('admin', 'compliance_officer', 'brand_manager', 'content_creator'),
  async (req: Request, res: Response) => {
    try {
      const { claimId } = req.params;
      const orgId = req.user!.org_id;
      const userId = req.user!.id;
      const { corrected_text } = req.body;

      const claimCheck = await db.query(
        `SELECT ec.*, cs.id as content_id, cs.content_body
         FROM extracted_claims ec
         JOIN content_submissions cs ON ec.content_id = cs.id
         WHERE ec.id = $1 AND cs.org_id = $2`,
        [claimId, orgId]
      );

      if (claimCheck.rows.length === 0) {
        res.status(404).json({ error: 'Claim finding not found.' });
        return;
      }

      const claim = claimCheck.rows[0];
      const textToApply = corrected_text || claim.suggested_correction;

      if (!textToApply) {
        res.status(400).json({ error: 'No suggested or custom correction text provided.' });
        return;
      }

      const originalClaimText = claim.claim_text;
      let currentBody = claim.content_body;

      // Replace in content body
      if (currentBody.includes(originalClaimText)) {
        currentBody = currentBody.replace(originalClaimText, textToApply);
      } else {
        // Fallback append/replace
        currentBody += `\n\n[Correction Applied]: ${textToApply}`;
      }

      // Record in claim_corrections table (immutable audit)
      await db.query(
        `INSERT INTO claim_corrections (claim_id, content_id, original_text, corrected_text, applied_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [claimId, claim.content_id, originalClaimText, textToApply, userId]
      );

      // Update content_submissions body
      await db.query(
        'UPDATE content_submissions SET content_body = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [currentBody, claim.content_id]
      );

      // Mark claim as amended/resolved
      await db.query(
        `UPDATE extracted_claims
         SET status = 'amended',
             reviewer_decision = 'correction_applied',
             reviewer_notes = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [`Correction applied: "${textToApply}"`, claimId]
      );

      await auditService.logEvent({
        orgId,
        userId,
        action: 'CLAIM_CORRECTION_APPLIED',
        resourceType: 'content',
        resourceId: claim.content_id,
        details: { claimId, original: originalClaimText, applied: textToApply },
        ipAddress: req.ip,
      });

      res.json({
        success: true,
        updatedContentBody: currentBody,
        appliedText: textToApply,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to apply correction: ' + err.message });
    }
  }
);

export default router;
