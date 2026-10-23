import { db } from '../db/db.js';
import { auditService } from './auditService.js';
import {
  ReviewerDecisionType,
  ReviewerFeedbackRecord,
  PolicyCandidateRecommendation,
  PolicyRecommendationType,
  FrequentlyViolatedRuleStat,
  ApprovedCorrectionSample,
  RecurringQualityIssue,
  PolicyLearningSummary,
} from '../types/index.js';

export class PolicyLearningService {
  /**
   * Record an authorized reviewer decision, accepted correction, rejected suggestion, or documented exception.
   * STRICT CONSTRAINT: Preserves confidentiality flags and never auto-updates official policies.
   */
  public async recordReviewerFeedback(params: {
    orgId: string;
    submissionId?: string;
    ruleId?: string;
    ruleTitle: string;
    decisionType: ReviewerDecisionType;
    originalText: string;
    suggestedCorrection?: string;
    finalCorrection?: string;
    reviewerId: string;
    reviewerNotes?: string;
    contentCategory?: string;
    isConfidential?: boolean;
    retentionPolicyDays?: number;
  }): Promise<ReviewerFeedbackRecord> {
    const {
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
      isConfidential = false,
      retentionPolicyDays = 365,
    } = params;

    const result = await db.query(
      `INSERT INTO reviewer_feedback_records (
        org_id, submission_id, rule_id, rule_title, decision_type,
        original_text, suggested_correction, final_correction,
        reviewer_id, reviewer_notes, content_category,
        is_confidential, retention_policy_days, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active')
      RETURNING *`,
      [
        orgId,
        submissionId || null,
        ruleId || null,
        ruleTitle,
        decisionType,
        originalText,
        suggestedCorrection || null,
        finalCorrection || null,
        reviewerId,
        reviewerNotes || null,
        contentCategory || 'general',
        isConfidential,
        retentionPolicyDays,
      ]
    );

    const record = result.rows[0];

    // Audit log feedback capture
    await auditService.logAction({
      org_id: orgId,
      user_id: reviewerId,
      action: 'REVIEWER_FEEDBACK_RECORDED',
      resource_type: 'reviewer_feedback_record',
      resource_id: record.id,
      details: {
        rule_title: ruleTitle,
        decision_type: decisionType,
        is_confidential: isConfidential,
        submission_id: submissionId,
      },
    });

    return record;
  }

  /**
   * Suggest corrections based on previous approved human examples.
   * STRICT CONSTRAINT: Explicitly distinguishes reviewer preference/stylistic conventions
   * from verified factual evidence. Past approval is NOT proof that a factual claim is certified.
   */
  public async getApprovedCorrectionExamples(
    orgId: string,
    ruleId?: string,
    queryText?: string
  ): Promise<ApprovedCorrectionSample[]> {
    let sql = `
      SELECT rfr.rule_id, rfr.rule_title, rfr.original_text,
             rfr.suggested_correction, rfr.final_correction, rfr.decision_type
      FROM reviewer_feedback_records rfr
      WHERE rfr.org_id = $1
        AND rfr.status = 'active'
        AND rfr.is_confidential = false
        AND rfr.decision_type IN ('accepted_correction', 'manual_edit')
        AND (rfr.final_correction IS NOT NULL OR rfr.suggested_correction IS NOT NULL)
    `;
    const params: any[] = [orgId];

    if (ruleId) {
      params.push(ruleId);
      sql += ` AND rfr.rule_id = $${params.length}`;
    }

    if (queryText && queryText.trim().length > 0) {
      params.push(`%${queryText.trim()}%`);
      sql += ` AND (rfr.original_text ILIKE $${params.length} OR rfr.rule_title ILIKE $${params.length})`;
    }

    sql += ` ORDER BY rfr.created_at DESC LIMIT 6`;

    const result = await db.query(sql, params);

    return result.rows.map((row: any) => ({
      rule_id: row.rule_id,
      rule_title: row.rule_title,
      original_text: row.original_text,
      suggested_correction: row.suggested_correction || '',
      final_correction: row.final_correction || row.suggested_correction || '',
      decision_type: row.decision_type,
      source: 'reviewer_preference',
      disclaimer:
        'Suggested phrasing based on approved human reviewer preference and corporate style conventions. Note: Does not constitute or substitute for verified factual evidence.',
    }));
  }

  /**
   * Identify frequently violated brand rules and measure recommendation acceptance rates.
   */
  public async getFrequentlyViolatedRules(orgId: string): Promise<FrequentlyViolatedRuleStat[]> {
    // 1. Aggregate from reviewer feedback records
    const feedbackAgg = await db.query(
      `SELECT
         COALESCE(rfr.rule_id::text, rfr.rule_title) as grouping_key,
         rfr.rule_id,
         rfr.rule_title,
         COALESCE(rfr.content_category, 'General') as category,
         COUNT(*)::int as total_feedback,
         SUM(CASE WHEN rfr.decision_type = 'accepted_correction' THEN 1 ELSE 0 END)::int as accepted_count,
         SUM(CASE WHEN rfr.decision_type = 'rejected_suggestion' THEN 1 ELSE 0 END)::int as rejected_count,
         SUM(CASE WHEN rfr.decision_type = 'documented_exception' THEN 1 ELSE 0 END)::int as exceptions_count
       FROM reviewer_feedback_records rfr
       WHERE rfr.org_id = $1 AND rfr.status = 'active'
       GROUP BY grouping_key, rfr.rule_id, rfr.rule_title, rfr.content_category
       ORDER BY total_feedback DESC`,
      [orgId]
    );

    // 2. Aggregate from active brand guidelines to ensure complete coverage
    const guidelines = await db.query(
      `SELECT id, title, category FROM brand_guidelines WHERE org_id = $1`,
      [orgId]
    );
    const guidelinesMap = new Map<string, any>();
    for (const g of guidelines.rows) {
      guidelinesMap.set(g.id, g);
      guidelinesMap.set(g.title.toLowerCase(), g);
    }

    const stats: FrequentlyViolatedRuleStat[] = [];

    for (const row of feedbackAgg.rows) {
      const g = row.rule_id ? guidelinesMap.get(row.rule_id) : guidelinesMap.get(row.rule_title.toLowerCase());
      const total = row.accepted_count + row.rejected_count + row.exceptions_count;
      const acceptanceRate = total > 0 ? Math.round((row.accepted_count / total) * 100) : 0;

      stats.push({
        rule_id: row.rule_id || (g?.id || row.grouping_key),
        rule_title: g?.title || row.rule_title,
        category: g?.category || row.category,
        violation_count: row.total_feedback,
        accepted_corrections_count: row.accepted_count,
        rejected_suggestions_count: row.rejected_count,
        exceptions_count: row.exceptions_count,
        acceptance_rate_percent: acceptanceRate,
      });
    }

    return stats;
  }

  /**
   * Identify recurring content-quality problems across all scanned submissions.
   */
  public async getRecurringQualityProblems(orgId: string): Promise<RecurringQualityIssue[]> {
    const result = await db.query(
      `SELECT rr.violations, cs.channel
       FROM risk_reports rr
       JOIN content_submissions cs ON rr.content_id = cs.id
       WHERE cs.org_id = $1`,
      [orgId]
    );

    const patternMap = new Map<
      string,
      { count: number; description: string; channels: Set<string>; samples: string[] }
    >();

    for (const row of result.rows) {
      const violations = Array.isArray(row.violations) ? row.violations : [];
      for (const v of violations) {
        const title = v.rule_title || v.ruleTitle || v.category || 'General Violation';
        if (!patternMap.has(title)) {
          patternMap.set(title, {
            count: 0,
            description: v.explanation || v.description || `Recurring violation pattern in ${title}`,
            channels: new Set<string>(),
            samples: [],
          });
        }
        const entry = patternMap.get(title)!;
        entry.count += 1;
        if (row.channel) entry.channels.add(row.channel);
        if (v.matched_text && entry.samples.length < 3) {
          entry.samples.push(v.matched_text);
        }
      }
    }

    const issues: RecurringQualityIssue[] = [];
    for (const [title, val] of patternMap.entries()) {
      issues.push({
        issue_type: title,
        pattern_description: val.description,
        occurrences_count: val.count,
        affected_channels: Array.from(val.channels),
        sample_contexts: val.samples,
      });
    }

    return issues.sort((a, b) => b.occurrences_count - a.occurrences_count).slice(0, 8);
  }

  /**
   * Recommend candidate updates to brand guidelines based on accumulated reviewer decisions.
   * STRICT CONSTRAINT: Does NOT automatically change official policies. Creates candidate
   * entries with status 'pending_review' that require authorized admin sign-off.
   */
  public async generateCandidateRecommendations(
    orgId: string,
    proposedBy: string
  ): Promise<PolicyCandidateRecommendation[]> {
    const frequentlyViolated = await this.getFrequentlyViolatedRules(orgId);
    const existingRecs = await db.query(
      `SELECT target_rule_id, recommendation_type, status 
       FROM policy_candidate_recommendations 
       WHERE org_id = $1 AND status = 'pending_review'`,
      [orgId]
    );
    const pendingSet = new Set(
      existingRecs.rows.map((r: any) => `${r.target_rule_id}_${r.recommendation_type}`)
    );

    const generated: PolicyCandidateRecommendation[] = [];

    for (const rule of frequentlyViolated) {
      // 1. If rule has high exceptions (> 20% of feedback), recommend candidate exception update
      if (rule.exceptions_count >= 1 && (rule.exceptions_count / rule.violation_count) >= 0.2) {
        const key = `${rule.rule_id}_add_approved_exception`;
        if (!pendingSet.has(key)) {
          const insertRes = await db.query(
            `INSERT INTO policy_candidate_recommendations (
              org_id, target_rule_id, recommendation_type, title, category,
              description, suggested_rule_content, rationale,
              violation_frequency, acceptance_rate, rejection_count, exception_count,
              sample_feedback_ids, status
            ) VALUES ($1, $2, 'add_approved_exception', $3, $4, $5, $6, $7, $8, $9, $10, $11, '[]'::jsonb, 'pending_review')
            RETURNING *`,
            [
              orgId,
              rule.rule_id && typeof rule.rule_id === 'string' && rule.rule_id.includes('-') ? rule.rule_id : null,
              `Permit Approved Exception for "${rule.rule_title}"`,
              rule.category,
              `Reviewers have repeatedly documented justifiable exceptions (${rule.exceptions_count} recorded exceptions, ${(
                (rule.exceptions_count / rule.violation_count) *
                100
              ).toFixed(1)}% exception rate). Recommend codifying these allowed contexts in the official brand guidelines.`,
              JSON.stringify({
                action: 'add_approved_context',
                rule_title: rule.rule_title,
                allowed_exception_pattern: 'Permitted in executive whitepapers and investor disclosures with contextual footnote.',
              }),
              `High human exception rate indicates current rule is overly rigid for specialized enterprise formats.`,
              rule.violation_count,
              rule.acceptance_rate_percent,
              rule.rejected_suggestions_count,
              rule.exceptions_count,
            ]
          );
          generated.push(insertRes.rows[0]);
          pendingSet.add(key);
        }
      }

      // 2. If rule has high frequency and high acceptance of corrections (> 70%), recommend updating rule guidance
      if (rule.violation_count >= 2 && rule.acceptance_rate_percent >= 60) {
        const key = `${rule.rule_id}_update_existing_rule`;
        if (!pendingSet.has(key)) {
          const insertRes = await db.query(
            `INSERT INTO policy_candidate_recommendations (
              org_id, target_rule_id, recommendation_type, title, category,
              description, suggested_rule_content, rationale,
              violation_frequency, acceptance_rate, rejection_count, exception_count,
              sample_feedback_ids, status
            ) VALUES ($1, $2, 'update_existing_rule', $3, $4, $5, $6, $7, $8, $9, $10, $11, '[]'::jsonb, 'pending_review')
            RETURNING *`,
            [
              orgId,
              rule.rule_id && typeof rule.rule_id === 'string' && rule.rule_id.includes('-') ? rule.rule_id : null,
              `Update Guidance & Clarify Phrasing for "${rule.rule_title}"`,
              rule.category,
              `Reviewers consistently accept proposed corrections (${rule.accepted_corrections_count} accepted, ${rule.acceptance_rate_percent}% rate). Update rule content to incorporate approved phrasing conventions directly into guidance.`,
              JSON.stringify({
                action: 'update_guidance',
                rule_title: rule.rule_title,
                recommended_alternatives: 'Incorporate verified phrasing directly into pre-submission creator hints.',
              }),
              `Reviewers demonstrate high consensus on acceptable replacements. Codifying this saves review cycles.`,
              rule.violation_count,
              rule.acceptance_rate_percent,
              rule.rejected_suggestions_count,
              rule.exceptions_count,
            ]
          );
          generated.push(insertRes.rows[0]);
          pendingSet.add(key);
        }
      }
    }

    return generated;
  }

  /**
   * Authorized Administrator Approves a Candidate Policy Update.
   * Increments rule version in brand_guidelines, applies update, and records audit trail.
   */
  public async approveCandidateRecommendation(params: {
    recommendationId: string;
    orgId: string;
    adminUserId: string;
    reviewNotes?: string;
  }): Promise<{ recommendation: PolicyCandidateRecommendation; updatedRule?: any }> {
    const { recommendationId, orgId, adminUserId, reviewNotes } = params;

    const recRes = await db.query(
      `SELECT * FROM policy_candidate_recommendations WHERE id = $1 AND org_id = $2`,
      [recommendationId, orgId]
    );

    if (recRes.rows.length === 0) {
      throw new Error('Candidate recommendation not found.');
    }

    const rec = recRes.rows[0];
    if (rec.status !== 'pending_review') {
      throw new Error(`Recommendation is already ${rec.status}.`);
    }

    let appliedVersion = 1;
    let updatedRule: any = null;

    if (rec.target_rule_id) {
      // Fetch target rule
      const ruleRes = await db.query(
        `SELECT * FROM brand_guidelines WHERE id = $1 AND org_id = $2`,
        [rec.target_rule_id, orgId]
      );

      if (ruleRes.rows.length > 0) {
        const currentRule = ruleRes.rows[0];
        appliedVersion = (currentRule.version || 1) + 1;

        // Version the rule
        const updatedRuleRes = await db.query(
          `UPDATE brand_guidelines
           SET version = $1,
               description = $2,
               rules = jsonb_set(COALESCE(rules, '{}'::jsonb), '{last_policy_learning_update}', to_jsonb($3::text), true),
               updated_at = NOW()
           WHERE id = $4 AND org_id = $5
           RETURNING *`,
          [
            appliedVersion,
            `${currentRule.description} [Updated via Policy Learning: ${rec.title}]`,
            rec.rationale,
            currentRule.id,
            orgId,
          ]
        );
        updatedRule = updatedRuleRes.rows[0];
      }
    } else {
      // Create new candidate rule with version 1
      const newRuleRes = await db.query(
        `INSERT INTO brand_guidelines (
          org_id, category, title, description, rules, severity, is_active, version, created_by
        ) VALUES ($1, $2, $3, $4, $5, 'medium', true, 1, $6)
        RETURNING *`,
        [
          orgId,
          rec.category,
          rec.title,
          rec.description,
          rec.suggested_rule_content,
          adminUserId,
        ]
      );
      updatedRule = newRuleRes.rows[0];
      appliedVersion = 1;
    }

    // Update recommendation status
    const updateRecRes = await db.query(
      `UPDATE policy_candidate_recommendations
       SET status = 'approved',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_notes = $2,
           version_applied = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [adminUserId, reviewNotes || 'Approved by authorized administrator.', appliedVersion, recommendationId]
    );

    // Audit log
    await auditService.logAction({
      org_id: orgId,
      user_id: adminUserId,
      action: 'POLICY_RECOMMENDATION_APPROVED',
      resource_type: 'policy_candidate_recommendation',
      resource_id: recommendationId,
      details: {
        title: rec.title,
        applied_version: appliedVersion,
        target_rule_id: rec.target_rule_id,
        notes: reviewNotes,
      },
    });

    return {
      recommendation: updateRecRes.rows[0],
      updatedRule,
    };
  }

  /**
   * Authorized Administrator Rejects a Candidate Policy Update.
   */
  public async rejectCandidateRecommendation(params: {
    recommendationId: string;
    orgId: string;
    adminUserId: string;
    reviewNotes?: string;
  }): Promise<PolicyCandidateRecommendation> {
    const { recommendationId, orgId, adminUserId, reviewNotes } = params;

    const result = await db.query(
      `UPDATE policy_candidate_recommendations
       SET status = 'rejected',
           reviewed_by = $1,
           reviewed_at = NOW(),
           review_notes = $2,
           updated_at = NOW()
       WHERE id = $3 AND org_id = $4 AND status = 'pending_review'
       RETURNING *`,
      [adminUserId, reviewNotes || 'Rejected by authorized administrator.', recommendationId, orgId]
    );

    if (result.rows.length === 0) {
      throw new Error('Pending candidate recommendation not found.');
    }

    await auditService.logAction({
      org_id: orgId,
      user_id: adminUserId,
      action: 'POLICY_RECOMMENDATION_REJECTED',
      resource_type: 'policy_candidate_recommendation',
      resource_id: recommendationId,
      details: {
        notes: reviewNotes,
      },
    });

    return result.rows[0];
  }

  /**
   * List feedback records with admin inspection and data retention filtering.
   */
  public async listFeedbackRecords(
    orgId: string,
    filters?: {
      decisionType?: string;
      status?: string;
      ruleId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ records: ReviewerFeedbackRecord[]; total: number }> {
    let sql = `
      SELECT rfr.*, u.full_name as reviewer_name
      FROM reviewer_feedback_records rfr
      LEFT JOIN users u ON rfr.reviewer_id = u.id
      WHERE rfr.org_id = $1
    `;
    const params: any[] = [orgId];

    if (filters?.decisionType) {
      params.push(filters.decisionType);
      sql += ` AND rfr.decision_type = $${params.length}`;
    }

    if (filters?.status) {
      params.push(filters.status);
      sql += ` AND rfr.status = $${params.length}`;
    } else {
      sql += ` AND rfr.status != 'purged'`;
    }

    if (filters?.ruleId) {
      params.push(filters.ruleId);
      sql += ` AND rfr.rule_id = $${params.length}`;
    }

    sql += ` ORDER BY rfr.created_at DESC`;

    const countRes = await db.query(
      `SELECT COUNT(*)::int as count FROM (${sql}) as filtered`,
      params
    );

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    params.push(limit, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const rowsRes = await db.query(sql, params);

    return {
      records: rowsRes.rows,
      total: countRes.rows[0]?.count || 0,
    };
  }

  /**
   * Administrator correction of inappropriate or erroneous feedback records.
   */
  public async updateFeedbackRecord(params: {
    feedbackId: string;
    orgId: string;
    adminUserId: string;
    reviewerNotes?: string;
    status?: 'active' | 'corrected' | 'purged';
  }): Promise<ReviewerFeedbackRecord> {
    const { feedbackId, orgId, adminUserId, reviewerNotes, status } = params;

    const result = await db.query(
      `UPDATE reviewer_feedback_records
       SET reviewer_notes = COALESCE($1, reviewer_notes),
           status = COALESCE($2, status),
           updated_at = NOW()
       WHERE id = $3 AND org_id = $4
       RETURNING *`,
      [reviewerNotes || null, status || null, feedbackId, orgId]
    );

    if (result.rows.length === 0) {
      throw new Error('Feedback record not found.');
    }

    await auditService.logAction({
      org_id: orgId,
      user_id: adminUserId,
      action: 'REVIEWER_FEEDBACK_CORRECTED',
      resource_type: 'reviewer_feedback_record',
      resource_id: feedbackId,
      details: {
        updated_status: status,
        updated_notes: reviewerNotes,
      },
    });

    return result.rows[0];
  }

  /**
   * Purge feedback record per data-retention policy.
   */
  public async purgeFeedbackRecord(params: {
    feedbackId: string;
    orgId: string;
    adminUserId: string;
    reason: string;
  }): Promise<void> {
    const { feedbackId, orgId, adminUserId, reason } = params;

    const check = await db.query(
      `SELECT id FROM reviewer_feedback_records WHERE id = $1 AND org_id = $2`,
      [feedbackId, orgId]
    );

    if (check.rows.length === 0) {
      throw new Error('Feedback record not found.');
    }

    await db.query(
      `UPDATE reviewer_feedback_records
       SET status = 'purged',
           reviewer_notes = $1,
           original_text = '[PURGED PER RETENTION POLICY]',
           suggested_correction = NULL,
           final_correction = NULL,
           updated_at = NOW()
       WHERE id = $2 AND org_id = $3`,
      [`Purged: ${reason}`, feedbackId, orgId]
    );

    await auditService.logAction({
      org_id: orgId,
      user_id: adminUserId,
      action: 'REVIEWER_FEEDBACK_PURGED',
      resource_type: 'reviewer_feedback_record',
      resource_id: feedbackId,
      details: { reason },
    });
  }

  /**
   * High-level summary of policy learning metrics for dashboard.
   */
  public async getPolicyLearningSummary(orgId: string): Promise<PolicyLearningSummary> {
    const totalRes = await db.query(
      `SELECT COUNT(*)::int as total,
              SUM(CASE WHEN decision_type = 'accepted_correction' THEN 1 ELSE 0 END)::int as accepted
       FROM reviewer_feedback_records
       WHERE org_id = $1 AND status != 'purged'`,
      [orgId]
    );

    const total = totalRes.rows[0]?.total || 0;
    const accepted = totalRes.rows[0]?.accepted || 0;
    const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

    const frequentlyViolated = await this.getFrequentlyViolatedRules(orgId);
    const recurringIssues = await this.getRecurringQualityProblems(orgId);

    const recsRes = await db.query(
      `SELECT status, COUNT(*)::int as count
       FROM policy_candidate_recommendations
       WHERE org_id = $1
       GROUP BY status`,
      [orgId]
    );

    const candidateCounts = { pending: 0, approved: 0, rejected: 0 };
    for (const row of recsRes.rows) {
      if (row.status === 'pending_review') candidateCounts.pending = row.count;
      else if (row.status === 'approved') candidateCounts.approved = row.count;
      else if (row.status === 'rejected') candidateCounts.rejected = row.count;
    }

    return {
      total_feedback_records: total,
      overall_acceptance_rate: acceptanceRate,
      frequently_violated_rules: frequentlyViolated,
      recurring_quality_issues: recurringIssues,
      candidate_recommendations_count: candidateCounts,
    };
  }
}

export const policyLearningService = new PolicyLearningService();
