import { riskAnalysisService, DEFAULT_RISK_CONFIG } from '../services/riskAnalysisService.js';
import { db } from '../db/db.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';

async function runTests() {
  console.log('========================================================================');
  console.log(' Inkloom Guardian: Explainable Risk Engine & Human Approval Test Suite');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error(`       Detail: ${detail}`);
      failed++;
    }
  }

  try {
    await db.ensureReady();
    await runMigrations();
    await seedDatabase(true);

    const orgRes = await db.query('SELECT id FROM organizations LIMIT 1');
    const orgId = orgRes.rows[0].id;

    const complianceRes = await db.query("SELECT id FROM users WHERE role = 'compliance_officer' LIMIT 1");
    const complianceId = complianceRes.rows[0].id;

    const creatorRes = await db.query("SELECT id FROM users WHERE role = 'content_creator' LIMIT 1");
    const creatorId = creatorRes.rows[0].id;

    const adminRes = await db.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminRes.rows[0].id;

    // --- TEST 1: Deterministic Risk Formula & Domain Multipliers ---
    console.log('\n--- 1. Deterministic Risk Formula & Domain Multipliers ---');
    const mockViolations = [
      {
        id: 'v1',
        ruleTitle: 'Regulatory Footnote Requirement',
        category: 'regulatory', // domain: legal_regulatory (1.4x)
        severity: 'high',       // base: 20
        matchedText: 'unregulated marketing statement',
        position: { start: 0, end: 32 }, // confidence: 0.95
        status: 'unresolved',
      },
      {
        id: 'v2',
        ruleTitle: 'Tone Superlative',
        category: 'tone_voice', // domain: brand_voice_naming (0.9x)
        severity: 'medium',     // base: 10
        matchedText: 'completely miraculous performance',
        position: { start: 50, end: 85 }, // confidence: 0.95
        status: 'unresolved',
      },
    ];

    const calculation = riskAnalysisService.calculateExplainableRisk({
      violations: mockViolations,
      claims: [],
      isMultiAsset: false,
      config: DEFAULT_RISK_CONFIG,
    });

    assert(typeof calculation.overallRiskScore === 'number', 'Overall risk score is calculated as a number');
    assert(calculation.contributingIssues.length === 2, 'Generated 2 distinct contributing issues');

    const v1Issue = calculation.contributingIssues.find(i => i.id === 'v1');
    assert(v1Issue?.domain === 'legal_regulatory', 'Categorized regulatory rule under legal_regulatory domain');
    assert(v1Issue?.domain_multiplier === 1.4, 'Applied 1.4x domain multiplier to legal/regulatory finding');
    
    // Expected v1: 20 base * 1.4 * 0.95 * 1.0 * 1.0 * 1.0 = 26.6 -> 27
    assert(v1Issue?.score_contribution === 27, `Score contribution calculated accurately (expected 27, got ${v1Issue?.score_contribution})`);

    // --- TEST 2: Severity vs Confidence Separation ---
    console.log('\n--- 2. Severity vs Confidence Separation ---');
    const highSeverityLowConfidence = riskAnalysisService.calculateExplainableRisk({
      violations: [{
        id: 'v-low-conf',
        ruleTitle: 'Potential Ambiguous Guarantee',
        category: 'regulatory',
        severity: 'critical', // base: 35
        matchedText: 'conditional promise text',
        status: 'unresolved', // no position -> heuristic confidence 0.85
      }],
      claims: [],
      isMultiAsset: false,
      config: DEFAULT_RISK_CONFIG,
    });

    const contrib = highSeverityLowConfidence.contributingIssues[0];
    assert(contrib.severity === 'critical', 'Severity accurately preserved as Critical (35 base points)');
    assert(contrib.confidence === 0.85, 'Confidence explicitly preserved as 0.85 rather than blended into severity');
    assert(contrib.score_contribution < 35 * 1.4, 'Low confidence scales down score contribution without changing severity label');

    // --- TEST 3: Evidence Grounding (Contradicted vs Unverified vs Supported) ---
    console.log('\n--- 3. Evidence Grounding & Uncertainties Handling ---');
    const claimsAssessment = riskAnalysisService.calculateExplainableRisk({
      violations: [],
      claims: [
        {
          id: 'c-contra',
          claim_text: 'Emissions decreased by 50% across facilities',
          claim_type: 'Technical',
          classification: 'Contradicted',
          confidence_score: 0.95,
          contradiction_details: 'Certified ESG report v2.0 establishes 28% actual reduction',
          status: 'pending_review',
        },
        {
          id: 'c-unv',
          claim_text: 'Platform delivers 10x throughput multiplier',
          claim_type: 'Technical',
          classification: 'Unverified',
          status: 'pending_review',
        },
        {
          id: 'c-supp',
          claim_text: 'Core availability guaranteed at 99.99%',
          claim_type: 'Technical',
          classification: 'Supported',
          status: 'approved',
        },
      ],
      isMultiAsset: false,
      config: DEFAULT_RISK_CONFIG,
    });

    const contraIssue = claimsAssessment.contributingIssues.find(i => i.id === 'c-contra');
    assert(!!contraIssue, 'Contradicted claim included in contributing issues');
    assert(contraIssue?.evidence_factor === 1.25, 'Direct contradiction by verified evidence applies 1.25x evidence factor');
    assert(Boolean(contraIssue?.evidence_ref?.includes('ESG report')), 'Cites primary source document reference');

    const unverifiedIssue = claimsAssessment.contributingIssues.find(i => i.id === 'c-unv');
    assert(!!unverifiedIssue, 'Unverified claim included in contributing issues');
    assert(unverifiedIssue?.evidence_factor === 0.85, 'Unverified claim applies cautious 0.85x factor');
    assert(claimsAssessment.unresolvedUncertainties.length === 1, 'Missing evidence explicitly recorded in Unresolved Uncertainties');

    const supportedIssue = claimsAssessment.contributingIssues.find(i => i.id === 'c-supp');
    assert(!supportedIssue, 'Supported claim carries 0 risk and is excluded from risk findings');

    // --- TEST 4: Correlated Findings Deduplication ---
    console.log('\n--- 4. Correlated Findings Deduplication ---');
    const overlappingViolations = [
      {
        id: 'v-overlap-1',
        ruleTitle: 'Broad Financial Exaggeration',
        category: 'claims',
        severity: 'high',
        matchedText: 'guaranteed ROI and zero risk',
        position: { start: 10, end: 38 },
        status: 'unresolved',
      },
      {
        id: 'v-overlap-2',
        ruleTitle: 'Prohibited Absolute: Zero Risk',
        category: 'regulatory',
        severity: 'critical',
        matchedText: 'zero risk',
        position: { start: 29, end: 38 },
        status: 'unresolved',
      },
    ];

    const deduplicated = riskAnalysisService.calculateExplainableRisk({
      violations: overlappingViolations,
      claims: [],
      isMultiAsset: false,
      config: DEFAULT_RISK_CONFIG,
    });

    assert(deduplicated.contributingIssues.length === 1, 'Correlated/overlapping findings deduplicated to 1 issue');
    assert(deduplicated.scoringFormulaBreakdown.deduplicated_count === 1, 'Deduplication count recorded in breakdown');
    assert(deduplicated.contributingIssues[0].severity === 'critical', 'Higher impact finding retained during deduplication');

    // --- TEST 5: Non-Arbitrary Disclaimer & Score Clamping ---
    console.log('\n--- 5. Non-Arbitrary Disclaimer & Clamping ---');
    assert(claimsAssessment.scoringFormulaBreakdown.disclaimer.includes('not a scientifically proven empirical probability'), 'Disclaimer avoids claiming empirical brand damage prediction');
    assert(claimsAssessment.overallRiskScore <= 100 && claimsAssessment.overallRiskScore >= 0, 'Score is strictly bounded between 0 and 100');

    // --- TEST 6: Lifecycle State Transitions & Permissions ---
    console.log('\n--- 6. Lifecycle State Transitions & RBAC ---');
    // Create new content draft
    const subRes = await db.query(
      `INSERT INTO content_submissions (org_id, author_id, title, channel, content_body, status, risk_score, current_version)
       VALUES ($1, $2, 'Enterprise Cloud Brochure', 'Landing Page', 'Guaranteed ROI for cloud migrations.', 'draft', 65, 1)
       RETURNING id`,
      [orgId, creatorId]
    );
    const testSubId = subRes.rows[0].id;

    // Test: Content creator submits draft for review
    const submitTransition = await riskAnalysisService.transitionLifecycleState({
      contentId: testSubId,
      targetStatus: 'ready_for_review',
      userId: creatorId,
      userRole: 'content_creator',
      orgId,
      notes: 'Initial draft ready for compliance audit',
    });
    assert(submitTransition.content.status === 'ready_for_review', 'Transitioned from draft to ready_for_review');

    // Test: Content creator CANNOT approve content
    let creatorApprovalBlocked = false;
    try {
      await riskAnalysisService.transitionLifecycleState({
        contentId: testSubId,
        targetStatus: 'approved',
        userId: creatorId,
        userRole: 'content_creator',
        orgId,
      });
    } catch (err: any) {
      creatorApprovalBlocked = true;
      assert(err.message.includes('Unauthorized'), 'Content creator prohibited from approving content');
    }
    assert(creatorApprovalBlocked, 'Creator self-approval blocked by backend security');

    // Test: Reviewer requests revisions
    const revisionReq = await riskAnalysisService.transitionLifecycleState({
      contentId: testSubId,
      targetStatus: 'needs_revision',
      userId: complianceId,
      userRole: 'compliance_officer',
      orgId,
      notes: 'Please qualify the guaranteed ROI statement per FTC guidelines §4.',
    });
    assert(revisionReq.content.status === 'needs_revision', 'Compliance officer requested revisions with notes');
    assert(revisionReq.reviewApproval.decision === 'needs_revision', 'Review decision logged in review_approvals');

    // Test: Critical risk content requires explicit notes to approve
    await db.query('UPDATE content_submissions SET risk_score = 85 WHERE id = $1', [testSubId]);
    let highRiskApprovalBlocked = false;
    try {
      await riskAnalysisService.transitionLifecycleState({
        contentId: testSubId,
        targetStatus: 'approved',
        userId: complianceId,
        userRole: 'compliance_officer',
        orgId,
        notes: '', // empty notes
      });
    } catch (err: any) {
      highRiskApprovalBlocked = true;
      assert(err.message.includes('Safeguard'), 'Safeguard prevents approving critical risk without written justification');
    }
    assert(highRiskApprovalBlocked, 'Empty notes approval on high risk rejected');

    // Test: Legitimate approval with justification notes
    const finalApproval = await riskAnalysisService.transitionLifecycleState({
      contentId: testSubId,
      targetStatus: 'approved',
      userId: complianceId,
      userRole: 'compliance_officer',
      orgId,
      notes: 'Legal exception granted with required risk disclaimer footnote appended.',
    });
    assert(finalApproval.content.status === 'approved', 'Authorized approval granted with justification notes');

    // --- TEST 7: Revision Snapshotting & Risk Reduction Comparison ---
    console.log('\n--- 7. Revision Snapshots & Risk Reduction Comparison ---');
    // Snapshot version 1
    await riskAnalysisService.createRevisionSnapshot(testSubId, creatorId, 'Version 1 with unhedged claims');

    // Create revised content (v2)
    const revisedBody = 'Transform your operations with enterprise cloud migrations. Results may vary.';
    await db.query(
      `UPDATE content_submissions
       SET content_body = $1, risk_score = 15, risk_level = 'low', current_version = 2
       WHERE id = $2`,
      [revisedBody, testSubId]
    );

    // Snapshot version 2
    await riskAnalysisService.createRevisionSnapshot(testSubId, creatorId, 'Version 2 with qualified statements');

    const comparison = await riskAnalysisService.compareRevisions(testSubId, 1, 2);
    assert(comparison.previous_version === 1 && comparison.new_version === 2, 'Compared v1 against v2');
    assert(comparison.previous_risk_score === 85, 'Retrieved previous risk score of 85');
    assert(comparison.new_risk_score === 15, 'Retrieved new risk score of 15');
    assert(comparison.score_delta === -70, 'Calculated risk reduction delta (-70 points)');
    assert(comparison.summary.includes('Risk successfully reduced by 70 points'), 'Generated clear executive summary of risk reduction');

    console.log('\n========================================================================');
    console.log(` Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('========================================================================\n');

    if (failed > 0) process.exit(1);
    else process.exit(0);
  } catch (err: any) {
    console.error('Test Suite encountered unhandled error:', err);
    process.exit(1);
  }
}

runTests();
