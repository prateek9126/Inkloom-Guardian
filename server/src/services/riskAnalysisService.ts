import { db } from '../db/db.js';
import { aiService, ScanResult } from './aiService.js';
import { auditService } from './auditService.js';
import { claimVerificationService } from './claimVerificationService.js';
import {
  SeverityLevel,
  RiskCategory,
  RiskDomain,
  RiskContributionIssue,
  UnresolvedUncertainty,
  RiskScoringConfig,
  ExplainableRiskReport,
  RiskReductionComparison,
  ContentVersion,
  SubmissionStatus,
  UserRole,
} from '../types/index.js';

export const DEFAULT_RISK_CONFIG: RiskScoringConfig = {
  base_severity_weights: {
    critical: 35,
    high: 20,
    medium: 10,
    low: 4,
  },
  domain_multipliers: {
    legal_regulatory: 1.4,
    safety: 1.35,
    financial_pricing: 1.25,
    technical_claims: 1.1,
    brand_voice_naming: 0.9,
  },
  evidence_factors: {
    direct_contradiction: 1.25,
    unverified_unsubstantiated: 0.85,
    supported: 0.0,
  },
  campaign_multipliers: {
    multi_asset: 1.2,
    single_asset: 1.0,
  },
  thresholds: {
    low_max: 19,
    moderate_max: 44,
    elevated_max: 69,
    critical_min: 70,
  },
  disclaimer:
    'A score of 100 represents elevated compliance rule violations according to defined enterprise weights and is not a scientifically proven empirical probability of actual brand damage.',
};

export class RiskAnalysisService {
  /**
   * Retrieve organization risk scoring configuration (or default if unconfigured)
   */
  public async getScoringConfig(orgId: string): Promise<RiskScoringConfig> {
    const res = await db.query(
      'SELECT risk_scoring_config FROM system_settings WHERE org_id = $1',
      [orgId]
    );

    if (res.rows.length > 0 && res.rows[0].risk_scoring_config) {
      const cfg = res.rows[0].risk_scoring_config;
      return typeof cfg === 'string' ? JSON.parse(cfg) : cfg;
    }
    return DEFAULT_RISK_CONFIG;
  }

  /**
   * Determine the risk domain for a rule / claim category
   */
  public categorizeDomain(category: string, title: string, text: string): RiskDomain {
    const combined = `${category} ${title} ${text}`.toLowerCase();
    if (
      category === 'regulatory' ||
      /legal|regulatory|disclaimer|copyright|trademark|patent|statutory|compliance|gdpr|hipaa/i.test(combined)
    ) {
      return 'legal_regulatory';
    }
    if (/safety|hazard|danger|health|harm|risk-free|safe/i.test(combined)) {
      return 'safety';
    }
    if (
      /price|pricing|discount|cost|roi|money-back|financial|guaranteed return|annual fee|license fee/i.test(combined)
    ) {
      return 'financial_pricing';
    }
    if (
      category === 'claims' ||
      category === 'Technical' ||
      /sla|uptime|benchmark|throughput|emissions|battery|performance|metric|accuracy|speed/i.test(combined)
    ) {
      return 'technical_claims';
    }
    return 'brand_voice_naming';
  }

  /**
   * Deterministic Explainable Risk Calculation Engine.
   * Calculates individual contributions, avoids double-counting correlated findings,
   * scales by explicit confidence, and generates remediation recommendations.
   */
  public calculateExplainableRisk(params: {
    violations: any[];
    claims: any[];
    isMultiAsset: boolean;
    config: RiskScoringConfig;
  }): {
    overallRiskScore: number;
    riskCategory: RiskCategory;
    toneScore: number;
    claimsScore: number;
    complianceScore: number;
    contributingIssues: RiskContributionIssue[];
    unresolvedUncertainties: UnresolvedUncertainty[];
    remediationSteps: string[];
    scoringFormulaBreakdown: any;
  } {
    const { violations, claims, isMultiAsset, config } = params;
    const contributingIssues: RiskContributionIssue[] = [];
    const unresolvedUncertainties: UnresolvedUncertainty[] = [];
    const remediationSteps: string[] = [];

    const campaignMultiplier = isMultiAsset
      ? config.campaign_multipliers.multi_asset
      : config.campaign_multipliers.single_asset;

    // 1. Process Brand Guideline Violations
    for (const v of violations) {
      const severity: SeverityLevel = v.severity || 'medium';
      const basePoints = config.base_severity_weights[severity] || 10;
      const domain = this.categorizeDomain(v.category || '', v.ruleTitle || '', v.matchedText || '');
      const domainMultiplier = config.domain_multipliers[domain] || 1.0;
      // Deterministic regex matches carry 0.95 confidence; heuristics carry 0.85
      const confidence = v.position ? 0.95 : 0.85;
      const confidenceMultiplier = confidence;
      const evidenceFactor = 1.0; // standard rule violation
      const statusMultiplier = v.status === 'accepted' ? 0.0 : 1.0;

      const scoreContribution = Math.round(
        basePoints * domainMultiplier * confidenceMultiplier * evidenceFactor * campaignMultiplier * statusMultiplier
      );

      contributingIssues.push({
        id: v.id || `v-${Math.random().toString(36).substring(2, 9)}`,
        rule_title: v.ruleTitle || 'Brand Guideline Rule',
        category: v.category || 'Brand Governance',
        domain,
        severity,
        confidence,
        matched_text: v.matchedText || '',
        evidence_status: 'rule_violation',
        multi_asset: isMultiAsset,
        unresolved: v.status !== 'accepted',
        base_points: basePoints,
        domain_multiplier: domainMultiplier,
        confidence_multiplier: confidenceMultiplier,
        evidence_factor: evidenceFactor,
        campaign_multiplier: campaignMultiplier,
        score_contribution: scoreContribution,
        explanation: v.explanation || 'Violation of approved enterprise brand guideline.',
        recommended_remediation: v.suggestedFix || 'Revise terminology to adhere to approved brand standard.',
      });

      if (v.suggestedFix && !remediationSteps.includes(v.suggestedFix)) {
        remediationSteps.push(v.suggestedFix);
      }
    }

    // 2. Process Extracted Claims (Contradicted & Unverified from Evidence Verification Engine)
    for (const c of claims) {
      if (c.classification === 'Contradicted') {
        const severity: SeverityLevel = 'critical';
        const basePoints = config.base_severity_weights.critical;
        const domain = this.categorizeDomain(c.claim_type || '', c.claim_text || '', c.claim_text || '');
        const domainMultiplier = config.domain_multipliers[domain] || 1.1;
        const confidence = typeof c.confidence_score === 'number' ? c.confidence_score : 0.92;
        const evidenceFactor = config.evidence_factors.direct_contradiction;
        const statusMultiplier = c.status === 'approved' ? 0.0 : 1.0;

        const scoreContribution = Math.round(
          basePoints * domainMultiplier * confidence * evidenceFactor * campaignMultiplier * statusMultiplier
        );

        contributingIssues.push({
          id: c.id || `claim-${Math.random().toString(36).substring(2, 9)}`,
          rule_title: `Contradicted Claim: ${c.claim_text.substring(0, 45)}...`,
          category: 'Factual Accuracy & Evidence Grounding',
          domain,
          severity,
          confidence,
          matched_text: c.claim_text,
          evidence_ref: c.contradiction_details || 'Company Primary Evidence Document',
          evidence_status: 'contradicted',
          multi_asset: isMultiAsset,
          unresolved: c.status !== 'approved',
          base_points: basePoints,
          domain_multiplier: domainMultiplier,
          confidence_multiplier: confidence,
          evidence_factor: evidenceFactor,
          campaign_multiplier: campaignMultiplier,
          score_contribution: scoreContribution,
          explanation: c.explanation || 'Claim directly contradicts approved verified company documents.',
          recommended_remediation: c.suggested_correction || 'Correct promotional statement to align with certified evidence baseline.',
        });

        if (c.suggested_correction && !remediationSteps.includes(c.suggested_correction)) {
          remediationSteps.push(c.suggested_correction);
        }
      } else if (c.classification === 'Unverified') {
        const severity: SeverityLevel = 'medium';
        const basePoints = config.base_severity_weights.medium;
        const domain = this.categorizeDomain(c.claim_type || '', c.claim_text || '', c.claim_text || '');
        const domainMultiplier = config.domain_multipliers[domain] || 1.0;
        const confidence = 0.75;
        const evidenceFactor = config.evidence_factors.unverified_unsubstantiated;
        const statusMultiplier = c.status === 'approved' ? 0.0 : 1.0;

        const scoreContribution = Math.round(
          basePoints * domainMultiplier * confidence * evidenceFactor * campaignMultiplier * statusMultiplier
        );

        contributingIssues.push({
          id: c.id || `claim-unv-${Math.random().toString(36).substring(2, 9)}`,
          rule_title: `Unverified Claim: ${c.claim_text.substring(0, 45)}...`,
          category: 'Unsubstantiated Claim',
          domain,
          severity,
          confidence,
          matched_text: c.claim_text,
          evidence_status: 'unverified',
          multi_asset: isMultiAsset,
          unresolved: c.status !== 'approved',
          base_points: basePoints,
          domain_multiplier: domainMultiplier,
          confidence_multiplier: confidence,
          evidence_factor: evidenceFactor,
          campaign_multiplier: campaignMultiplier,
          score_contribution: scoreContribution,
          explanation: 'Claim statement is not substantiated by any approved document in the primary evidence library.',
          recommended_remediation: 'Provide citation to an approved audit report or remove promotional superlative.',
        });

        unresolvedUncertainties.push({
          claim_or_issue: c.claim_text,
          uncertainty_type: 'missing_evidence',
          description: 'No verified benchmark study or primary source passage was found confirming this specific metric.',
          impact_on_assessment: 'Treated with caution (0.85x factor) without assuming bad faith.',
          recommended_action: 'Upload primary supporting audit document or route to compliance counsel for verification.',
        });
      }
    }

    // 3. Deduplicate Correlated / Overlapping Findings
    // If two issues flag overlapping text or identical rule within proximity, retain highest score impact
    const deduplicatedIssues: RiskContributionIssue[] = [];
    let deduplicatedCount = 0;

    for (const issue of contributingIssues) {
      const duplicateIndex = deduplicatedIssues.findIndex(
        (existing) =>
          existing.matched_text.toLowerCase().includes(issue.matched_text.toLowerCase()) ||
          issue.matched_text.toLowerCase().includes(existing.matched_text.toLowerCase())
      );

      if (duplicateIndex !== -1) {
        deduplicatedCount++;
        // Retain the higher contribution finding
        if (issue.score_contribution > deduplicatedIssues[duplicateIndex].score_contribution) {
          deduplicatedIssues[duplicateIndex] = issue;
        }
      } else {
        deduplicatedIssues.push(issue);
      }
    }

    // Sort contributing issues by score contribution descending
    deduplicatedIssues.sort((a, b) => b.score_contribution - a.score_contribution);

    // 4. Calculate Final Estimated Risk Score
    const totalRawPoints = deduplicatedIssues.reduce((acc, i) => acc + i.score_contribution, 0);
    const overallRiskScore = Math.min(100, Math.max(0, totalRawPoints));

    // Determine Risk Category
    let riskCategory: RiskCategory = 'Low Risk';
    if (overallRiskScore >= config.thresholds.critical_min) riskCategory = 'Critical Risk';
    else if (overallRiskScore > config.thresholds.moderate_max) riskCategory = 'Elevated Risk';
    else if (overallRiskScore > config.thresholds.low_max) riskCategory = 'Moderate Risk';

    // Sub-scores
    const toneScore = Math.max(20, 100 - (violations.filter((v: any) => v.category === 'tone_voice').length * 15));
    const complianceScore = Math.max(10, 100 - overallRiskScore);
    const claimsScore = Math.max(15, 100 - (claims.filter((c: any) => c.classification === 'Contradicted').length * 25));

    const scoringFormulaBreakdown = {
      base_formula:
        'Score = min(100, sum(BaseSeverity * DomainMultiplier * Confidence * EvidenceFactor * CampaignMultiplier * StatusMultiplier))',
      total_raw_points: totalRawPoints,
      clamped_score: overallRiskScore,
      deduplicated_count: deduplicatedCount,
      config_applied: config,
      disclaimer: config.disclaimer,
    };

    return {
      overallRiskScore,
      riskCategory,
      toneScore,
      claimsScore,
      complianceScore,
      contributingIssues: deduplicatedIssues,
      unresolvedUncertainties,
      remediationSteps,
      scoringFormulaBreakdown,
    };
  }

  /**
   * Scan or re-scan content submission with the explainable deterministic risk engine.
   */
  public async scanContent(
    contentId: string,
    orgId: string,
    userId?: string,
    transitionState: boolean = true
  ): Promise<ExplainableRiskReport> {
    // 1. Fetch content submission
    const contentRes = await db.query(
      `SELECT cs.*, c.id as campaign_id
       FROM content_submissions cs
       LEFT JOIN campaigns c ON cs.campaign_id = c.id
       WHERE cs.id = $1 AND cs.org_id = $2`,
      [contentId, orgId]
    );

    if (contentRes.rows.length === 0) {
      throw new Error('Content submission not found.');
    }
    const content = contentRes.rows[0];

    // Set status to analysis_pending during processing if not already in review
    if (transitionState && content.status === 'draft') {
      await db.query("UPDATE content_submissions SET status = 'analysis_pending' WHERE id = $1", [contentId]);
    }

    // 2. Fetch active guidelines & approved claims
    const guidelinesRes = await db.query(
      'SELECT * FROM brand_guidelines WHERE org_id = $1 AND is_active = true',
      [orgId]
    );
    const approvedClaimsRes = await db.query(
      'SELECT * FROM approved_claims WHERE org_id = $1',
      [orgId]
    );

    // 3. Run raw heuristic rule matching
    const rawScan = await aiService.analyzeContent(
      content.content_body,
      content.channel,
      guidelinesRes.rows,
      approvedClaimsRes.rows
    );

    // 4. Fetch extracted claims from Claim Verification Engine (or auto-verify if none)
    let claimsRes = await db.query(
      'SELECT * FROM extracted_claims WHERE content_id = $1',
      [contentId]
    );
    if (claimsRes.rows.length === 0) {
      try {
        await claimVerificationService.verifyContentClaims(contentId, orgId, userId);
        claimsRes = await db.query(
          'SELECT * FROM extracted_claims WHERE content_id = $1',
          [contentId]
        );
      } catch (err: any) {
        console.warn('[RiskScan Warning]: Auto claim verification deferred:', err.message);
      }
    }

    // 5. Check if multi-asset in campaign
    let isMultiAsset = false;
    if (content.campaign_id) {
      const countRes = await db.query(
        'SELECT COUNT(id)::int as asset_count FROM content_submissions WHERE campaign_id = $1',
        [content.campaign_id]
      );
      isMultiAsset = (countRes.rows[0]?.asset_count || 0) > 1;
    }

    // 6. Fetch scoring configuration
    const config = await this.getScoringConfig(orgId);

    // 7. Run explainable risk calculation
    const assessment = this.calculateExplainableRisk({
      violations: rawScan.violations,
      claims: claimsRes.rows,
      isMultiAsset,
      config,
    });

    // Determine risk level severity code
    let riskLevel: SeverityLevel = 'low';
    if (assessment.overallRiskScore >= config.thresholds.critical_min) riskLevel = 'critical';
    else if (assessment.overallRiskScore > config.thresholds.moderate_max) riskLevel = 'high';
    else if (assessment.overallRiskScore > config.thresholds.low_max) riskLevel = 'medium';

    // 8. Delete prior risk reports for this content
    await db.query('DELETE FROM risk_reports WHERE content_id = $1', [contentId]);

    // 9. Insert new comprehensive risk report
    const reportRes = await db.query(
      `INSERT INTO risk_reports 
        (content_id, overall_risk_score, tone_score, claims_score, compliance_score,
         violations, unsubstantiated_claims, suggested_disclaimers, ai_model_used,
         risk_category, scoring_formula_breakdown, unresolved_uncertainties,
         remediation_steps, content_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        contentId,
        assessment.overallRiskScore,
        assessment.toneScore,
        assessment.claimsScore,
        assessment.complianceScore,
        JSON.stringify(rawScan.violations),
        JSON.stringify(rawScan.unsubstantiatedClaims),
        JSON.stringify(assessment.remediationSteps),
        'Inkloom Guardian Explainable Brand Risk Intelligence Engine',
        assessment.riskCategory,
        JSON.stringify(assessment.scoringFormulaBreakdown),
        JSON.stringify(assessment.unresolvedUncertainties),
        JSON.stringify(assessment.remediationSteps),
        content.current_version || 1,
      ]
    );

    const savedReport = reportRes.rows[0];

    // 10. Update content submission status and scores
    let newStatus = content.status;
    if (transitionState) {
      if (['draft', 'analysis_pending'].includes(content.status)) {
        newStatus = 'analysis_complete';
      }
    }

    await db.query(
      `UPDATE content_submissions
       SET risk_score = $1, risk_level = $2, status = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [assessment.overallRiskScore, riskLevel, newStatus, contentId]
    );

    // 11. Log audit event
    await auditService.logEvent({
      orgId,
      userId,
      action: 'EXPLAINABLE_RISK_ASSESSMENT_EXECUTED',
      resourceType: 'content',
      resourceId: contentId,
      details: {
        score: assessment.overallRiskScore,
        category: assessment.riskCategory,
        contributingCount: assessment.contributingIssues.length,
        uncertaintiesCount: assessment.unresolvedUncertainties.length,
        version: content.current_version || 1,
      },
    });

    return {
      id: savedReport.id,
      content_id: contentId,
      content_version: content.current_version || 1,
      overall_risk_score: assessment.overallRiskScore,
      risk_category: assessment.riskCategory,
      tone_score: assessment.toneScore,
      claims_score: assessment.claimsScore,
      compliance_score: assessment.complianceScore,
      contributing_issues: assessment.contributingIssues,
      unresolved_uncertainties: assessment.unresolvedUncertainties,
      remediation_steps: assessment.remediationSteps,
      scoring_formula_breakdown: assessment.scoringFormulaBreakdown,
      violations: rawScan.violations,
      unsubstantiated_claims: rawScan.unsubstantiatedClaims,
      suggested_disclaimers: assessment.remediationSteps,
      ai_model_used: 'Inkloom Guardian Explainable Brand Risk Intelligence Engine',
      created_at: savedReport.created_at,
    };
  }

  /**
   * Snapshot a revision of the content submission for auditability and diffing.
   */
  public async createRevisionSnapshot(
    contentId: string,
    userId: string,
    changeSummary: string = 'Content revision'
  ): Promise<ContentVersion> {
    const subRes = await db.query('SELECT * FROM content_submissions WHERE id = $1', [contentId]);
    if (subRes.rows.length === 0) throw new Error('Content not found.');
    const sub = subRes.rows[0];

    const reportRes = await db.query(
      'SELECT * FROM risk_reports WHERE content_id = $1 ORDER BY created_at DESC LIMIT 1',
      [contentId]
    );
    const report = reportRes.rows[0] || null;

    const versionNum = (sub.current_version || 1);

    const ins = await db.query(
      `INSERT INTO content_versions
        (content_id, version_number, content_body, title, risk_score, risk_level, status,
         violations_snapshot, risk_report_snapshot, change_summary, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        contentId,
        versionNum,
        sub.content_body,
        sub.title,
        sub.risk_score,
        sub.risk_level,
        sub.status,
        report ? report.violations : '[]',
        report ? JSON.stringify(report) : null,
        changeSummary,
        userId,
      ]
    );

    return ins.rows[0];
  }

  /**
   * Risk Reduction Comparison:
   * Compares an older version of content against a newer version,
   * showing resolved issues, remaining issues, newly introduced issues, and score delta.
   */
  public async compareRevisions(
    contentId: string,
    oldVersionNum: number,
    newVersionNum: number
  ): Promise<RiskReductionComparison> {
    const oldVerRes = await db.query(
      'SELECT * FROM content_versions WHERE content_id = $1 AND version_number = $2',
      [contentId, oldVersionNum]
    );
    const newVerRes = await db.query(
      'SELECT * FROM content_versions WHERE content_id = $1 AND version_number = $2',
      [contentId, newVersionNum]
    );

    if (oldVerRes.rows.length === 0 || newVerRes.rows.length === 0) {
      throw new Error(`One or both requested versions (v${oldVersionNum}, v${newVersionNum}) not found.`);
    }

    const oldVer = oldVerRes.rows[0];
    const newVer = newVerRes.rows[0];

    const oldReport = oldVer.risk_report_snapshot
      ? (typeof oldVer.risk_report_snapshot === 'string' ? JSON.parse(oldVer.risk_report_snapshot) : oldVer.risk_report_snapshot)
      : null;
    const newReport = newVer.risk_report_snapshot
      ? (typeof newVer.risk_report_snapshot === 'string' ? JSON.parse(newVer.risk_report_snapshot) : newVer.risk_report_snapshot)
      : null;

    const oldViolations: any[] = oldReport?.violations ? (Array.isArray(oldReport.violations) ? oldReport.violations : JSON.parse(oldReport.violations)) : [];
    const newViolations: any[] = newReport?.violations ? (Array.isArray(newReport.violations) ? newReport.violations : JSON.parse(newReport.violations)) : [];

    // Identify resolved vs remaining vs new issues
    const resolvedIssues: any[] = [];
    const remainingIssues: any[] = [];
    const newlyIntroducedIssues: any[] = [];

    const newMatchTexts = new Set(newViolations.map((v: any) => (v.matchedText || '').toLowerCase()));
    const oldMatchTexts = new Set(oldViolations.map((v: any) => (v.matchedText || '').toLowerCase()));

    for (const ov of oldViolations) {
      if (newMatchTexts.has((ov.matchedText || '').toLowerCase())) {
        remainingIssues.push(ov);
      } else {
        resolvedIssues.push(ov);
      }
    }

    for (const nv of newViolations) {
      if (!oldMatchTexts.has((nv.matchedText || '').toLowerCase())) {
        newlyIntroducedIssues.push(nv);
      }
    }

    const scoreDelta = (newVer.risk_score || 0) - (oldVer.risk_score || 0);

    let summary = '';
    if (scoreDelta < 0) {
      summary = `Risk successfully reduced by ${Math.abs(scoreDelta)} points (from ${oldVer.risk_score} to ${newVer.risk_score}). ${resolvedIssues.length} violation(s) remediated.`;
    } else if (scoreDelta === 0) {
      summary = `Risk score remained unchanged at ${newVer.risk_score}.`;
    } else {
      summary = `Warning: Risk increased by ${scoreDelta} points in revision due to ${newlyIntroducedIssues.length} newly introduced issue(s).`;
    }

    return {
      content_id: contentId,
      previous_version: oldVersionNum,
      new_version: newVersionNum,
      previous_risk_score: oldVer.risk_score || 0,
      new_risk_score: newVer.risk_score || 0,
      score_delta: scoreDelta,
      previous_risk_category: oldReport?.risk_category || 'Moderate Risk',
      new_risk_category: newReport?.risk_category || 'Low Risk',
      resolved_issues: resolvedIssues,
      remaining_issues: remainingIssues,
      newly_introduced_issues: newlyIntroducedIssues,
      summary,
      text_diff: {
        original_text: oldVer.content_body,
        revised_text: newVer.content_body,
        changes_count: Math.abs(newVer.content_body.length - oldVer.content_body.length),
      },
    };
  }

  /**
   * Enforce lifecycle state transition boundaries and RBAC permissions.
   */
  public async transitionLifecycleState(params: {
    contentId: string;
    targetStatus: SubmissionStatus;
    userId: string;
    userRole: UserRole;
    orgId: string;
    notes?: string;
    conditions?: string;
  }): Promise<{ content: any; reviewApproval?: any }> {
    const { contentId, targetStatus, userId, userRole, orgId, notes, conditions } = params;

    const subRes = await db.query(
      'SELECT * FROM content_submissions WHERE id = $1 AND org_id = $2',
      [contentId, orgId]
    );

    if (subRes.rows.length === 0) {
      throw new Error('Content submission not found.');
    }
    const sub = subRes.rows[0];
    const currentStatus = sub.status;

    // 1. Role-based Permission Boundary Checks
    if (targetStatus === 'approved' || targetStatus === 'rejected') {
      if (!['admin', 'compliance_officer', 'brand_manager'].includes(userRole)) {
        throw new Error(`Unauthorized: Role "${userRole}" cannot approve or reject content. Requires compliance officer or brand manager.`);
      }

      // Check critical risk policy: Never approve high-risk content without explicit reviewer sign-off
      if (targetStatus === 'approved' && sub.risk_score >= 70 && !notes) {
        throw new Error('Policy Safeguard: Content with Critical Risk (score >= 70) requires explicit written compliance justification notes to be approved.');
      }
    }

    if (targetStatus === 'needs_revision') {
      if (!['admin', 'compliance_officer', 'brand_manager'].includes(userRole)) {
        throw new Error('Unauthorized: Only reviewers or admins can request revisions.');
      }
      if (!notes || notes.trim().length === 0) {
        throw new Error('Feedback notes are required when requesting revisions.');
      }
    }

    if (targetStatus === 'ready_for_review') {
      // Content creator or any user can submit for review
      if (userRole === 'content_creator' && sub.author_id !== userId) {
        throw new Error('Unauthorized: Content creators can only submit their own content drafts.');
      }
    }

    // 2. Perform state transition
    const updated = await db.query(
      `UPDATE content_submissions
       SET status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [
        targetStatus,
        targetStatus === 'rejected' ? (notes || 'Rejected by reviewer') : null,
        contentId,
      ]
    );

    // 3. Record in review_approvals if this was a review decision
    let reviewApproval = null;
    if (['approved', 'rejected', 'needs_revision'].includes(targetStatus)) {
      const revRes = await db.query(
        `INSERT INTO review_approvals (content_id, reviewer_id, stage, decision, feedback_notes, conditions, content_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          contentId,
          userId,
          userRole === 'compliance_officer' ? 'legal_review' : 'brand_review',
          targetStatus,
          notes ? notes.trim() : `Decision: ${targetStatus}`,
          conditions || null,
          sub.current_version || 1,
        ]
      );
      reviewApproval = revRes.rows[0];
    }

    // 4. Record audit log
    await auditService.logEvent({
      orgId,
      userId,
      action: `STATUS_TRANSITION_${targetStatus.toUpperCase()}`,
      resourceType: 'content',
      resourceId: contentId,
      details: {
        previousStatus: currentStatus,
        newStatus: targetStatus,
        reviewerRole: userRole,
        notes,
      },
    });

    return {
      content: updated.rows[0],
      reviewApproval,
    };
  }
}

export const riskAnalysisService = new RiskAnalysisService();
