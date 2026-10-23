import { campaignConsistencyService } from '../services/campaignConsistencyService.js';
import { db } from '../db/db.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';

async function runTests() {
  console.log('================================================================');
  console.log(' Inkloom Guardian: Cross-Campaign Consistency Test Suite');
  console.log('================================================================\n');

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

    const userRes = await db.query('SELECT id FROM users WHERE role = $1 LIMIT 1', ['compliance_officer']);
    const complianceUserId = userRes.rows[0].id;

    // Test 1: Deterministic Fact Extraction
    console.log('\n--- 1. Deterministic Entity & Fact Extraction ---');
    const sampleAsset = {
      id: 'test-asset-1',
      campaign_id: 'test-camp-1',
      title: 'Enterprise Edge Landing Page',
      channel: 'Landing Page',
      content_body: `
        The new Inkloom Guardian Edge appliance provides up to 18 hours battery life for remote auditing.
        Enterprise tier is priced at $499/mo.
        Offer valid through December 31, 2026.
        Protected by a 1-year limited warranty.
        Results may vary based on client infrastructure and workload parameters.
      `,
    };

    const extracted = campaignConsistencyService.extractFactsFromAsset(sampleAsset);
    assert(extracted.length >= 4, 'Extracted multiple structured facts from content asset');
    
    const priceFact = extracted.find(f => f.fact_type === 'price');
    assert(!!priceFact && priceFact.normalized_value === '499', 'Extracted price correctly normalized to 499');

    const batteryFact = extracted.find(f => f.fact_type === 'specification' && f.entity_name.includes('Battery'));
    assert(!!batteryFact && batteryFact.normalized_value === '18 hours', 'Extracted battery life spec normalized to 18 hours');

    const warrantyFact = extracted.find(f => f.fact_type === 'warranty');
    assert(!!warrantyFact && warrantyFact.normalized_value === '1 year(s)', 'Extracted warranty normalized to 1 year(s)');

    const dateFact = extracted.find(f => f.fact_type === 'date_validity');
    assert(!!dateFact && dateFact.normalized_value === '2026-12-31', 'Extracted promo date normalized to 2026-12-31');

    // Test 2: Valid Differences (No False Positives)
    console.log('\n--- 2. Valid Differences Filtering (Zero False Positives) ---');
    const differentiatedAsset = {
      id: 'test-asset-diff',
      campaign_id: 'test-camp-1',
      title: 'Pricing & Specs Comparison Table',
      channel: 'Landing Page',
      content_body: `
        Starter tier is $99/mo while Enterprise tier is priced at $499/mo.
        Device provides 20 hours active battery endurance and 72 hours standby battery life.
      `,
    };
    const diffFacts = campaignConsistencyService.extractFactsFromAsset(differentiatedAsset);
    const starterPrice = diffFacts.find(f => f.entity_name === 'Starter Tier Pricing');
    const enterprisePrice = diffFacts.find(f => f.entity_name === 'Enterprise Tier Pricing');
    assert(!!starterPrice && !!enterprisePrice, 'Starter and Enterprise tiers categorized into distinct entities');
    assert(starterPrice?.normalized_value !== enterprisePrice?.normalized_value, 'Tier prices differ without entity collision');

    const activeBattery = diffFacts.find(f => f.entity_name === 'Hardware Active Battery Endurance');
    const standbyBattery = diffFacts.find(f => f.entity_name === 'Hardware Standby Battery Life');
    assert(!!activeBattery && !!standbyBattery, 'Active vs Standby battery specs categorized into separate entities');

    // Test 3: Cross-Asset Contradiction Detection in Demo Campaign
    console.log('\n--- 3. Cross-Asset Contradiction Detection ---');
    const demoCampRes = await db.query(
      "SELECT id FROM campaigns WHERE code = 'CAMP-2026-HW' AND org_id = $1",
      [orgId]
    );
    assert(demoCampRes.rows.length > 0, 'Found demonstration hardware campaign (CAMP-2026-HW)');
    const demoCampId = demoCampRes.rows[0].id;

    const analysisResult = await campaignConsistencyService.analyzeCampaignConsistency(
      demoCampId,
      orgId,
      complianceUserId
    );

    const { facts, contradictions, scoreBreakdown } = analysisResult;
    assert(facts.length >= 6, `Extracted ${facts.length} facts across the 3 campaign assets`);
    assert(contradictions.length >= 3, `Identified ${contradictions.length} cross-asset contradictions`);

    // Verify Battery Contradiction
    const batteryConflict = contradictions.find(c => c.conflict_type === 'conflicting_spec');
    assert(!!batteryConflict, 'Detected conflicting battery specification across assets (18h vs 24h vs 30h)');
    assert(
      batteryConflict?.approved_truth_ref?.includes('Technical Hardware Specification Doc v3.1') === true,
      'Battery contradiction references approved truth document (v3.1 §4)'
    );
    assert(
      batteryConflict?.approved_truth_value?.includes('20 hours') === true,
      'Battery contradiction cites approved 20 hours endurance standard'
    );

    // Verify Price Contradiction
    const priceConflict = contradictions.find(c => c.conflict_type === 'conflicting_price');
    assert(!!priceConflict, 'Detected conflicting pricing across assets ($499 vs $399 vs $599)');
    assert(priceConflict?.severity === 'critical', 'Conflicting price marked with Critical severity');
    assert(
      priceConflict?.approved_truth_ref?.includes('Enterprise Master Price Sheet') === true,
      'Price contradiction cites Enterprise Master Price Sheet'
    );

    // Verify Expired Promotional Date
    const expiredConflict = contradictions.find(c => c.conflict_type === 'expired_offer_date');
    assert(!!expiredConflict, 'Detected expired promotional offer date (September 30, 2026)');
    assert(expiredConflict?.severity === 'critical', 'Expired date marked with Critical severity');

    // Test 4: Transparent Mathematical Score Breakdown
    console.log('\n--- 4. Transparent Consistency Score Breakdown ---');
    assert(typeof scoreBreakdown.overall_score === 'number', 'Overall consistency score is numeric');
    assert(scoreBreakdown.base_score === 100, 'Score starts from base score 100');
    assert(scoreBreakdown.deductions.length > 0, 'Score breakdown contains explicit itemized deductions');
    
    const hasArbitraryClaim = scoreBreakdown.explanation.toLowerCase().includes('empirical brand damage');
    assert(!hasArbitraryClaim, 'Score explanation does NOT claim empirical prediction of brand damage');
    
    // Test point deduction accuracy
    const expectedDeductions = scoreBreakdown.deductions.reduce((sum, d) => sum + d.deduction_points, 0);
    const expectedScore = Math.max(10, 100 - expectedDeductions);
    assert(scoreBreakdown.overall_score === expectedScore, 'Overall score matches exact mathematical sum of deductions');

    // Test 5: Reviewer Action Workflow (Resolution & Exception)
    console.log('\n--- 5. Reviewer Action Workflow ---');
    if (batteryConflict) {
      const initialScore = scoreBreakdown.overall_score;

      // Mark battery conflict as resolved
      const reviewed = await campaignConsistencyService.reviewContradiction(
        batteryConflict.id,
        'resolve',
        'Updated all marketing collateral to certified 20 hours per Tech Spec Doc v3.1.',
        complianceUserId,
        orgId
      );

      assert(reviewed.status === 'resolved', 'Contradiction status updated to resolved');
      assert(reviewed.resolution_action === 'accepted_correction', 'Resolution action set to accepted_correction');

      // Verify audit trail entry
      const auditRes = await db.query(
        'SELECT * FROM campaign_review_actions WHERE contradiction_id = $1 ORDER BY created_at DESC LIMIT 1',
        [batteryConflict.id]
      );
      assert(auditRes.rows.length === 1, 'Review action logged to campaign_review_actions audit trail');
      assert(auditRes.rows[0].notes.includes('Tech Spec Doc v3.1'), 'Review notes recorded accurately');

      // Verify score re-calculation and penalty deduction removal
      const updatedScoreRes = await db.query(
        'SELECT * FROM campaign_consistency_scores WHERE campaign_id = $1',
        [demoCampId]
      );
      const rawBreakdown = updatedScoreRes.rows[0].formula_breakdown;
      const updatedBreakdown = typeof rawBreakdown === 'string' ? JSON.parse(rawBreakdown) : rawBreakdown;
      assert(
        updatedBreakdown.deductions.length < scoreBreakdown.deductions.length,
        'Penalty deduction removed from score calculation after resolution'
      );
      assert(
        updatedBreakdown.unresolved_conflicts_count < scoreBreakdown.unresolved_conflicts_count,
        'Unresolved conflicts count decreased after reviewer action'
      );
      assert(
        updatedBreakdown.confirmed_violations_count > scoreBreakdown.confirmed_violations_count,
        'Confirmed violations count increased after reviewer resolution'
      );
    }

    if (expiredConflict) {
      // Mark expired conflict as justified exception
      const exceptionReview = await campaignConsistencyService.reviewContradiction(
        expiredConflict.id,
        'exception',
        'Authorized grace period extension approved by Legal until next ad cycle refresh.',
        complianceUserId,
        orgId
      );
      assert(exceptionReview.status === 'exception', 'Contradiction marked as justified exception');
      assert(exceptionReview.resolution_action === 'marked_exception', 'Resolution action recorded as marked_exception');
    }

    console.log('\n================================================================');
    console.log(` Test Summary: ${passed} Passed, ${failed} Failed`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Test Suite encountered unhandled error:', err);
    process.exit(1);
  }
}

runTests();
