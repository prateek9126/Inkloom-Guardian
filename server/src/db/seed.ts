import bcrypt from 'bcryptjs';
import { db } from './db.js';
import { runMigrations } from './migrate.js';
import { claimVerificationService } from '../services/claimVerificationService.js';
import { campaignConsistencyService } from '../services/campaignConsistencyService.js';

export async function seedDatabase(force: boolean = false): Promise<void> {
  console.log('[Seed] Ensuring schema is up to date...');
  await runMigrations();

  // Check if data already exists
  const existingOrg = await db.query('SELECT id FROM organizations LIMIT 1');
  if (existingOrg.rows.length > 0 && !force) {
    const orgId = existingOrg.rows[0].id;
    const existingFeedback = await db.query('SELECT id FROM reviewer_feedback_records LIMIT 1');
    if (existingFeedback.rows.length === 0) {
      console.log('[Seed] Seeding missing Reviewer Feedback Records and Policy Learning Candidates into existing database...');
      const usersRes = await db.query('SELECT id, role FROM users WHERE org_id = $1', [orgId]);
      const complianceUser = usersRes.rows.find((u: any) => u.role === 'compliance_officer') || usersRes.rows[0];
      const brandUser = usersRes.rows.find((u: any) => u.role === 'brand_manager') || usersRes.rows[0];
      if (complianceUser && brandUser) {
        await seedPolicyFeedbackData(orgId, complianceUser.id, brandUser.id);
      }
    }
    console.log('[Seed] Database already contains records. Skipping seed.');
    return;
  }

  console.log('[Seed] Seeding realistic demonstration data with Evidence Graph (clearly labeled as demonstration data)...');

  // Clear existing if force
  if (force) {
    await db.query('DELETE FROM campaign_review_actions');
    await db.query('DELETE FROM campaign_consistency_scores');
    await db.query('DELETE FROM campaign_contradictions');
    await db.query('DELETE FROM campaign_facts');
    await db.query('DELETE FROM policy_candidate_recommendations');
    await db.query('DELETE FROM reviewer_feedback_records');
    await db.query('DELETE FROM claim_corrections');
    await db.query('DELETE FROM extracted_claims');
    await db.query('DELETE FROM source_passages');
    await db.query('DELETE FROM evidence_sources');
    await db.query('DELETE FROM audit_logs');
    await db.query('DELETE FROM review_approvals');
    await db.query('DELETE FROM risk_reports');
    await db.query('DELETE FROM content_submissions');
    await db.query('DELETE FROM campaigns');
    await db.query('DELETE FROM approved_claims');
    await db.query('DELETE FROM brand_guidelines');
    await db.query('DELETE FROM system_settings');
    await db.query('DELETE FROM users');
    await db.query('DELETE FROM organizations');
  }

  // 1. Create Organization
  const orgResult = await db.query(
    `INSERT INTO organizations (name, slug, plan)
     VALUES ($1, $2, $3)
     RETURNING id`,
    ['Acme Global Technologies (Demonstration)', 'acme-global-demo', 'Enterprise Guardian']
  );
  const orgId = orgResult.rows[0].id;

  // 2. Create Users
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const adminUser = await db.query(
    `INSERT INTO users (org_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [orgId, 'admin@inkloom.enterprise', passwordHash, 'Eleanor Vance (Chief Governance Officer)', 'admin']
  );

  const complianceUser = await db.query(
    `INSERT INTO users (org_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [orgId, 'compliance@inkloom.enterprise', passwordHash, 'David Sterling (Lead Regulatory Counsel)', 'compliance_officer']
  );

  const brandUser = await db.query(
    `INSERT INTO users (org_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [orgId, 'brand@inkloom.enterprise', passwordHash, 'Sarah Jenkins (Global Brand Director)', 'brand_manager']
  );

  const creatorUser = await db.query(
    `INSERT INTO users (org_id, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [orgId, 'creator@inkloom.enterprise', passwordHash, 'Marcus Hayes (Senior Marketing Writer)', 'content_creator']
  );

  const adminId = adminUser.rows[0].id;
  const complianceId = complianceUser.rows[0].id;
  const brandId = brandUser.rows[0].id;
  const creatorId = creatorUser.rows[0].id;

  // 3. System Settings
  await db.query(
    `INSERT INTO system_settings (org_id, llm_provider, llm_model, api_key_configured, strictness_level, auto_scan_on_submit, require_dual_approval)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [orgId, 'mock', 'inkloom-deterministic-v2', true, 'standard', true, true]
  );

  // 4. Brand Guidelines (Demonstration Data)
  const g1 = await db.query(
    `INSERT INTO brand_guidelines (org_id, title, category, description, rules, severity, is_active, version, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      '[Demo] Prohibited Hyperbole & Absolute Performance Claims',
      'forbidden_terms',
      'Ensure all product copy refrains from unsupportable superlatives, exaggerated statements of perfection, or unwarranted financial returns.',
      JSON.stringify({
        forbiddenWords: [
          'guaranteed ROI',
          'zero risk',
          'best in the world',
          'unbreakable security',
          'flawless',
          'revolutionary breakthrough',
          '100% risk free',
          'miracle solution'
        ],
        contextNotes: 'Replace hyperbolic claims with specific verified metrics from the Claims Library.'
      }),
      'critical',
      true,
      1,
      brandId
    ]
  );

  const g2 = await db.query(
    `INSERT INTO brand_guidelines (org_id, title, category, description, rules, severity, is_active, version, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      '[Demo] Tone & Voice: Authoritative, Objective & Transparent',
      'tone_voice',
      'Brand communication must reflect professional authority, intellectual rigor, and transparency. Avoid aggressive sales tactics and informal jargon.',
      JSON.stringify({
        allowedTone: ['authoritative', 'objective', 'rigorous', 'professional', 'clear'],
        forbiddenTone: ['sensationalist', 'aggressive', 'condescending', 'colloquial'],
        forbiddenWords: ['crazy cheap', 'act now before it is gone', 'insane discount', 'blow your mind']
      }),
      'high',
      true,
      2,
      brandId
    ]
  );

  const g3 = await db.query(
    `INSERT INTO brand_guidelines (org_id, title, category, description, rules, severity, is_active, version, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      '[Demo] Mandatory Regulatory & SLA Disclaimers',
      'mandatory_disclaimers',
      'Required legal footnotes and qualifiers when citing system uptime, infrastructure performance, or financial benefits.',
      JSON.stringify({
        requiredPhrases: [
          'Results may vary based on client infrastructure and workload parameters.',
          'Subject to standard enterprise SLA terms and scheduled maintenance windows.'
        ],
        targetChannels: ['Landing Page', 'Press Release', 'Whitepaper']
      }),
      'high',
      true,
      1,
      complianceId
    ]
  );

  await db.query(
    `INSERT INTO brand_guidelines (org_id, title, category, description, rules, severity, is_active, version, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      orgId,
      '[Demo] Visual & Channel Consistency Rules',
      'visual_guideline',
      'Standardized rules for logo attribution, trademark notations (Inkloom®), and social media disclaimer positioning.',
      JSON.stringify({
        requiredPhrases: ['Inkloom® Guardian'],
        forbiddenWords: ['Ink-loom', 'Ink Loom Guardian']
      }),
      'medium',
      true,
      1,
      brandId
    ]
  );

  // 5. Approved Claims Summary Library
  const claimsData = [
    {
      statement: 'Inkloom platform reduces enterprise content compliance review cycle times by 42% on average.',
      category: 'Performance',
      status: 'verified',
      citation: '2025 Enterprise Content Governance Benchmark Study, §4.2 (Audit Ref: AUD-2025-089)',
      evidenceUrl: 'https://evidence.example.com/reports/benchmark-2025.pdf',
      approver: 'David Sterling (Lead Regulatory Counsel)',
      expiry: '2026-12-31',
      usage: 28
    },
    {
      statement: 'Achieved SOC 2 Type II and ISO/IEC 27001:2022 certifications across all production hosting facilities.',
      category: 'Security',
      status: 'verified',
      citation: 'Independent Audit Attestation issued by Ernst & Young LLP, dated Nov 14 2025',
      evidenceUrl: 'https://evidence.example.com/certs/soc2-type2-2025.pdf',
      approver: 'David Sterling (Lead Regulatory Counsel)',
      expiry: '2027-01-15',
      usage: 45
    },
    {
      statement: 'Maintains 99.99% core platform availability backed by financially supported Service Level Agreements.',
      category: 'Technical',
      status: 'verified',
      citation: 'Production Operations Telemetry & Service Level Report 2025 Q1-Q4',
      evidenceUrl: 'https://evidence.example.com/sla/uptime-log-2025.pdf',
      approver: 'Sarah Jenkins (Global Brand Director)',
      expiry: '2026-11-30',
      usage: 19
    },
    {
      statement: 'Decreased operational scope 2 greenhouse gas emissions by 28% through 100% renewable energy data centers.',
      category: 'Sustainability',
      status: 'verified',
      citation: '2025 ESG and Sustainability Progress Report §3.1',
      evidenceUrl: 'https://evidence.example.com/reports/esg-2025.pdf',
      approver: 'David Sterling (Lead Regulatory Counsel)',
      expiry: '2026-06-30',
      usage: 8
    }
  ];

  for (const c of claimsData) {
    await db.query(
      `INSERT INTO approved_claims (org_id, claim_statement, category, verification_status, citation_reference, evidence_url, approved_by, expiration_date, usage_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [orgId, c.statement, c.category, c.status, c.citation, c.evidenceUrl, c.approver, c.expiry, c.usage]
    );
  }

  // 6. Evidence Sources & Source Passages (Traceable Primary Documents)
  // Doc 1: Benchmark Study
  const doc1Res = await db.query(
    `INSERT INTO evidence_sources (org_id, title, document_type, version, is_outdated, effective_date, expiration_date, raw_content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      orgId,
      '2025 Enterprise Content Governance Benchmark Study',
      'benchmark_study',
      '1.2',
      false,
      '2025-01-15',
      '2026-12-31',
      `EXECUTIVE BENCHMARK REPORT
Section 1: Methodology
Data was gathered across 140 enterprise deployment cohorts over twelve operational months.

Section 4: Efficiency Benchmarks
Across all cohorts, the Inkloom platform demonstrated an average content compliance review cycle time reduction of 42% compared to manual multi-stakeholder routing.

Section 5: Error Rates
Post-publication corrective disclaimers dropped by 68% within 90 days of automated policy enforcement.`
    ]
  );
  const doc1Id = doc1Res.rows[0].id;

  await db.query(
    `INSERT INTO source_passages (document_id, passage_index, page_number, section_header, content)
     VALUES 
     ($1, 1, 1, 'Executive Summary', 'Data was gathered across 140 enterprise deployment cohorts over twelve operational months.'),
     ($1, 2, 4, 'Efficiency Benchmarks', 'Across all cohorts, the Inkloom platform demonstrated an average content compliance review cycle time reduction of 42% compared to manual multi-stakeholder routing.'),
     ($1, 3, 5, 'Error Rates', 'Post-publication corrective disclaimers dropped by 68% within 90 days of automated policy enforcement.')`,
    [doc1Id]
  );

  // Doc 2: Security Certifications
  const doc2Res = await db.query(
    `INSERT INTO evidence_sources (org_id, title, document_type, version, is_outdated, effective_date, expiration_date, raw_content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      orgId,
      'SOC 2 Type II and ISO 27001 Certification Attestation',
      'certification',
      '2025.1',
      false,
      '2025-11-14',
      '2027-01-15',
      `INDEPENDENT AUDITOR ATTESTATION REPORT
To the Management of Acme Global Technologies:

We have examined Acme Global Technologies compliance with Trust Services Criteria.
Independent examination confirmed that Acme Global Technologies maintains SOC 2 Type II and ISO/IEC 27001:2022 certifications across all production data centers and hosting environments.

Security boundaries encompass encryption at rest (AES-256) and in transit (TLS 1.3).`
    ]
  );
  const doc2Id = doc2Res.rows[0].id;

  await db.query(
    `INSERT INTO source_passages (document_id, passage_index, page_number, section_header, content)
     VALUES 
     ($1, 1, 1, 'Auditor Scope', 'We have examined Acme Global Technologies compliance with Trust Services Criteria.'),
     ($1, 2, 2, 'Security Certifications', 'Independent examination confirmed that Acme Global Technologies maintains SOC 2 Type II and ISO/IEC 27001:2022 certifications across all production data centers and hosting environments.'),
     ($1, 3, 3, 'Encryption Standards', 'Security boundaries encompass encryption at rest (AES-256) and in transit (TLS 1.3).')`,
    [doc2Id]
  );

  // Doc 3: SLA Technical Policy
  const doc3Res = await db.query(
    `INSERT INTO evidence_sources (org_id, title, document_type, version, is_outdated, effective_date, expiration_date, raw_content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      orgId,
      'Enterprise Service Level Agreement & Availability Policy',
      'technical_spec',
      '3.1',
      false,
      '2025-06-01',
      '2027-06-01',
      `SERVICE LEVEL AGREEMENT
Section 3: Availability Commitments
Core platform availability is guaranteed at 99.99% monthly uptime, excluding scheduled maintenance announced 72 hours in advance.

Section 4: Performance Disclaimers
Results may vary based on client infrastructure and workload parameters. Enterprise credits are calculated in accordance with Schedule B.`
    ]
  );
  const doc3Id = doc3Res.rows[0].id;

  await db.query(
    `INSERT INTO source_passages (document_id, passage_index, page_number, section_header, content)
     VALUES 
     ($1, 1, 3, 'Uptime SLA', 'Core platform availability is guaranteed at 99.99% monthly uptime, excluding scheduled maintenance announced 72 hours in advance.'),
     ($1, 2, 4, 'Performance Qualification', 'Results may vary based on client infrastructure and workload parameters. Enterprise credits are calculated in accordance with Schedule B.')`,
    [doc3Id]
  );

  // Doc 4: Outdated ESG Report (to demonstrate outdated evidence detection!)
  const doc4Res = await db.query(
    `INSERT INTO evidence_sources (org_id, title, document_type, version, is_outdated, effective_date, expiration_date, raw_content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      orgId,
      '2023 Sustainability Interim Assessment (SUPERSEDED / OUTDATED)',
      'esg_report',
      '1.0-archive',
      true,
      '2023-01-01',
      '2023-12-31',
      `HISTORICAL ARCHIVE
In fiscal year 2023, data center operations achieved an initial 14% scope 2 emissions reduction under pilot energy contracts.`
    ]
  );
  const doc4Id = doc4Res.rows[0].id;

  await db.query(
    `INSERT INTO source_passages (document_id, passage_index, page_number, section_header, content)
     VALUES ($1, 1, 1, 'Historical Baseline', 'In fiscal year 2023, data center operations achieved an initial 14% scope 2 emissions reduction under pilot energy contracts.')`,
    [doc4Id]
  );

  // Doc 5: Current ESG Report (28% emissions reduction)
  const doc5Res = await db.query(
    `INSERT INTO evidence_sources (org_id, title, document_type, version, is_outdated, effective_date, expiration_date, raw_content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      orgId,
      '2025 ESG and Environmental Sustainability Progress Report',
      'esg_report',
      '2.0',
      false,
      '2025-01-01',
      '2026-06-30',
      `2025 SUSTAINABILITY AUDIT REPORT
Section 3: Greenhouse Gas Accounting
Acme Global Technologies decreased operational scope 2 greenhouse gas emissions by 28% through 100% renewable energy data center procurement.`
    ]
  );
  const doc5Id = doc5Res.rows[0].id;

  await db.query(
    `INSERT INTO source_passages (document_id, passage_index, page_number, section_header, content)
     VALUES ($1, 1, 3, 'Emissions Progress', 'Acme Global Technologies decreased operational scope 2 greenhouse gas emissions by 28% through 100% renewable energy data center procurement.')`,
    [doc5Id]
  );

  // Doc 6: Technical Hardware Specification Doc v3.1 (Battery & Hardware truth)
  const doc6Res = await db.query(
    `INSERT INTO evidence_sources (org_id, title, document_type, version, is_outdated, effective_date, expiration_date, raw_content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      orgId,
      'Technical Hardware Specification Doc v3.1',
      'technical_spec',
      '3.1',
      false,
      '2026-01-01',
      '2027-12-31',
      `TECHNICAL HARDWARE SPECIFICATIONS: EDGE GUARDIAN APPLIANCE
Section 4: Battery & Power Management
The certified benchmark for active battery endurance is exactly 20 hours active endurance under standard enterprise workload conditions. Standby mode extends up to 72 hours.

Section 6: Warranty & Service
All Edge Guardian appliances include a standard 1-year standard hardware warranty covering component failures.`
    ]
  );
  const doc6Id = doc6Res.rows[0].id;

  await db.query(
    `INSERT INTO source_passages (document_id, passage_index, page_number, section_header, content)
     VALUES 
     ($1, 1, 4, 'Battery Endurance Specification', 'The certified benchmark for active battery endurance is exactly 20 hours active endurance under standard enterprise workload conditions.'),
     ($1, 2, 6, 'Standard Warranty Policy', 'All Edge Guardian appliances include a standard 1-year standard hardware warranty covering component failures.')`,
    [doc6Id]
  );

  // Doc 7: Enterprise Master Price Sheet 2026 (Pricing & Validity truth)
  const doc7Res = await db.query(
    `INSERT INTO evidence_sources (org_id, title, document_type, version, is_outdated, effective_date, expiration_date, raw_content)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      orgId,
      'Enterprise Master Price Sheet 2026',
      'brand_guideline',
      '2026.4',
      false,
      '2026-01-01',
      '2026-12-31',
      `COMMERCIAL PRICING POLICY: FISCAL YEAR 2026
Section 2: Enterprise Tier
The authorized rate for the Enterprise Tier is strictly $499/month billed annually or monthly. No unauthorized discounting below this floor is permitted without CFO sign-off.

Section 5: Promotional Validity
Current Q4 promotional campaigns are authorized through December 31, 2026.`
    ]
  );
  const doc7Id = doc7Res.rows[0].id;

  await db.query(
    `INSERT INTO source_passages (document_id, passage_index, page_number, section_header, content)
     VALUES 
     ($1, 1, 2, 'Enterprise Pricing Tier', 'The authorized rate for the Enterprise Tier is strictly $499/month billed annually or monthly.'),
     ($1, 2, 5, 'Campaign Expiration Cutoff', 'Current Q4 promotional campaigns are authorized through December 31, 2026.')`,
    [doc7Id]
  );

  // 7. Campaigns
  const camp1 = await db.query(
    `INSERT INTO campaigns (org_id, name, code, description, target_channels, status, consistency_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      orgId,
      '[Demo] Q4 Cloud Governance Initiative',
      'CAMP-2026-CLOUD',
      'Multi-channel product launch campaign communicating automated brand risk detection for Fortune 500 enterprises.',
      ['Landing Page', 'Press Release', 'Email Campaign', 'Social Media'],
      'active',
      88
    ]
  );

  const camp2 = await db.query(
    `INSERT INTO campaigns (org_id, name, code, description, target_channels, status, consistency_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      orgId,
      '[Demo] Trust & Data Governance Assurance',
      'CAMP-2026-TRUST',
      'Regulatory compliance and customer privacy campaign highlighting enterprise certifications and human oversight.',
      ['Whitepaper', 'Social Media', 'Email Campaign'],
      'active',
      96
    ]
  );

  // Campaign 3: Cross-Campaign Consistency Demonstration Scenario
  const camp3 = await db.query(
    `INSERT INTO campaigns (org_id, name, code, description, target_channels, status, consistency_score)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      orgId,
      '[Demo] Q4 Enterprise Cloud & Hardware Initiative',
      'CAMP-2026-HW',
      'Cross-channel product launch showcasing Edge Guardian appliances. Features intentional multi-asset contradictions for consistency engine demonstration.',
      ['Landing Page', 'Social Media', 'Whitepaper', 'Email Campaign'],
      'active',
      100
    ]
  );

  const camp1Id = camp1.rows[0].id;
  const camp2Id = camp2.rows[0].id;
  const camp3Id = camp3.rows[0].id;

  // 8. Content Submissions
  // Submission 1: Contains Supported claim (42%), Contradicted claim ("guaranteed ROI", "zero risk"), and Unverified claim ("100% unbreakable")
  const sub1 = await db.query(
    `INSERT INTO content_submissions (org_id, campaign_id, author_id, title, channel, content_body, status, risk_score, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      camp1Id,
      creatorId,
      '[Demo] Q4 Cloud Governance Press Release Draft',
      'Press Release',
      `FOR IMMEDIATE RELEASE: Inkloom Guardian Unveils Revolutionary Cloud Governance Suite

Acme Global Technologies today announced the launch of its next-generation platform, delivering guaranteed ROI and unbreakable security for corporate communications. 

Our revolutionary breakthrough technology ensures that content is completely flawless prior to distribution. Inkloom platform reduces enterprise content compliance review cycle times by 42% on average.

With zero risk for marketing teams, organizations can deploy cross-channel assets faster than ever before. Contact our enterprise sales team today for an exclusive preview.`,
      'pending_review',
      78,
      'high'
    ]
  );
  const sub1Id = sub1.rows[0].id;

  // Run full Claim Verification pipeline on Submission 1
  await claimVerificationService.verifyContentClaims(sub1Id, orgId, creatorId);

  // Submission 2: Clean, fully supported content
  const sub2 = await db.query(
    `INSERT INTO content_submissions (org_id, campaign_id, author_id, title, channel, content_body, status, risk_score, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      camp2Id,
      creatorId,
      '[Demo] Enterprise SOC 2 & ISO Certification Announcement',
      'Social Media',
      `We are pleased to announce that Acme Global Technologies has achieved SOC 2 Type II and ISO/IEC 27001:2022 certifications across all production hosting facilities.

Our dedication to information security and data integrity remains our highest operational priority. Inkloom® Guardian empowers teams to automate governance while preserving human oversight.

Read the executive security summary: https://trust.acme.example.com/compliance`,
      'approved',
      8,
      'low'
    ]
  );
  const sub2Id = sub2.rows[0].id;
  await claimVerificationService.verifyContentClaims(sub2Id, orgId, creatorId);

  // Submission 3: Contradicted & Outdated Claims demo
  const sub3 = await db.query(
    `INSERT INTO content_submissions (org_id, campaign_id, author_id, title, channel, content_body, status, risk_score, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      camp1Id,
      creatorId,
      '[Demo] 2026 Infrastructure & ESG Sustainability Fact Sheet',
      'Whitepaper',
      `Our next-generation data centers guarantee 99.999% uptime for mission critical enterprise applications.

Through extensive efficiency measures, Acme decreased operational scope 2 greenhouse gas emissions by 50% across global cloud regions.

Results may vary based on client infrastructure and workload parameters.`,
      'revision_requested',
      62,
      'high'
    ]
  );
  const sub3Id = sub3.rows[0].id;
  await claimVerificationService.verifyContentClaims(sub3Id, orgId, creatorId);

  // Submissions 4, 5, 6: Cross-Campaign Consistency Multi-Asset Scenario (CAMP-2026-HW)
  // Asset 1: Landing Page (Battery: 18 hours, Price: $499/mo, Expiry: Dec 31 2026, Warranty: 1-year)
  const sub4 = await db.query(
    `INSERT INTO content_submissions (org_id, campaign_id, author_id, title, channel, content_body, status, risk_score, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      camp3Id,
      creatorId,
      '[Demo] Enterprise Edge Appliance Landing Page',
      'Landing Page',
      `WELCOME TO INKLOOM GUARDIAN ENTERPRISE EDGE

Transform your corporate governance infrastructure with the new Inkloom Guardian Edge appliance. Engineered for distributed enterprise environments, the hardware delivers up to 18 hours battery life for remote fieldwork and auditing.

PRICING & LICENSING
Enterprise tier is priced at $499/mo with full compliance automation. Offer valid through December 31, 2026.
Every system includes a 1-year limited warranty and enterprise onboarding support.

Results may vary based on client infrastructure and workload parameters.`,
      'pending_review',
      35,
      'medium'
    ]
  );
  const sub4Id = sub4.rows[0].id;

  // Asset 2: Social Media Banner (Battery: 24 hours, Price: $399/mo, Expiry: Sep 30 2026 EXPIRED, Name: Ink-loom)
  const sub5 = await db.query(
    `INSERT INTO content_submissions (org_id, campaign_id, author_id, title, channel, content_body, status, risk_score, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      camp3Id,
      creatorId,
      '[Demo] Social Media & Ad Banner Campaign Asset',
      'Social Media',
      `BREAKTHROUGH ANNOUNCEMENT: The all-new Ink-loom Guardian Edge device is here!

Engineered with 24-hour battery endurance to empower your compliance and legal teams anywhere.
Special promotional discount: Enterprise tier $399/mo for qualifying enterprise accounts.
Hurry! Offer valid through September 30, 2026.

Sign up today to claim your enterprise evaluation kit!`,
      'pending_review',
      82,
      'critical'
    ]
  );
  const sub5Id = sub5.rows[0].id;

  // Asset 3: Product Data Sheet (Battery: 30 hours, Price: $599/mo, Warranty: 2-year, Missing Footnote)
  const sub6 = await db.query(
    `INSERT INTO content_submissions (org_id, campaign_id, author_id, title, channel, content_body, status, risk_score, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      orgId,
      camp3Id,
      creatorId,
      '[Demo] Edge Hardware Technical Data Sheet',
      'Whitepaper',
      `TECHNICAL DATA SHEET: INKLOOM GUARDIAN EDGE APPLIANCE v3.1

OVERVIEW & RELIABILITY
Continuous active operation battery lasts up to 30 hours under laboratory test conditions. Designed for high-throughput enterprise governance telemetry.

COMMERCIAL TERMS
Standard Enterprise tier $599/mo list price.
Backed by an extended 2-year enterprise warranty covering hardware replacements and advance RMA.`,
      'pending_review',
      74,
      'high'
    ]
  );
  const sub6Id = sub6.rows[0].id;

  // Run Cross-Campaign Consistency Analysis on Demonstration Campaign 3
  console.log('[Seed] Running Cross-Campaign Consistency Intelligence Scan on Demo Campaign...');
  await campaignConsistencyService.analyzeCampaignConsistency(camp3Id, orgId, complianceId);

  // Approvals & Audit logs
  await db.query(
    `INSERT INTO review_approvals (content_id, reviewer_id, stage, decision, feedback_notes)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      sub2Id,
      complianceId,
      'legal_review',
      'approved',
      'All security credentials verified against Ernst & Young audit certificate. Approved for distribution.'
    ]
  );

  const initialLogs = [
    {
      userId: adminId,
      action: 'ORGANIZATION_INITIALIZED',
      resourceType: 'org',
      resourceId: String(orgId),
      details: { plan: 'Enterprise Guardian' },
      ip: '192.168.1.10'
    },
    {
      userId: complianceId,
      action: 'SOURCE_DOCUMENT_UPLOADED',
      resourceType: 'evidence',
      resourceId: String(doc1Id),
      details: { title: '2025 Enterprise Content Governance Benchmark Study' },
      ip: '192.168.1.18'
    },
    {
      userId: complianceId,
      action: 'SOURCE_DOCUMENT_UPLOADED',
      resourceType: 'evidence',
      resourceId: String(doc2Id),
      details: { title: 'SOC 2 Type II and ISO 27001 Certification Attestation' },
      ip: '192.168.1.18'
    },
    {
      userId: complianceId,
      action: 'APPROVAL_GRANTED',
      resourceType: 'content',
      resourceId: String(sub2Id),
      details: { decision: 'approved' },
      ip: '192.168.1.18'
    }
  ];

  for (const log of initialLogs) {
    await db.query(
      `INSERT INTO audit_logs (org_id, user_id, action, resource_type, resource_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [orgId, log.userId, log.action, log.resourceType, log.resourceId, JSON.stringify(log.details), log.ip]
    );
  }

  await seedPolicyFeedbackData(orgId, complianceId, brandId);

  console.log('[Seed] Database successfully seeded with Evidence Sources, Passages, and verified Claims.');
}

async function seedPolicyFeedbackData(orgId: string, complianceId: string, brandId: string): Promise<void> {
  console.log('[Seed] Seeding Reviewer Feedback Records and Policy Learning Candidates...');

  // Find rule IDs for exact reference
  const superlativesRule = await db.query(
    `SELECT id FROM brand_guidelines WHERE org_id = $1 AND title ILIKE '%Superlatives%' LIMIT 1`,
    [orgId]
  );
  const ftcRule = await db.query(
    `SELECT id FROM brand_guidelines WHERE org_id = $1 AND title ILIKE '%FTC%' LIMIT 1`,
    [orgId]
  );
  const esgRule = await db.query(
    `SELECT id FROM brand_guidelines WHERE org_id = $1 AND title ILIKE '%ESG%' LIMIT 1`,
    [orgId]
  );
  const pricingRule = await db.query(
    `SELECT id FROM brand_guidelines WHERE org_id = $1 AND title ILIKE '%Pricing%' LIMIT 1`,
    [orgId]
  );

  const supRuleId = superlativesRule.rows[0]?.id || null;
  const ftcRuleId = ftcRule.rows[0]?.id || null;
  const esgRuleId = esgRule.rows[0]?.id || null;
  const pricingRuleId = pricingRule.rows[0]?.id || null;

  const feedbackSeeds = [
    {
      ruleId: supRuleId,
      ruleTitle: 'Prohibit Unqualified Superlatives and Absolute Guarantees',
      decisionType: 'accepted_correction',
      originalText: 'Inkloom provides a 100% infallible zero-risk brand protection solution.',
      suggestedCorrection: 'Inkloom provides automated brand risk detection substantiated by verified primary documentation.',
      finalCorrection: 'Inkloom provides continuous automated brand risk detection substantiated by verified primary documentation.',
      reviewerId: complianceId,
      reviewerNotes: 'Accepted with minor editorial clarification. Absolute "zero-risk" claims violate brand policy Section 2.1.',
      category: 'Claims Integrity',
      isConfidential: false,
    },
    {
      ruleId: supRuleId,
      ruleTitle: 'Prohibit Unqualified Superlatives and Absolute Guarantees',
      decisionType: 'accepted_correction',
      originalText: 'Guaranteed 10x ROI for every enterprise deploying within 30 days.',
      suggestedCorrection: 'Measured average efficiency gain of up to 4x based on customer benchmark surveys.',
      finalCorrection: 'Measured average governance efficiency gain of up to 4x based on 2025 customer benchmark studies.',
      reviewerId: brandId,
      reviewerNotes: 'Financial return guarantees prohibited without certified economic audit. Replaced with documented benchmark study.',
      category: 'Financial & Pricing',
      isConfidential: false,
    },
    {
      ruleId: ftcRuleId,
      ruleTitle: 'Mandatory FTC Disclaimers on Endorsements and Testimonials',
      decisionType: 'accepted_correction',
      originalText: 'Our strategic cloud rollout delivers seamless compliance oversight.',
      suggestedCorrection: 'Sponsored partner cloud deployment delivers certified compliance oversight [Ad / Partner Disclosure].',
      finalCorrection: 'Sponsored partner cloud deployment delivers certified compliance oversight [Ad / Partner Disclosure].',
      reviewerId: complianceId,
      reviewerNotes: 'Mandatory FTC affiliate disclosure appended.',
      category: 'Regulatory Compliance',
      isConfidential: false,
    },
    {
      ruleId: esgRuleId,
      ruleTitle: 'ESG and Carbon Neutrality Substantiation',
      decisionType: 'documented_exception',
      originalText: 'Inkloom Guardian operational footprint is 100% Net Zero certified.',
      suggestedCorrection: 'Inkloom Guardian operational emissions reduction is verified under 2025 Scope 1 & 2 audit.',
      finalCorrection: 'Inkloom Guardian operational emissions reduction is verified under 2025 Scope 1 & 2 audit (Scope 3 offsets under certification review).',
      reviewerId: brandId,
      reviewerNotes: 'Documented approved exception for executive investor briefing; required Scope 3 certification disclaimer.',
      category: 'Sustainability',
      isConfidential: false,
    },
    {
      ruleId: pricingRuleId,
      ruleTitle: 'Enterprise Master Pricing Consistency',
      decisionType: 'accepted_correction',
      originalText: 'Edge Starter tier available for $399/mo.',
      suggestedCorrection: 'Edge Starter tier available for $499/mo.',
      finalCorrection: 'Edge Starter tier available for $499/mo.',
      reviewerId: complianceId,
      reviewerNotes: 'Corrected outdated tier price per Enterprise Master Price Sheet v3.1.',
      category: 'Financial & Pricing',
      isConfidential: false,
    },
    {
      ruleId: supRuleId,
      ruleTitle: 'Prohibit Unqualified Superlatives and Absolute Guarantees',
      decisionType: 'rejected_suggestion',
      originalText: 'Contractual 99.99% availability SLA guaranteed under enterprise service agreement.',
      suggestedCorrection: 'High availability architecture provided.',
      finalCorrection: 'Contractual 99.99% availability SLA guaranteed under enterprise service agreement.',
      reviewerId: complianceId,
      reviewerNotes: 'Rejected replacement: 99.99% SLA is legally backed by Schedule C of enterprise master service agreement.',
      category: 'Technical Specifications',
      isConfidential: false,
    },
  ];

  for (const fb of feedbackSeeds) {
    await db.query(
      `INSERT INTO reviewer_feedback_records (
        org_id, rule_id, rule_title, decision_type, original_text,
        suggested_correction, final_correction, reviewer_id, reviewer_notes,
        content_category, is_confidential, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active')`,
      [
        orgId,
        fb.ruleId,
        fb.ruleTitle,
        fb.decisionType,
        fb.originalText,
        fb.suggestedCorrection,
        fb.finalCorrection,
        fb.reviewerId,
        fb.reviewerNotes,
        fb.category,
        fb.isConfidential,
      ]
    );
  }

  // 13. Seed Policy Candidate Recommendations
  const candidateSeeds = [
    {
      targetRuleId: esgRuleId,
      type: 'add_approved_exception',
      title: 'Permit Footnoted Scope 3 Disclosures in Executive ESG Briefings',
      category: 'Sustainability',
      description: 'Human reviewers repeatedly approve Scope 1 & 2 carbon claims when accompanied by explicit Scope 3 offset disclosures. Codifies this exception into official brand guidelines.',
      content: {
        action: 'add_approved_exception',
        rule_title: 'ESG and Carbon Neutrality Substantiation',
        allowed_pattern: 'Allowed in executive investor briefings when accompanied by "(Scope 3 offsets under certification review)" footnote.',
      },
      rationale: 'High reviewer consensus indicates current rule is overly restrictive for annual sustainability disclosures.',
      violationFreq: 4,
      acceptanceRate: 75.0,
      rejections: 1,
      exceptions: 2,
    },
    {
      targetRuleId: supRuleId,
      type: 'update_existing_rule',
      title: 'Clarify Contractual SLA Exemption in Absolute Guarantees Rule',
      category: 'Claims Integrity',
      description: 'Reviewers rejected automated suppression of "99.99% availability guarantee" when backed by SLA Schedule C. Updates guideline to explicitly allow standard contractual service commitments.',
      content: {
        action: 'update_guidance',
        rule_title: 'Prohibit Unqualified Superlatives and Absolute Guarantees',
        allowed_pattern: 'Permit uptime SLA percentages when contractually specified under Master Services Agreement Schedule C.',
      },
      rationale: 'Distinguishes ungrounded marketing hyperbole from legally binding SLA commitments.',
      violationFreq: 6,
      acceptanceRate: 83.3,
      rejections: 1,
      exceptions: 1,
    },
  ];

  for (const c of candidateSeeds) {
    await db.query(
      `INSERT INTO policy_candidate_recommendations (
        org_id, target_rule_id, recommendation_type, title, category,
        description, suggested_rule_content, rationale,
        violation_frequency, acceptance_rate, rejection_count, exception_count,
        sample_feedback_ids, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, '[]'::jsonb, 'pending_review')`,
      [
        orgId,
        c.targetRuleId,
        c.type,
        c.title,
        c.category,
        c.description,
        JSON.stringify(c.content),
        c.rationale,
        c.violationFreq,
        c.acceptanceRate,
        c.rejections,
        c.exceptions,
      ]
    );
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase(true)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
