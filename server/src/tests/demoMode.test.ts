import { demoService } from '../services/demoService.js';
import { db } from '../db/db.js';
import { runMigrations } from '../db/migrate.js';
import { seedDatabase } from '../db/seed.js';

async function runDemoTests() {
  console.log('====================================================');
  console.log(' Inkloom Guardian: Interactive Demo Mode Test Suite');
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

    // 1. Initial Seeding of VOLTERRA Demo
    console.log('\n--- 1. VOLTERRA Demo Environment Provisioning ---');
    const orgId = await demoService.seedVolterraDemo(true);
    assert(typeof orgId === 'string' && orgId.length > 0, 'Volterra demo org seeded with valid ID', orgId);

    // Verify Organization properties and sandbox flag
    const orgRes = await db.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    assert(orgRes.rows.length === 1, 'Demo organization exists in database');
    assert(orgRes.rows[0].slug === 'volterra-demo', 'Demo organization slug matches volterra-demo');
    assert(orgRes.rows[0].is_demo === true, 'Organization marked with is_demo = true for strict tenant isolation');

    // 2. Demo Status Inspection
    console.log('\n--- 2. Demo Status & Quantitative Metrics ---');
    const status = await demoService.getDemoStatus();
    assert(status.isInitialized === true, 'getDemoStatus reports isInitialized = true');
    assert(status.orgId === orgId, 'Status reports matching organization ID');
    assert((status.stats?.usersCount || 0) >= 4, 'At least 4 specialized demo personas provisioned', `Found: ${status.stats?.usersCount}`);
    assert((status.stats?.guidelinesCount || 0) >= 4, 'Preloaded brand guidelines exist (4 rules)', `Found: ${status.stats?.guidelinesCount}`);
    assert((status.stats?.evidenceDocumentsCount || 0) >= 3, 'Preloaded certified evidence sources exist (3 documents)', `Found: ${status.stats?.evidenceDocumentsCount}`);
    assert((status.stats?.campaignAssetsCount || 0) >= 3, 'Campaign assets provisioned (3 assets: ad, social, PR)', `Found: ${status.stats?.campaignAssetsCount}`);
    assert((status.stats?.contradictionsCount || 0) >= 2, 'Deliberate cross-asset contradictions registered', `Found: ${status.stats?.contradictionsCount}`);

    // 3. User Personas & Seamless Role Switching
    console.log('\n--- 3. 1-Click Persona Switching Tokens ---');
    const complianceAuth = await demoService.getDemoUserToken('compliance_officer');
    assert(complianceAuth.user.role === 'compliance_officer', 'Compliance Officer persona token retrieved', complianceAuth.user.email);
    assert(complianceAuth.user.email === 'compliance@volterra.demo', 'Compliance email is compliance@volterra.demo');
    assert(typeof complianceAuth.token === 'string' && complianceAuth.token.length > 20, 'Valid JWT signed for Compliance Officer');

    const brandAuth = await demoService.getDemoUserToken('brand_manager');
    assert(brandAuth.user.role === 'brand_manager', 'Brand Director persona token retrieved', brandAuth.user.email);

    const creatorAuth = await demoService.getDemoUserToken('content_creator');
    assert(creatorAuth.user.role === 'content_creator', 'Content Creator persona token retrieved', creatorAuth.user.email);

    const adminAuth = await demoService.getDemoUserToken('admin');
    assert(adminAuth.user.role === 'admin', 'Administrator persona token retrieved', adminAuth.user.email);

    // 4. Traceable Evidence Graph & Passages
    console.log('\n--- 4. Ground Truth Evidence & Chunked Passages ---');
    const passagesRes = await db.query(
      `SELECT sp.*, es.title as doc_title FROM source_passages sp 
       JOIN evidence_sources es ON sp.document_id = es.id 
       WHERE es.org_id = $1`,
      [orgId]
    );
    assert(passagesRes.rows.length >= 6, 'Evidence sources correctly chunked into distinct granular passages', `Passages: ${passagesRes.rows.length}`);
    const specPassage = passagesRes.rows.find((p: any) => p.content?.includes('1,200 full charge-discharge cycles'));
    assert(Boolean(specPassage), 'Spec sheet contains exact 1,200 cycles certified passage for grounding');

    // 5. Deliberate Contradictions in Volterra Campaign
    console.log('\n--- 5. Deliberate Multi-Asset Contradictions ---');
    const contraRes = await db.query(
      `SELECT cc.* FROM campaign_contradictions cc 
       JOIN campaigns c ON cc.campaign_id = c.id 
       WHERE c.org_id = $1`,
      [orgId]
    );
    assert(contraRes.rows.length >= 2, 'Contradictions detected in Volterra campaign workspace');
    const priceContra = contraRes.rows.find((c: any) => c.conflict_type === 'pricing_discrepancy');
    assert(Boolean(priceContra), 'Pricing discrepancy contradiction identified ($5,800 vs $6,200 vs $7,400)');
    const cycleContra = contraRes.rows.find((c: any) => c.conflict_type === 'specification_mismatch');
    assert(Boolean(cycleContra), 'Specification mismatch contradiction identified (1,800 cycles vs 1,200 spec)');

    // 6. Precomputed Explainable Risk Assessment
    console.log('\n--- 6. Explainable Risk Report & Formula Breakdown ---');
    const riskRes = await db.query(
      `SELECT rr.* FROM risk_reports rr 
       JOIN content_submissions cs ON rr.content_id = cs.id 
       WHERE cs.org_id = $1`,
      [orgId]
    );
    assert(riskRes.rows.length > 0, 'Risk report precomputed for Volterra billboard ad draft');
    const highRiskReport = riskRes.rows[0];
    assert(highRiskReport.overall_risk_score >= 80, 'Volterra ad correctly assessed with high/critical risk score (88/100)', `Score: ${highRiskReport.overall_risk_score}`);
    assert(highRiskReport.risk_category === 'critical', 'Risk category is critical');
    assert(Boolean(highRiskReport.scoring_formula_breakdown), 'Mathematical formula breakdown stored with transparent weights');

    // 7. Version Comparison Snapshots (-76 Risk Reduction Delta)
    console.log('\n--- 7. Content Versions & Risk Reduction Comparison ---');
    const versionsRes = await db.query(
      `SELECT cv.* FROM content_versions cv 
       JOIN content_submissions cs ON cv.content_id = cs.id 
       WHERE cs.org_id = $1 ORDER BY cv.version_number ASC`,
      [orgId]
    );
    assert(versionsRes.rows.length >= 2, 'Content version snapshots exist (v1 unverified vs v2 remediated)');
    const v1 = versionsRes.rows.find((v: any) => v.version_number === 1);
    const v2 = versionsRes.rows.find((v: any) => v.version_number === 2);
    assert(v1?.risk_score === 88, 'Version 1 recorded with initial risk score of 88');
    assert(v2?.risk_score === 12, 'Version 2 recorded with remediated risk score of 12 (-76 reduction)');

    // 8. 12-Step Judge Walkthrough Metadata
    console.log('\n--- 8. 12-Step Judge Walkthrough Sequence ---');
    const steps = demoService.getWalkthroughSteps();
    assert(Array.isArray(steps) && steps.length === 12, '12-step guided judge tour sequence available');
    assert(steps[0].title === 'Initialize Volterra Demo Workspace', 'Step 1 is workspace initialization');
    assert(steps[11].title === 'Official Approval & Immutable Audit Trail', 'Step 12 is formal approval & audit sealing');

    // 9. Quick Form Autofill Snippets
    console.log('\n--- 9. Quick Form Snippets ---');
    const snippets = demoService.getSampleSnippets();
    assert(Boolean(snippets.volterra_ad), 'Snippet "volterra_ad" available for 1-click form autofill');
    assert(Boolean(snippets.volterra_social), 'Snippet "volterra_social" available');
    assert(Boolean(snippets.volterra_press_release), 'Snippet "volterra_press_release" available');
    assert(Boolean(snippets.volterra_corrected_ad), 'Snippet "volterra_corrected_ad" available');

    // 10. Safe Reset (Tenant Isolation Check)
    console.log('\n--- 10. Safe Reset & Tenant Isolation ---');
    // Ensure that resetting the demo does NOT delete other non-demo orgs
    const realOrgsBefore = await db.query('SELECT COUNT(*)::int as count FROM organizations WHERE is_demo = false');
    const resetOrgId = await demoService.resetVolterraDemo();
    const realOrgsAfter = await db.query('SELECT COUNT(*)::int as count FROM organizations WHERE is_demo = false');
    assert(resetOrgId === orgId, 'Demo successfully reset to baseline');
    assert(
      realOrgsBefore.rows[0].count === realOrgsAfter.rows[0].count,
      'Reset is strictly sandboxed: non-demo tenant count remains unchanged',
      `Before: ${realOrgsBefore.rows[0].count}, After: ${realOrgsAfter.rows[0].count}`
    );

    console.log('\n====================================================');
    console.log(` DEMO SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('[Demo Mode Test Suite Crash]:', err);
    process.exit(1);
  }
}

runDemoTests();
