-- Inkloom Guardian PostgreSQL Schema
-- Database DDL for Brand Governance & Risk Intelligence Platform
-- Extended with Evidence-Backed Claim Verification Engine & Evidence Graph

-- Organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'Enterprise',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'content_creator',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Brand Guidelines
CREATE TABLE IF NOT EXISTS brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Approved Claims (High-level summary index)
CREATE TABLE IF NOT EXISTS approved_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claim_statement TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  verification_status VARCHAR(50) NOT NULL DEFAULT 'verified',
  citation_reference TEXT NOT NULL,
  evidence_url TEXT,
  approved_by VARCHAR(255) NOT NULL,
  expiration_date DATE NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Evidence Sources (Primary approved company source documents: Audit reports, specs, certifications, ESG studies)
CREATE TABLE IF NOT EXISTS evidence_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL,
  version VARCHAR(50) NOT NULL DEFAULT '1.0',
  is_outdated BOOLEAN NOT NULL DEFAULT false,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  file_path TEXT,
  file_hash VARCHAR(100),
  raw_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Source Passages (Traceable passages extracted from evidence sources for granular verification)
CREATE TABLE IF NOT EXISTS source_passages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES evidence_sources(id) ON DELETE CASCADE,
  passage_index INT NOT NULL,
  page_number INT DEFAULT 1,
  section_header VARCHAR(255),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  target_channels TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  consistency_score INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Content Submissions
CREATE TABLE IF NOT EXISTS content_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  channel VARCHAR(100) NOT NULL,
  content_body TEXT NOT NULL,
  file_attachment_url TEXT,
  file_type VARCHAR(50),
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
  risk_score INT NOT NULL DEFAULT 0,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Extracted Claims (Evidence Graph node linking Content -> Extracted Claim -> Source Passage -> Rule)
CREATE TABLE IF NOT EXISTS extracted_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_submissions(id) ON DELETE CASCADE,
  claim_text TEXT NOT NULL,
  claim_type VARCHAR(50) NOT NULL DEFAULT 'factual',
  position_start INT DEFAULT 0,
  position_end INT DEFAULT 0,
  classification VARCHAR(50) NOT NULL DEFAULT 'Unverified',
  confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  confidence_rationale TEXT NOT NULL,
  matched_passage_id UUID REFERENCES source_passages(id) ON DELETE SET NULL,
  matched_rule_id UUID REFERENCES brand_guidelines(id) ON DELETE SET NULL,
  contradiction_details TEXT,
  explanation TEXT NOT NULL,
  suggested_correction TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
  reviewer_decision VARCHAR(50),
  reviewer_notes TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Claim Corrections (Traceability record preserving original text and accepted changes)
CREATE TABLE IF NOT EXISTS claim_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES extracted_claims(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES content_submissions(id) ON DELETE CASCADE,
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  applied_by UUID REFERENCES users(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Risk Reports
CREATE TABLE IF NOT EXISTS risk_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_submissions(id) ON DELETE CASCADE,
  overall_risk_score INT NOT NULL DEFAULT 0,
  tone_score INT NOT NULL DEFAULT 100,
  claims_score INT NOT NULL DEFAULT 100,
  compliance_score INT NOT NULL DEFAULT 100,
  violations JSONB NOT NULL DEFAULT '[]'::jsonb,
  unsubstantiated_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggested_disclaimers JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_model_used VARCHAR(100) NOT NULL DEFAULT 'Inkloom Guardian Evidence Verification Engine',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Human Review & Approvals
CREATE TABLE IF NOT EXISTS review_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage VARCHAR(50) NOT NULL DEFAULT 'brand_review',
  decision VARCHAR(50) NOT NULL,
  feedback_notes TEXT NOT NULL,
  conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  llm_provider VARCHAR(50) NOT NULL DEFAULT 'mock',
  llm_model VARCHAR(100) NOT NULL DEFAULT 'default',
  api_key_configured BOOLEAN NOT NULL DEFAULT false,
  strictness_level VARCHAR(20) NOT NULL DEFAULT 'standard',
  auto_scan_on_submit BOOLEAN NOT NULL DEFAULT true,
  require_dual_approval BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Extracted Facts (Structured factual, numerical, pricing, and specification entities)
CREATE TABLE IF NOT EXISTS campaign_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES content_submissions(id) ON DELETE CASCADE,
  fact_type VARCHAR(50) NOT NULL,
  entity_name VARCHAR(150) NOT NULL,
  raw_text TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  unit VARCHAR(50),
  page_or_location VARCHAR(100),
  confidence NUMERIC(5,2) DEFAULT 0.95,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Contradictions (Cross-asset inconsistencies and evidence deviations)
CREATE TABLE IF NOT EXISTS campaign_contradictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  conflict_type VARCHAR(50) NOT NULL,
  entity_name VARCHAR(150) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'high',
  conflicting_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_truth_ref TEXT,
  approved_truth_value TEXT,
  explanation TEXT NOT NULL,
  suggested_correction TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'unresolved',
  resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_action VARCHAR(50),
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Consistency Scores (Transparent mathematical deduction breakdown)
CREATE TABLE IF NOT EXISTS campaign_consistency_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE UNIQUE,
  overall_score INT NOT NULL DEFAULT 100,
  confirmed_violations_count INT NOT NULL DEFAULT 0,
  unresolved_conflicts_count INT NOT NULL DEFAULT 0,
  unverified_info_count INT NOT NULL DEFAULT 0,
  formula_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Campaign Review Actions (Audit trail of human resolutions, exceptions, and escalations)
CREATE TABLE IF NOT EXISTS campaign_review_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contradiction_id UUID NOT NULL REFERENCES campaign_contradictions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Content Versions (Traceability and Risk Reduction Comparison across content edits)
CREATE TABLE IF NOT EXISTS content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_submissions(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  content_body TEXT NOT NULL,
  title VARCHAR(255) NOT NULL,
  risk_score INT NOT NULL DEFAULT 0,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  status VARCHAR(50) NOT NULL,
  violations_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_report_snapshot JSONB,
  change_summary TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Submission Reviewer Comments & Discussion
CREATE TABLE IF NOT EXISTS submission_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES content_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  is_internal_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Schema Migrations / Alters for existing deployments
ALTER TABLE content_submissions ADD COLUMN IF NOT EXISTS current_version INT NOT NULL DEFAULT 1;
ALTER TABLE content_submissions ADD COLUMN IF NOT EXISTS assigned_reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE content_submissions ADD COLUMN IF NOT EXISTS original_content_body TEXT;
ALTER TABLE content_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE risk_reports ADD COLUMN IF NOT EXISTS risk_category VARCHAR(50) NOT NULL DEFAULT 'Low Risk';
ALTER TABLE risk_reports ADD COLUMN IF NOT EXISTS scoring_formula_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE risk_reports ADD COLUMN IF NOT EXISTS unresolved_uncertainties JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE risk_reports ADD COLUMN IF NOT EXISTS remediation_steps JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE risk_reports ADD COLUMN IF NOT EXISTS content_version INT NOT NULL DEFAULT 1;

ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS risk_scoring_config JSONB;
ALTER TABLE review_approvals ADD COLUMN IF NOT EXISTS content_version INT NOT NULL DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- Reviewer Feedback Records (Transparent Policy Learning from Reviewer Feedback)
CREATE TABLE IF NOT EXISTS reviewer_feedback_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES content_submissions(id) ON DELETE SET NULL,
  rule_id UUID REFERENCES brand_guidelines(id) ON DELETE SET NULL,
  rule_title VARCHAR(255) NOT NULL,
  decision_type VARCHAR(50) NOT NULL,
  original_text TEXT NOT NULL,
  suggested_correction TEXT,
  final_correction TEXT,
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewer_notes TEXT,
  content_category VARCHAR(100),
  is_confidential BOOLEAN NOT NULL DEFAULT false,
  retention_policy_days INT NOT NULL DEFAULT 365,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Policy Candidate Recommendations (Recommended candidate updates to brand guidelines awaiting human sign-off)
CREATE TABLE IF NOT EXISTS policy_candidate_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  target_rule_id UUID REFERENCES brand_guidelines(id) ON DELETE SET NULL,
  recommendation_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  suggested_rule_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT NOT NULL,
  violation_frequency INT NOT NULL DEFAULT 0,
  acceptance_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  rejection_count INT NOT NULL DEFAULT 0,
  exception_count INT NOT NULL DEFAULT 0,
  sample_feedback_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'pending_review',
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  version_applied INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Helpful Indexes
CREATE INDEX IF NOT EXISTS idx_users_org ON users(org_id);
CREATE INDEX IF NOT EXISTS idx_guidelines_org ON brand_guidelines(org_id);
CREATE INDEX IF NOT EXISTS idx_claims_org ON approved_claims(org_id);
CREATE INDEX IF NOT EXISTS idx_evidence_org ON evidence_sources(org_id);
CREATE INDEX IF NOT EXISTS idx_passages_doc ON source_passages(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_content ON extracted_claims(content_id);
CREATE INDEX IF NOT EXISTS idx_extracted_class ON extracted_claims(classification);
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaigns(org_id);
CREATE INDEX IF NOT EXISTS idx_content_org ON content_submissions(org_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content_submissions(status);
CREATE INDEX IF NOT EXISTS idx_content_campaign ON content_submissions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_risk_content ON risk_reports(content_id);
CREATE INDEX IF NOT EXISTS idx_reviews_content ON review_approvals(content_id);
CREATE INDEX IF NOT EXISTS idx_feedback_org ON reviewer_feedback_records(org_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rule ON reviewer_feedback_records(rule_id);
CREATE INDEX IF NOT EXISTS idx_feedback_decision ON reviewer_feedback_records(decision_type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON reviewer_feedback_records(status);
CREATE INDEX IF NOT EXISTS idx_policy_recs_org ON policy_candidate_recommendations(org_id);
CREATE INDEX IF NOT EXISTS idx_policy_recs_status ON policy_candidate_recommendations(status);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_facts_camp ON campaign_facts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_facts_asset ON campaign_facts(asset_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contra_camp ON campaign_contradictions(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_contra_status ON campaign_contradictions(status);
CREATE INDEX IF NOT EXISTS idx_content_versions_content ON content_versions(content_id);
CREATE INDEX IF NOT EXISTS idx_content_versions_num ON content_versions(content_id, version_number);
CREATE INDEX IF NOT EXISTS idx_submission_comments_content ON submission_comments(content_id);
