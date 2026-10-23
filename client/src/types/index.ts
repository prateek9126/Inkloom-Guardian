export type UserRole = 'admin' | 'compliance_officer' | 'brand_manager' | 'content_creator';

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  org_name?: string;
  org_slug?: string;
  org_plan?: string;
  created_at: string;
}

export type GuidelineCategory =
  | 'tone_voice'
  | 'forbidden_terms'
  | 'mandatory_disclaimers'
  | 'visual_guideline'
  | 'regulatory';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface BrandGuideline {
  id: string;
  org_id: string;
  title: string;
  category: GuidelineCategory;
  description: string;
  rules: {
    forbiddenWords?: string[];
    requiredPhrases?: string[];
    allowedTone?: string[];
    forbiddenTone?: string[];
    contextNotes?: string;
    targetChannels?: string[];
  };
  severity: SeverityLevel;
  is_active: boolean;
  version: number;
  created_by?: string;
  author_name?: string;
  created_at: string;
  updated_at: string;
}

export type ClaimVerificationStatus = 'verified' | 'pending_evidence' | 'expired' | 'under_review';

export interface ApprovedClaim {
  id: string;
  org_id: string;
  claim_statement: string;
  category: 'Performance' | 'Financial' | 'Technical' | 'Sustainability' | 'Security';
  verification_status: ClaimVerificationStatus;
  citation_reference: string;
  evidence_url?: string;
  approved_by: string;
  expiration_date: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export type DocumentType =
  | 'policy'
  | 'audit_report'
  | 'technical_spec'
  | 'certification'
  | 'esg_report'
  | 'benchmark_study'
  | 'legal_opinion';

export interface EvidenceSource {
  id: string;
  org_id: string;
  title: string;
  document_type: DocumentType;
  version: string;
  is_outdated: boolean;
  effective_date: string;
  expiration_date?: string;
  file_path?: string;
  file_hash?: string;
  raw_content: string;
  passages_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SourcePassage {
  id: string;
  document_id: string;
  document_title?: string;
  document_type?: DocumentType;
  document_version?: string;
  is_outdated?: boolean;
  passage_index: number;
  page_number?: number;
  section_header?: string;
  content: string;
  created_at: string;
}

export type ClaimType = 'factual' | 'numerical' | 'comparative' | 'promotional';
export type ClaimClassification = 'Supported' | 'Contradicted' | 'Unverified' | 'Needs Human Review';
export type ClaimReviewStatus = 'pending_review' | 'confirmed' | 'rejected' | 'amended';

export interface ExtractedClaim {
  id: string;
  content_id: string;
  claim_text: string;
  claim_type: ClaimType;
  position_start?: number;
  position_end?: number;
  classification: ClaimClassification;
  confidence_score: number;
  confidence_rationale: string;
  matched_passage_id?: string;
  matched_passage?: SourcePassage;
  matched_rule_id?: string;
  matched_rule_title?: string;
  contradiction_details?: string;
  explanation: string;
  suggested_correction?: string;
  status: ClaimReviewStatus;
  reviewer_decision?: string;
  reviewer_notes?: string;
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface EvidenceGraphNode {
  id: string;
  type: 'content' | 'claim' | 'evidence_passage' | 'source_document' | 'brand_rule' | 'human_decision';
  label: string;
  status?: string;
  severity?: string;
  meta?: Record<string, any>;
}

export interface EvidenceGraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: 'extracts_claim' | 'substantiated_by' | 'contradicted_by' | 'violates_rule' | 'contained_in' | 'reviewed_as';
  label: string;
}

export interface EvidenceGraphData {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}

export type FactType =
  | 'price'
  | 'specification'
  | 'warranty'
  | 'date_validity'
  | 'numerical_claim'
  | 'product_name'
  | 'disclaimer'
  | 'messaging';

export interface CampaignFact {
  id: string;
  campaign_id: string;
  asset_id: string;
  asset_title?: string;
  channel?: string;
  fact_type: FactType;
  entity_name: string;
  raw_text: string;
  normalized_value: string;
  unit?: string;
  page_or_location?: string;
  confidence: number;
  created_at: string;
}

export type ConflictType =
  | 'conflicting_price'
  | 'conflicting_spec'
  | 'conflicting_warranty'
  | 'expired_offer_date'
  | 'conflicting_claim'
  | 'missing_disclaimer'
  | 'inconsistent_naming'
  | 'messaging_drift';

export type ContradictionStatus = 'unresolved' | 'resolved' | 'exception' | 'escalated';

export interface ConflictingAssetRef {
  asset_id: string;
  asset_title: string;
  channel: string;
  raw_text: string;
  normalized_value: string;
  location?: string;
}

export interface CampaignContradiction {
  id: string;
  campaign_id: string;
  conflict_type: ConflictType;
  entity_name: string;
  severity: SeverityLevel;
  conflicting_assets: ConflictingAssetRef[];
  approved_truth_ref?: string;
  approved_truth_value?: string;
  explanation: string;
  suggested_correction: string;
  status: ContradictionStatus;
  resolved_by?: string;
  resolved_by_name?: string;
  resolver_name?: string;
  resolved_at?: string;
  resolution_action?: 'accepted_correction' | 'marked_exception' | 'escalated_legal';
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface FormulaDeduction {
  issue_id: string;
  title: string;
  severity: SeverityLevel;
  deduction_points: number;
  reason: string;
}

export interface CampaignConsistencyScoreBreakdown {
  overall_score: number;
  base_score: number;
  confirmed_violations_count: number;
  unresolved_conflicts_count: number;
  unverified_info_count: number;
  deductions: FormulaDeduction[];
  explanation: string;
}

export interface CampaignReviewAction {
  id: string;
  contradiction_id: string;
  user_id?: string;
  user_name?: string;
  action: 'resolve' | 'exception' | 'escalate' | 'revert';
  notes: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  name: string;
  code: string;
  description: string;
  target_channels: string[];
  status: 'active' | 'draft' | 'archived';
  consistency_score: number;
  content_count?: number;
  avg_risk_score?: number;
  created_at: string;
  updated_at: string;
}

export type SubmissionStatus =
  | 'draft'
  | 'analysis_pending'
  | 'analysis_complete'
  | 'needs_revision'
  | 'ready_for_review'
  | 'approved'
  | 'rejected'
  | 'pending_review'
  | 'revision_requested';

export type RiskCategory = 'Low Risk' | 'Moderate Risk' | 'Elevated Risk' | 'Critical Risk';

export type RiskDomain =
  | 'legal_regulatory'
  | 'safety'
  | 'financial_pricing'
  | 'technical_claims'
  | 'brand_voice_naming';

export interface RiskContributionIssue {
  id: string;
  rule_title: string;
  category: string;
  domain: RiskDomain;
  severity: SeverityLevel;
  confidence: number;
  matched_text: string;
  evidence_ref?: string;
  evidence_status: 'contradicted' | 'unverified' | 'supported' | 'rule_violation';
  multi_asset: boolean;
  unresolved: boolean;
  base_points: number;
  domain_multiplier: number;
  confidence_multiplier: number;
  evidence_factor: number;
  campaign_multiplier: number;
  score_contribution: number;
  explanation: string;
  recommended_remediation: string;
}

export interface UnresolvedUncertainty {
  claim_or_issue: string;
  uncertainty_type: 'missing_evidence' | 'outdated_source' | 'ambiguous_phrasing' | 'low_confidence_extraction';
  description: string;
  impact_on_assessment: string;
  recommended_action: string;
}

export interface RiskScoringConfig {
  base_severity_weights: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  domain_multipliers: {
    legal_regulatory: number;
    safety: number;
    financial_pricing: number;
    technical_claims: number;
    brand_voice_naming: number;
  };
  evidence_factors: {
    direct_contradiction: number;
    unverified_unsubstantiated: number;
    supported: number;
  };
  campaign_multipliers: {
    multi_asset: number;
    single_asset: number;
  };
  thresholds: {
    low_max: number;
    moderate_max: number;
    elevated_max: number;
    critical_min: number;
  };
  disclaimer: string;
}

export interface ContentVersion {
  id: string;
  content_id: string;
  version_number: number;
  content_body: string;
  title: string;
  risk_score: number;
  risk_level: SeverityLevel;
  status: SubmissionStatus;
  violations_snapshot: any[];
  risk_report_snapshot?: any;
  change_summary?: string;
  created_by?: string;
  created_by_name?: string;
  created_at: string;
}

export interface SubmissionComment {
  id: string;
  content_id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_role?: UserRole;
  comment_text: string;
  is_internal_only: boolean;
  created_at: string;
}

export interface RiskReductionComparison {
  content_id: string;
  previous_version: number;
  new_version: number;
  previous_risk_score: number;
  new_risk_score: number;
  score_delta: number;
  previous_risk_category: string;
  new_risk_category: string;
  resolved_issues: RiskContributionIssue[];
  remaining_issues: RiskContributionIssue[];
  newly_introduced_issues: RiskContributionIssue[];
  summary: string;
  text_diff: {
    original_text: string;
    revised_text: string;
    changes_count: number;
  };
}

export interface ContentSubmission {
  id: string;
  org_id: string;
  campaign_id?: string;
  campaign_name?: string;
  campaign_code?: string;
  author_id: string;
  author_name?: string;
  author_email?: string;
  title: string;
  channel: string;
  content_body: string;
  original_content_body?: string;
  current_version: number;
  assigned_reviewer_id?: string;
  assigned_reviewer_name?: string;
  reviewer_name?: string;
  rejection_reason?: string;
  file_attachment_url?: string;
  file_type?: string;
  status: SubmissionStatus;
  risk_score: number;
  risk_level: SeverityLevel;
  risk_category?: RiskCategory;
  claims_breakdown?: {
    total: number;
    supported: number;
    contradicted: number;
    unverified: number;
    needsReview: number;
  };
  created_at: string;
  updated_at: string;
}

export interface RiskViolation {
  id: string;
  ruleId?: string;
  ruleTitle: string;
  category: GuidelineCategory | 'claims' | 'regulatory';
  severity: SeverityLevel;
  matchedText: string;
  position?: { start: number; end: number };
  explanation: string;
  suggestedFix: string;
  status: 'unresolved' | 'accepted' | 'ignored';
  justification?: string;
}

export interface UnsubstantiatedClaimFinding {
  claimText: string;
  confidence: number;
  issue: string;
  recommendation: string;
}

export interface RiskReport {
  id: string;
  content_id: string;
  content_version?: number;
  overall_risk_score: number;
  risk_category?: RiskCategory;
  tone_score: number;
  claims_score: number;
  compliance_score: number;
  violations: RiskViolation[];
  unsubstantiated_claims: UnsubstantiatedClaimFinding[];
  suggested_disclaimers: string[];
  contributing_issues?: RiskContributionIssue[];
  unresolved_uncertainties?: UnresolvedUncertainty[];
  remediation_steps?: string[];
  scoring_formula_breakdown?: {
    base_formula: string;
    total_raw_points: number;
    clamped_score: number;
    deduplicated_count: number;
    config_applied: RiskScoringConfig;
    disclaimer: string;
  };
  ai_model_used: string;
  created_at: string;
}

export type ExplainableRiskReport = RiskReport;

export interface ReviewApproval {
  id: string;
  content_id: string;
  content_version?: number;
  reviewer_id: string;
  reviewer_name?: string;
  reviewer_role?: string;
  stage: 'brand_review' | 'legal_review' | 'executive_signoff';
  decision: 'approved' | 'rejected' | 'revision_requested';
  feedback_notes: string;
  conditions?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  org_id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  org_id: string;
  llm_provider: string;
  llm_model: string;
  api_key_configured: boolean;
  strictness_level: 'lenient' | 'standard' | 'strict';
  auto_scan_on_submit: boolean;
  require_dual_approval: boolean;
  updated_at: string;
}

export interface DashboardMetrics {
  pendingReviewsCount: number;
  verifiedClaimsCount: number;
  unresolvedIssuesCount: number;
  activeGuidelinesCount: number;
  activeCampaignsCount: number;
  totalApprovalsCount: number;
  riskBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lifecycleBreakdown?: {
    readyForReview: number;
    needsRevision: number;
    analysisPending: number;
    analysisComplete: number;
    approved: number;
    rejected: number;
    draft: number;
  };
}

// ==========================================
// Policy Learning from Reviewer Decisions
// ==========================================

export type ReviewerDecisionType =
  | 'accepted_correction'
  | 'rejected_suggestion'
  | 'documented_exception'
  | 'manual_edit';

export interface ReviewerFeedbackRecord {
  id: string;
  org_id: string;
  submission_id?: string;
  rule_id?: string;
  rule_title: string;
  decision_type: ReviewerDecisionType;
  original_text: string;
  suggested_correction?: string;
  final_correction?: string;
  reviewer_id: string;
  reviewer_name?: string;
  reviewer_notes?: string;
  content_category?: string;
  is_confidential: boolean;
  retention_policy_days: number;
  status: 'active' | 'corrected' | 'purged';
  created_at: string;
  updated_at: string;
}

export type PolicyRecommendationType =
  | 'update_existing_rule'
  | 'new_candidate_rule'
  | 'add_approved_exception'
  | 'retire_rule';

export interface PolicyCandidateRecommendation {
  id: string;
  org_id: string;
  target_rule_id?: string;
  recommendation_type: PolicyRecommendationType;
  title: string;
  category: string;
  description: string;
  suggested_rule_content: Record<string, any>;
  rationale: string;
  violation_frequency: number;
  acceptance_rate: number;
  rejection_count: number;
  exception_count: number;
  sample_feedback_ids: string[];
  status: 'pending_review' | 'approved' | 'rejected';
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  version_applied?: number;
  created_at: string;
  updated_at: string;
}

export interface FrequentlyViolatedRuleStat {
  rule_id: string;
  rule_title: string;
  category: string;
  violation_count: number;
  accepted_corrections_count: number;
  rejected_suggestions_count: number;
  exceptions_count: number;
  acceptance_rate_percent: number;
}

export interface ApprovedCorrectionSample {
  rule_id: string;
  rule_title: string;
  original_text: string;
  suggested_correction: string;
  final_correction: string;
  decision_type: ReviewerDecisionType;
  source: 'reviewer_preference';
  disclaimer: string;
}

export interface RecurringQualityIssue {
  issue_type: string;
  pattern_description: string;
  occurrences_count: number;
  affected_channels: string[];
  sample_contexts: string[];
}

export interface PolicyLearningSummary {
  total_feedback_records: number;
  overall_acceptance_rate: number;
  frequently_violated_rules: FrequentlyViolatedRuleStat[];
  recurring_quality_issues: RecurringQualityIssue[];
  candidate_recommendations_count: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

export interface DemoStatus {
  isInitialized: boolean;
  orgId?: string;
  orgName?: string;
  stats?: {
    usersCount: number;
    guidelinesCount: number;
    evidenceDocumentsCount: number;
    approvedClaimsCount: number;
    campaignAssetsCount: number;
    contradictionsCount: number;
    pendingReviewsCount: number;
  };
}

export interface DemoWalkthroughStep {
  step: number;
  title: string;
  route: string;
  role: UserRole;
  summary: string;
  judgeAction: string;
  deliberateIssue: string;
  evidenceSource: string;
}

export interface DemoSnippets {
  [key: string]: any;
}

