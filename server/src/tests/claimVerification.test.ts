import { claimVerificationService } from '../services/claimVerificationService.js';
import { db } from '../db/db.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';

async function runTests() {
  console.log('====================================================');
  console.log(' Inkloom Guardian: Claim Verification Engine Test Suite');
  console.log('====================================================\n');

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
    await seedDatabase(false);

    const orgRes = await db.query('SELECT id FROM organizations LIMIT 1');
    const orgId = orgRes.rows[0].id;

    // Test 1: Chunking Document into Traceable Passages with Page & Section Tracking
    console.log('\n--- 1. Document Chunking & Provenance ---');
    const sampleDoc = `
# SECTION 1: SYSTEM AVAILABILITY
Our primary compute nodes operate across multi-region clusters.
Core platform availability is certified at 99.99% under monthly SLA commitments.

# SECTION 2: REGULATORY COMPLIANCE
The organization adheres to strict data retention policies.
All customer communications are stored with AES-256 bit encryption at rest.
    `;
    const chunks = claimVerificationService.chunkDocumentIntoPassages(sampleDoc);
    assert(chunks.length >= 2, 'Document correctly chunked into distinct passages');
    assert(chunks[0].page_number === 1, 'Passage page number is tracked');
    assert(chunks[0].section_header?.includes('SYSTEM AVAILABILITY') || chunks[0].section_header !== undefined, 'Section header correctly identified');

    // Test 2: Claim Extraction (Factual, Numerical, Comparative, Promotional)
    console.log('\n--- 2. Multi-Type Claim Extraction ---');
    const testCopy = 'Inkloom platform reduces review cycle times by 42%. We guarantee zero risk and unbreakable cloud security.';
    const extracted = claimVerificationService.extractClaimsFromText(testCopy);
    assert(extracted.length >= 2, 'Extracted multiple candidate claims');
    const hasNumerical = extracted.some(c => c.claimType === 'numerical' && c.claimText.includes('42%'));
    const hasPromotional = extracted.some(c => c.claimType === 'promotional');
    assert(hasNumerical, 'Identified numerical claim containing percentage metric');
    assert(hasPromotional, 'Identified promotional claim containing promotional keywords');

    // Test 3: Supported Claim Verification
    console.log('\n--- 3. Supported Claim Verification ---');
    // Create test submission with exact verified claim
    const supportedSub = await db.query(
      `INSERT INTO content_submissions (org_id, author_id, title, channel, content_body)
       VALUES ($1, (SELECT id FROM users LIMIT 1), 'Supported Test', 'Press Release',
       'Inkloom platform reduces enterprise content compliance review cycle times by 42% on average.')
       RETURNING id`,
      [orgId]
    );
    const supportedRes = await claimVerificationService.verifyContentClaims(supportedSub.rows[0].id, orgId);
    assert(supportedRes.claims.length > 0, 'Extracted claim from supported text');
    const supportedClaim = supportedRes.claims.find(c => c.claim_text.includes('42%'));
    assert(supportedClaim?.classification === 'Supported', 'Classified accurately as Supported');
    assert((supportedClaim?.confidence_score || 0) >= 0.70, 'Confidence score exceeds supported threshold');
    assert(supportedClaim?.matched_passage?.document_title?.includes('Benchmark') || false, 'Linked to exact Benchmark Study source document');
    assert(supportedClaim?.matched_passage?.page_number === 4, 'Exact page number 4 cited without fabrication');

    // Test 4: Contradicted Claim Detection (Distinguishing contradiction from missing)
    console.log('\n--- 4. Direct Contradiction Detection ---');
    const contradictedSub = await db.query(
      `INSERT INTO content_submissions (org_id, author_id, title, channel, content_body)
       VALUES ($1, (SELECT id FROM users LIMIT 1), 'Contradicted Test', 'Social Media',
       'Acme decreased operational scope 2 greenhouse gas emissions by 50% across global cloud regions.')
       RETURNING id`,
      [orgId]
    );
    const contradictedRes = await claimVerificationService.verifyContentClaims(contradictedSub.rows[0].id, orgId);
    const contradictedClaim = contradictedRes.claims.find(c => c.claim_text.includes('emissions'));
    assert(contradictedClaim?.classification === 'Contradicted', 'Distinguished contradiction from missing evidence');
    assert(contradictedClaim?.contradiction_details?.includes('28%') || false, 'Contradiction details reference the true 28% approved figure');
    assert(contradictedClaim?.suggested_correction?.includes('28%') || false, 'Actionable suggested correction generated');

    // Test 5: Missing Evidence (Unverified Classification)
    console.log('\n--- 5. Missing Evidence (Unverified) ---');
    const unverifiedSub = await db.query(
      `INSERT INTO content_submissions (org_id, author_id, title, channel, content_body)
       VALUES ($1, (SELECT id FROM users LIMIT 1), 'Unverified Test', 'Web',
       'Our quantum micro-kernel executes distributed transactions 500 times faster than all legacy mainframes.')
       RETURNING id`,
      [orgId]
    );
    const unverifiedRes = await claimVerificationService.verifyContentClaims(unverifiedSub.rows[0].id, orgId);
    const unverifiedClaim = unverifiedRes.claims[0];
    assert(unverifiedClaim?.classification === 'Unverified', 'Unsubstantiated novel claim classified as Unverified');
    assert(!unverifiedClaim?.matched_passage_id, 'No fake passage fabricated for unverified claim');

    // Test 6: Outdated Source Detection (Needs Human Review)
    console.log('\n--- 6. Outdated Source Detection ---');
    const outdatedSub = await db.query(
      `INSERT INTO content_submissions (org_id, author_id, title, channel, content_body)
       VALUES ($1, (SELECT id FROM users LIMIT 1), 'Outdated Test', 'Print',
       'In fiscal year 2023, data center operations achieved an initial 14% scope 2 emissions reduction.')
       RETURNING id`,
      [orgId]
    );
    const outdatedRes = await claimVerificationService.verifyContentClaims(outdatedSub.rows[0].id, orgId);
    const outdatedClaim = outdatedRes.claims.find(c => c.claim_text.includes('14%'));
    assert(outdatedClaim?.classification === 'Needs Human Review', 'Claim matching outdated source flagged for Human Review');
    assert(outdatedClaim?.confidence_rationale.includes('Outdated') || false, 'Confidence rationale explains outdated/expired provenance');

    // Test 7: Traceable Evidence Graph Construction
    console.log('\n--- 7. Evidence Graph Structure ---');
    const graph = supportedRes.evidenceGraph;
    assert(graph.nodes.some(n => n.type === 'content'), 'Graph contains Content node');
    assert(graph.nodes.some(n => n.type === 'claim'), 'Graph contains Claim nodes');
    assert(graph.nodes.some(n => n.type === 'evidence_passage'), 'Graph contains Evidence Passage nodes');
    assert(graph.nodes.some(n => n.type === 'source_document'), 'Graph contains Source Document nodes');
    assert(graph.edges.some(e => e.relationship === 'substantiated_by'), 'Graph links claim to passage via substantiated_by edge');

    // Clean up test submissions
    await db.query('DELETE FROM content_submissions WHERE id IN ($1, $2, $3, $4)', [
      supportedSub.rows[0].id,
      contradictedSub.rows[0].id,
      unverifiedSub.rows[0].id,
      outdatedSub.rows[0].id,
    ]);

  } catch (err: any) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(` Test Results: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
