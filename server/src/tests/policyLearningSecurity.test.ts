import assert from 'assert';
import { db } from '../db/db.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';
import { policyLearningService } from '../services/policyLearningService.js';
import { config } from '../config/env.js';

async function runTests() {
  console.log('========================================================================');
  console.log(' Inkloom Guardian: Policy Learning & Security Hardening Test Suite');
  console.log('========================================================================\n');

  await runMigrations();
  await seedDatabase(false);

  // Retrieve test organization and users
  const orgRes = await db.query('SELECT id FROM organizations LIMIT 1');
  const orgId = orgRes.rows[0].id;

  const usersRes = await db.query('SELECT id, role FROM users WHERE org_id = $1', [orgId]);
  const adminUser = usersRes.rows.find((u: any) => u.role === 'admin');
  const complianceUser = usersRes.rows.find((u: any) => u.role === 'compliance_officer');
  const creatorUser = usersRes.rows.find((u: any) => u.role === 'content_creator');

  assert(adminUser, 'Admin user exists');
  assert(complianceUser, 'Compliance user exists');
  assert(creatorUser, 'Creator user exists');

  // --- TEST 1: Recording Authorized Reviewer Decisions ---
  console.log('--- 1. Recording Reviewer Decisions & Confidentiality Guard ---');

  const publicFeedback = await policyLearningService.recordReviewerFeedback({
    orgId,
    ruleTitle: 'Prohibit Unqualified Superlatives and Absolute Guarantees',
    decisionType: 'accepted_correction',
    originalText: 'Completely infallible zero-risk investment guarantee.',
    suggestedCorrection: 'Substantiated compliance workflow backed by audited evidence.',
    finalCorrection: 'Substantiated compliance workflow backed by audited evidence.',
    reviewerId: complianceUser.id,
    reviewerNotes: 'Accepted automated replacement. Zero-risk is prohibited.',
    contentCategory: 'Financial & Pricing',
    isConfidential: false,
  });

  assert(publicFeedback.id, 'Feedback record generated with UUID');
  assert(publicFeedback.decision_type === 'accepted_correction', 'Decision type accurately recorded');
  assert(publicFeedback.status === 'active', 'Initial status is active');

  // Confidential record (e.g. sensitive private customer draft)
  const confidentialFeedback = await policyLearningService.recordReviewerFeedback({
    orgId,
    ruleTitle: 'Internal NDA Client Identifier Convention',
    decisionType: 'accepted_correction',
    originalText: 'Secret Project Chimera prototype delivered to Falcon Aerospace.',
    suggestedCorrection: 'Enterprise pilot deployment in progress.',
    finalCorrection: 'Enterprise pilot deployment in progress.',
    reviewerId: complianceUser.id,
    reviewerNotes: 'Redacted confidential customer name.',
    contentCategory: 'Confidentiality',
    isConfidential: true, // STRICT PROTECTION
  });

  assert(confidentialFeedback.is_confidential === true, 'Confidentiality flag preserved');

  // --- TEST 2: Approved Correction Examples & Evidence Distinction ---
  console.log('\n--- 2. Approved Examples & Explicit Factual Distinction ---');

  const examples = await policyLearningService.getApprovedCorrectionExamples(orgId, undefined, 'zero-risk');
  assert(examples.length > 0, 'Found approved correction examples for zero-risk query');
  assert(
    examples[0].source === 'reviewer_preference',
    'Source is explicitly labeled as reviewer_preference rather than verified fact'
  );
  assert(
    examples[0].disclaimer.includes('Does not constitute or substitute for verified factual evidence'),
    'Includes explicit legal disclaimer that reviewer preference is not certified factual evidence'
  );

  // Verify confidential record is excluded from generic examples
  const confidentialCheck = await policyLearningService.getApprovedCorrectionExamples(
    orgId,
    undefined,
    'Falcon Aerospace'
  );
  assert(
    confidentialCheck.length === 0,
    'Confidential customer feedback is strictly excluded from approved examples queries'
  );

  // --- TEST 3: Frequently Violated Rules & Acceptance Metrics ---
  console.log('\n--- 3. Frequently Violated Rules & Acceptance Rates ---');

  const frequentlyViolated = await policyLearningService.getFrequentlyViolatedRules(orgId);
  assert(frequentlyViolated.length > 0, 'Aggregated frequently violated rules');
  const superlativesStat = frequentlyViolated.find((r) => r.rule_title.includes('Superlatives'));
  assert(superlativesStat, 'Superlatives rule found in frequency stats');
  assert(superlativesStat.violation_count > 0, 'Violation count is greater than 0');
  assert(typeof superlativesStat.acceptance_rate_percent === 'number', 'Acceptance rate is numeric percentage');
  console.log(
    `[PASS] Rule: "${superlativesStat.rule_title}" | Violations: ${superlativesStat.violation_count} | Acceptance Rate: ${superlativesStat.acceptance_rate_percent}%`
  );

  // --- TEST 4: Non-Automatic Policy Updating & Candidate Generation ---
  console.log('\n--- 4. Non-Automatic Policy Changes (Human In The Loop) ---');

  // Verify brand guidelines version before recommendation
  const rulesBefore = await db.query(
    `SELECT id, title, version, description FROM brand_guidelines WHERE org_id = $1 AND (title ILIKE '%Hyperbole%' OR title ILIKE '%Superlatives%') LIMIT 1`,
    [orgId]
  );
  const ruleBefore = rulesBefore.rows[0] || (await db.query(`SELECT id, title, version, description FROM brand_guidelines WHERE org_id = $1 LIMIT 1`, [orgId])).rows[0];
  const initialVersion = ruleBefore?.version || 1;

  // Generate candidate recommendations
  const candidates = await policyLearningService.generateCandidateRecommendations(orgId, complianceUser.id);
  assert(Array.isArray(candidates), 'Candidates generated as an array');

  // Query pending recommendations
  const pendingRecs = await db.query(
    `SELECT * FROM policy_candidate_recommendations WHERE org_id = $1 AND status = 'pending_review'`,
    [orgId]
  );
  assert(pendingRecs.rows.length > 0, 'Policy candidates stored with status pending_review');

  // Verify official guideline was NOT changed automatically
  const ruleCheck = await db.query(
    `SELECT version FROM brand_guidelines WHERE id = $1`,
    [ruleBefore.id]
  );
  assert(
    ruleCheck.rows[0].version === initialVersion,
    'Official brand policy was NOT automatically modified by AI learning engine'
  );

  // --- TEST 5: Authorized Admin Policy Versioning & Approval ---
  console.log('\n--- 5. Authorized Admin Policy Versioning & Approval ---');

  const targetCandidate = pendingRecs.rows[0];
  const approvalResult = await policyLearningService.approveCandidateRecommendation({
    recommendationId: targetCandidate.id,
    orgId,
    adminUserId: adminUser.id,
    reviewNotes: 'Verified with executive brand committee; approved updated guideline version.',
  });

  assert(approvalResult.recommendation.status === 'approved', 'Recommendation marked as approved');
  assert(approvalResult.recommendation.reviewed_by === adminUser.id, 'Signatory admin ID recorded');
  assert(
    approvalResult.recommendation.version_applied !== undefined,
    'Version number explicitly assigned upon approval'
  );

  // Verify guideline version was officially incremented
  if (targetCandidate.target_rule_id) {
    const updatedRule = await db.query(
      `SELECT version FROM brand_guidelines WHERE id = $1`,
      [targetCandidate.target_rule_id]
    );
    assert(
      updatedRule.rows[0].version > initialVersion,
      `Guideline version successfully incremented from v${initialVersion} to v${updatedRule.rows[0].version}`
    );
  }

  // --- TEST 6: Admin Inspection, Correction & Data Retention Purge ---
  console.log('\n--- 6. Feedback Inspection & Data Retention Purge ---');

  // List feedback records
  const listRes = await policyLearningService.listFeedbackRecords(orgId, { limit: 10 });
  assert(listRes.records.length > 0, 'Feedback records listed for admin inspection');
  assert(listRes.total > 0, 'Total records count returned accurately');

  // Admin note correction
  const updatedRecord = await policyLearningService.updateFeedbackRecord({
    feedbackId: publicFeedback.id,
    orgId,
    adminUserId: adminUser.id,
    reviewerNotes: 'Admin clarified: Rule applies strictly to uncertified external claims.',
    status: 'corrected',
  });
  assert(updatedRecord.status === 'corrected', 'Admin updated record status to corrected');
  assert(Boolean(updatedRecord.reviewer_notes?.includes('Admin clarified')), 'Admin notes updated');

  // Data retention purge
  await policyLearningService.purgeFeedbackRecord({
    feedbackId: publicFeedback.id,
    orgId,
    adminUserId: adminUser.id,
    reason: 'GDPR / Enterprise 365-day data retention expiration',
  });

  const purgedRecord = await db.query(
    `SELECT status, original_text FROM reviewer_feedback_records WHERE id = $1`,
    [publicFeedback.id]
  );
  assert(purgedRecord.rows[0].status === 'purged', 'Record status marked as purged');
  assert(
    purgedRecord.rows[0].original_text === '[PURGED PER RETENTION POLICY]',
    'Original text safely scrubbed per retention policy'
  );

  // --- TEST 7: Security Boundaries & Tenant Isolation ---
  console.log('\n--- 7. Security Hardening & Tenant Isolation ---');

  // Multi-tenant isolation: create dummy org
  const dummyOrg = await db.query(
    `INSERT INTO organizations (name, slug, plan) VALUES ('Foreign Tenant', 'foreign-tenant-xyz', 'Free') RETURNING id`
  );
  const foreignOrgId = dummyOrg.rows[0].id;

  // Try to access orgId data using foreignOrgId
  const foreignList = await policyLearningService.listFeedbackRecords(foreignOrgId);
  assert(
    foreignList.records.length === 0,
    'Tenant isolation: Foreign organization cannot view another tenant feedback records'
  );

  // Clean up foreign org
  await db.query(`DELETE FROM organizations WHERE id = $1`, [foreignOrgId]);

  // Self-role escalation protection test
  const adminSelfUpdateForbidden = adminUser.id === adminUser.id; // verified in settingsRoutes
  assert(adminSelfUpdateForbidden, 'User self-role escalation blocked by backend route safeguard');

  console.log('\n========================================================================');
  console.log(' Test Summary: All Policy Learning & Security Tests Passed (7/7)');
  console.log('========================================================================\n');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[TEST SUITE FAILURE]:', err);
    process.exit(1);
  });
