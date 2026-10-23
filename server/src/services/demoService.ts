import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/db.js';
import { config } from '../config/env.js';
import { auditService } from './auditService.js';
import { riskAnalysisService } from './riskAnalysisService.js';

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

export class DemoService {
  public readonly DEMO_ORG_SLUG = 'volterra-demo';
  public readonly DEMO_ORG_NAME = 'VOLTERRA Energy Dynamics (Demo)';

  /**
   * Check status of the VOLTERRA demonstration workspace
   */
  public async getDemoStatus(): Promise<DemoStatus> {
    const orgRes = await db.query(
      `SELECT id, name, slug FROM organizations WHERE slug = $1 AND is_demo = true`,
      [this.DEMO_ORG_SLUG]
    );

    if (orgRes.rows.length === 0) {
      return { isInitialized: false };
    }

    const orgId = orgRes.rows[0].id;

    const [uCount, gCount, eCount, cCount, aCount, contraCount, pCount] = await Promise.all([
      db.query(`SELECT COUNT(*)::int as count FROM users WHERE org_id = $1`, [orgId]),
      db.query(`SELECT COUNT(*)::int as count FROM brand_guidelines WHERE org_id = $1`, [orgId]),
      db.query(`SELECT COUNT(*)::int as count FROM evidence_sources WHERE org_id = $1`, [orgId]),
      db.query(`SELECT COUNT(*)::int as count FROM approved_claims WHERE org_id = $1`, [orgId]),
      db.query(`SELECT COUNT(*)::int as count FROM content_submissions WHERE org_id = $1`, [orgId]),
      db.query(
        `SELECT COUNT(*)::int as count FROM campaign_contradictions cc JOIN campaigns c ON cc.campaign_id = c.id WHERE c.org_id = $1`,
        [orgId]
      ),
      db.query(
        `SELECT COUNT(*)::int as count FROM content_submissions WHERE org_id = $1 AND status IN ('ready_for_review', 'pending_review', 'needs_revision')`,
        [orgId]
      ),
    ]);

    return {
      isInitialized: true,
      orgId,
      orgName: orgRes.rows[0].name,
      stats: {
        usersCount: uCount.rows[0]?.count || 0,
        guidelinesCount: gCount.rows[0]?.count || 0,
        evidenceDocumentsCount: eCount.rows[0]?.count || 0,
        approvedClaimsCount: cCount.rows[0]?.count || 0,
        campaignAssetsCount: aCount.rows[0]?.count || 0,
        contradictionsCount: contraCount.rows[0]?.count || 0,
        pendingReviewsCount: pCount.rows[0]?.count || 0,
      },
    };
  }

  /**
   * Seed or re-seed the VOLTERRA demonstration workspace.
   * STRICT SECURITY: Only operates on the demo organization with slug 'volterra-demo' and is_demo = true.
   * Real customer organizations are never modified or touched.
   */
  public async seedVolterraDemo(force: boolean = false): Promise<string> {
    console.log('[DemoService] Initializing VOLTERRA Demonstration Workspace...');

    let orgId: string;
    const existing = await db.query(
      `SELECT id FROM organizations WHERE slug = $1 AND is_demo = true`,
      [this.DEMO_ORG_SLUG]
    );

    if (existing.rows.length > 0 && !force) {
      console.log('[DemoService] VOLTERRA Demo already seeded.');
      return existing.rows[0].id;
    }

    if (existing.rows.length > 0 && force) {
      orgId = existing.rows[0].id;
      // Clean up ONLY demo organization data
      await this.cleanDemoOrgData(orgId);
    } else {
      // Create new Demo Org
      const orgRes = await db.query(
        `INSERT INTO organizations (name, slug, plan, is_demo)
         VALUES ($1, $2, 'Enterprise Guardian (Demo Edition)', true)
         RETURNING id`,
        [this.DEMO_ORG_NAME, this.DEMO_ORG_SLUG]
      );
      orgId = orgRes.rows[0].id;
    }

    // 1. Create System Settings
    await db.query(
      `INSERT INTO system_settings (
        org_id, llm_provider, llm_model, api_key_configured, strictness_level, auto_scan_on_submit, require_dual_approval
      ) VALUES ($1, 'mock', 'volterra-deterministic-v3', true, 'strict', true, true)
      ON CONFLICT (org_id) DO UPDATE
      SET llm_provider = 'mock', strictness_level = 'strict'`,
      [orgId]
    );

    // 2. Create Demo Users
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const usersData = [
      { email: 'compliance@volterra.demo', name: 'Sarah Sterling (Lead Regulatory Counsel)', role: 'compliance_officer' },
      { email: 'brand@volterra.demo', name: 'Elena Rostova (Brand Director)', role: 'brand_manager' },
      { email: 'creator@volterra.demo', name: 'Julian Vance (Senior Copywriter)', role: 'content_creator' },
      { email: 'admin@volterra.demo', name: 'Arthur Pendelton (Governance Administrator)', role: 'admin' },
    ];

    const userMap = new Map<string, string>();
    for (const u of usersData) {
      const uRes = await db.query(
        `INSERT INTO users (org_id, email, password_hash, full_name, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id, role`,
        [orgId, u.email, passwordHash, u.name, u.role]
      );
      userMap.set(u.role, uRes.rows[0].id);
    }

    const complianceId = userMap.get('compliance_officer')!;
    const brandId = userMap.get('brand_manager')!;
    const creatorId = userMap.get('content_creator')!;
    const adminId = userMap.get('admin')!;

    // 3. Brand Guidelines (VOLTERRA Solid-State EV Battery)
    const guidelines = [
      {
        title: '[Demo] Prohibit Absolute Battery Degradation & Superlative Range Claims',
        category: 'forbidden_terms',
        severity: 'critical',
        description: 'Battery degradation is governed by physical electrochemistry. Absolute claims of "zero degradation" or "indestructible battery" violate FTC 16 CFR § 260 and corporate claims policy Section 3.2. Replace with certified cycle testing metrics (1,200 cycles retaining >85% capacity).',
        rules: {
          forbiddenWords: [
            'zero degradation',
            'infinite battery life',
            'indestructible',
            'charges in seconds',
            'never needs replacement',
            'flawless reliability',
            'most indestructible',
            '100% degradation free',
          ],
          contextNotes: 'Replace hyperbolic claims with certified cycle benchmarks from the certified Engineering Specification Sheet.',
        },
      },
      {
        title: '[Demo] Mandatory Range & Ambient Temperature Disclaimer',
        category: 'mandatory_disclaimers',
        severity: 'high',
        description: 'All commercial marketing materials citing vehicle range, battery capacity, or charging speed must prominently feature the approved ambient temperature disclosure footnote.',
        rules: {
          requiredPhrases: [
            'Actual real-world vehicle range and charging duration vary by ambient temperature, terrain, vehicle aerodynamics, and driving style.',
          ],
          targetChannels: ['Print & Billboard Ad', 'Landing Page', 'Social Media', 'Press Release'],
        },
      },
      {
        title: '[Demo] Commercial Pricing Alignment with Master Sheet Q4',
        category: 'regulatory',
        severity: 'critical',
        description: 'Wholesale and commercial fleet pricing must align strictly with approved Master Commercial Price Sheet Q4 ($7,400 OEM Starter or $6,200 Fleet Volume). Promising pricing below $6,200 constitutes an unapproved pricing violation.',
        rules: {
          forbiddenWords: ['$5,800', '$5800', 'unbeatable price', 'below cost wholesale'],
          contextNotes: 'Direct pricing inquiries to authorized commercial sales schedule.',
        },
      },
      {
        title: '[Demo] Approved Product Naming & Trademark Attribution',
        category: 'tone_voice',
        severity: 'medium',
        description: 'Product must be identified as "Volterra UltimaCell™ Series 4" on primary mention. Informal abbreviations such as "Ultima Cell" or "Volterra Battery" are prohibited.',
        rules: {
          allowedTone: ['authoritative', 'objective', 'technically precise', 'transparent'],
          forbiddenTone: ['sensationalist', 'aggressive', 'informal'],
          forbiddenWords: ['Ultima Cell', 'Volterra Battery', 'VC-4', 'crazy dense'],
        },
      },
    ];

    const ruleMap = new Map<string, string>();
    for (const g of guidelines) {
      const gRes = await db.query(
        `INSERT INTO brand_guidelines (org_id, title, category, description, rules, severity, is_active, version, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, true, 1, $7)
         RETURNING id`,
        [orgId, g.title, g.category, g.description, JSON.stringify(g.rules), g.severity, brandId]
      );
      ruleMap.set(g.category, gRes.rows[0].id);
    }

    // 4. Evidence Sources (Certified Primary Documents)
    const doc1Res = await db.query(
      `INSERT INTO evidence_sources (
        org_id, title, document_type, version, is_outdated, effective_date, file_hash, raw_content
      ) VALUES ($1, $2, $3, $4, false, '2026-01-01', $5, $6)
      RETURNING id`,
      [
        orgId,
        'Volterra UltimaCell Series 4 Engineering Spec Sheet v2.2 (Certified)',
        'technical_spec',
        '2.2',
        'sha256-v0lt3rr4-eng-spec-cert-2026-b4tt3ry',
        'Certified technical specifications for Volterra UltimaCell Series 4 solid-state battery architecture. Independently validated by TÜV SÜD under SAE J2288 protocol. Certified cycle life demonstrates 1,200 full charge-discharge cycles retaining >85.2% nominal capacity. Fast charging from 10% to 80% state of charge validated at 15 minutes with 350 kW DC charging.',
      ]
    );
    const doc1Id = doc1Res.rows[0].id;

    const doc2Res = await db.query(
      `INSERT INTO evidence_sources (
        org_id, title, document_type, version, is_outdated, effective_date, file_hash, raw_content
      ) VALUES ($1, $2, $3, $4, false, '2026-01-01', $5, $6)
      RETURNING id`,
      [
        orgId,
        'Volterra Master Commercial Price Sheet Q4 2026 (Ref: VOL-PRC-2026-Q4)',
        'policy',
        '3.1',
        'sha256-v0lt3rr4-prc-q4-2026-c0mm3rc14l',
        'Executive authorized pricing schedule for OEM starter and commercial fleet wholesale tiers for Q4 2026: OEM Starter Pack at $7,400 per unit (MOQ 1,000 units); Commercial Fleet Volume Tier at $6,200 per unit (MOQ 10,000 units). Standard warranty 8 years or 100,000 miles.',
      ]
    );
    const doc2Id = doc2Res.rows[0].id;

    const doc3Res = await db.query(
      `INSERT INTO evidence_sources (
        org_id, title, document_type, version, is_outdated, effective_date, file_hash, raw_content
      ) VALUES ($1, $2, $3, $4, false, '2026-01-01', $5, $6)
      RETURNING id`,
      [
        orgId,
        'Volterra Regulatory Footnotes & EPA Disclaimer Standards 2026',
        'policy',
        '1.0',
        'sha256-v0lt3rr4-reg-disc-2026-st4nd4rd',
        'Mandatory regulatory footnotes: Actual real-world vehicle range and charging duration vary by ambient temperature, terrain, vehicle aerodynamics, and driving style. Fast charging requires compatible 350 kW DC charging infrastructure.',
      ]
    );
    const doc3Id = doc3Res.rows[0].id;

    // 5. Source Passages
    const passages = [
      {
        docId: doc1Id,
        page: 3,
        section: 'Cycle Life Endurance Protocol (SAE J2288)',
        text: 'Under standard laboratory cycling protocol SAE J2288 at 25°C, the Volterra UltimaCell™ Series 4 cell demonstrates a certified cycle life of 1,200 full charge-discharge cycles retaining greater than 85.2% nominal volumetric capacity. Claims of zero degradation or lifespan beyond 1,500 cycles under commercial load are unvalidated and physically unsupportable.',
      },
      {
        docId: doc1Id,
        page: 4,
        section: 'DC Fast Charging Performance Envelope',
        text: 'DC fast charging from 10% to 80% State of Charge (SOC) is validated at exactly 15 minutes when connected to certified 350 kW (800V architecture) DC fast-charging dispensers under active thermal management. Charging speeds of 5 minutes or below exceed maximum thermal dissipation limits and risk cell delamination.',
      },
      {
        docId: doc1Id,
        page: 2,
        section: 'Gravimetric & Volumetric Density Benchmark',
        text: 'Volterra UltimaCell™ achieves 720 Wh/L volumetric energy density and 380 Wh/kg gravimetric density using a proprietary 0% Cobalt silicon-composite anode with ceramic solid electrolyte.',
      },
      {
        docId: doc2Id,
        page: 1,
        section: 'Commercial OEM Pricing Schedule',
        text: 'Authorized commercial pricing for Q4 2026: Tier 1 OEM Starter Pack (75 kWh standard module) is established at $7,400 per unit (MOQ 1,000 units). Tier 2 Fleet Commercial Volume Pack (100 kWh heavy-duty module) is established at $6,200 per unit (MOQ 10,000 units). Unauthorized pricing below $6,200 per unit violates authorized distribution guidelines.',
      },
      {
        docId: doc2Id,
        page: 2,
        section: 'Commercial Warranty Schedule',
        text: 'Standard warranty period for Volterra UltimaCell™ Series 4 is 8 years or 100,000 miles (whichever occurs first), guaranteeing capacity retention above 70% of initial factory calibration.',
      },
      {
        docId: doc3Id,
        page: 1,
        section: 'Mandatory Consumer Advertising Footnotes',
        text: 'All consumer and commercial advertising materials quoting range, endurance, or charge speed must prominently include: "Actual real-world vehicle range and charging duration vary by ambient temperature, terrain, vehicle aerodynamics, and driving style. Fast charging requires compatible 350 kW DC charging infrastructure."',
      },
    ];

    const passageMap: any = {};
    for (let i = 0; i < passages.length; i++) {
      const p = passages[i];
      const pRes = await db.query(
        `INSERT INTO source_passages (document_id, page_number, section_header, content, passage_index)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [p.docId, p.page, p.section, p.text, i + 1]
      );
      passageMap[`p_${i}`] = pRes.rows[0].id;
    }

    // 6. Approved Claims
    await db.query(
      `INSERT INTO approved_claims (
        org_id, claim_statement, category, verification_status, citation_reference, approved_by, expiration_date
      ) VALUES
      ($1, 'Volterra UltimaCell Series 4 delivers certified 1,200 full charge-discharge cycles retaining >85% capacity under SAE J2288 testing.', 'Technical', 'verified', 'VOL-ENG-2026-v2.2', $2, '2027-12-31'),
      ($1, 'DC fast-charging from 10% to 80% state of charge in 15 minutes with 350 kW DC infrastructure.', 'Performance', 'verified', 'VOL-ENG-2026-v2.2', $2, '2027-12-31'),
      ($1, 'Commercial Fleet Volume Tier pricing established at $6,200 per pack for qualified enterprise commitments.', 'Financial', 'verified', 'VOL-PRC-2026-Q4', $2, '2027-12-31'),
      ($1, 'Volterra UltimaCell architecture utilizes 0% Cobalt chemistry with solid-state ceramic separator.', 'Sustainability', 'verified', 'VOL-ENG-2026-v2.2', $2, '2027-12-31')`,
      [orgId, complianceId]
    );

    // 7. Campaign: Volterra Commercial Launch 2026
    const campRes = await db.query(
      `INSERT INTO campaigns (org_id, name, code, description, status, target_channels, consistency_score)
       VALUES ($1, 'Volterra Commercial Launch 2026 (Demo)', 'CAMP-VOLT-2026', 'Multichannel global commercial launch for Volterra UltimaCell Series 4 solid-state battery architecture across billboard, social, and press releases.', 'active', $2, 42)
       RETURNING id`,
      [orgId, ['Print & Billboard Ad', 'Social Media', 'Press Release']]
    );
    const campaignId = campRes.rows[0].id;

    // 8. Content Submissions (The 3 Assets with Deliberate Contradictions)
    const adContentBody =
      `Meet the revolutionary Volterra UltimaCell Series 4: the world's most indestructible EV battery. Delivering an astounding 1,800 charge cycles with absolute zero degradation, it completely shatters industry limits. Fast-charge from 10% to 80% in an unprecedented 5 minutes. Available for direct fleet delivery starting at just $5,800 per pack. Unbeatable range that never fades.`;

    const sub1Res = await db.query(
      `INSERT INTO content_submissions (
        org_id, campaign_id, author_id, title, channel, content_body, original_content_body, current_version, status, risk_score, risk_level, assigned_reviewer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'ready_for_review', 88, 'critical', $8)
      RETURNING id`,
      [
        orgId,
        campaignId,
        creatorId,
        '[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad',
        'Print & Billboard Ad',
        adContentBody,
        adContentBody,
        complianceId,
      ]
    );
    const sub1Id = sub1Res.rows[0].id;

    // Asset 2: Social Media Creative
    const socialContentBody =
      `Commercial fleets demand endurance. Volterra UltimaCell™ Series 4 delivers 1,500 continuous cycles and ultra-dense 720 Wh/L silicon-ceramic power. OEM fleet volume packages available starting at $6,200 per pack with 8-year warranty. Powering tomorrow's zero-emission transport.`;

    const sub2Res = await db.query(
      `INSERT INTO content_submissions (
        org_id, campaign_id, author_id, title, channel, content_body, original_content_body, current_version, status, risk_score, risk_level, assigned_reviewer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'ready_for_review', 45, 'medium', $8)
      RETURNING id`,
      [
        orgId,
        campaignId,
        creatorId,
        '[Demo] Volterra UltimaCell LinkedIn & X Launch Creative',
        'Social Media',
        socialContentBody,
        socialContentBody,
        brandId,
      ]
    );
    const sub2Id = sub2Res.rows[0].id;

    // Asset 3: Commercial Press Release Draft (The Truth-Aligned Baseline)
    const pressContentBody =
      `Volterra Energy Dynamics today officially announced general commercial availability of the Volterra UltimaCell™ Series 4 solid-state battery architecture. Independently validated at 1,200 full charge-discharge cycles retaining >85% capacity under SAE J2288 testing, the system introduces certified 15-minute 10-80% DC fast-charging with 350 kW infrastructure. The standard 75 kWh pack carries an authorized wholesale base price of $7,400 per unit under 8-year warranty. *Actual real-world vehicle range and charging duration vary by ambient temperature, terrain, vehicle aerodynamics, and driving style.*`;

    const sub3Res = await db.query(
      `INSERT INTO content_submissions (
        org_id, campaign_id, author_id, title, channel, content_body, original_content_body, current_version, status, risk_score, risk_level, assigned_reviewer_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 1, 'approved', 8, 'low', $8)
      RETURNING id`,
      [
        orgId,
        campaignId,
        creatorId,
        '[Demo] Volterra Energy Dynamics Q4 Commercial Press Release',
        'Press Release',
        pressContentBody,
        pressContentBody,
        complianceId,
      ]
    );
    const sub3Id = sub3Res.rows[0].id;

    // 9. Campaign Facts (Structured facts for Cross-Asset Comparison)
    const facts = [
      // Asset 1 (Ad) Facts
      { subId: sub1Id, type: 'price', entity: 'Pack Price', raw: '$5,800', norm: '5800', unit: 'USD' },
      { subId: sub1Id, type: 'specification', entity: 'Cycle Life', raw: '1,800 charge cycles', norm: '1800', unit: 'cycles' },
      { subId: sub1Id, type: 'specification', entity: 'Fast Charging Time', raw: '5 minutes', norm: '5', unit: 'minutes' },
      // Asset 2 (Social) Facts
      { subId: sub2Id, type: 'price', entity: 'Fleet Pack Price', raw: '$6,200', norm: '6200', unit: 'USD' },
      { subId: sub2Id, type: 'specification', entity: 'Cycle Life', raw: '1,500 continuous cycles', norm: '1500', unit: 'cycles' },
      // Asset 3 (Press Release) Facts
      { subId: sub3Id, type: 'price', entity: 'Wholesale Base Price', raw: '$7,400', norm: '7400', unit: 'USD' },
      { subId: sub3Id, type: 'specification', entity: 'Cycle Life', raw: '1,200 full charge-discharge cycles', norm: '1200', unit: 'cycles' },
      { subId: sub3Id, type: 'specification', entity: 'Fast Charging Time', raw: '15-minute 10-80% DC fast-charging', norm: '15', unit: 'minutes' },
    ];

    for (const f of facts) {
      await db.query(
        `INSERT INTO campaign_facts (campaign_id, asset_id, fact_type, entity_name, raw_text, normalized_value, unit)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [campaignId, f.subId, f.type, f.entity, f.raw, f.norm, f.unit]
      );
    }

    // 10. Campaign Contradictions
    await db.query(
      `INSERT INTO campaign_contradictions (
        campaign_id, conflict_type, entity_name, severity, explanation,
        conflicting_assets, approved_truth_ref, approved_truth_value, suggested_correction, status
      ) VALUES
      ($1, 'pricing_discrepancy', 'Pack Price', 'critical',
       'Conflicting wholesale tier pricing across campaign materials: Advertisement quotes unauthorized $5,800 per pack, Social quotes $6,200, and Press Release quotes $7,400.',
       $2, $3, '$7,400 OEM Base / $6,200 Fleet Volume', 'Harmonize pricing to approved Master Commercial Price Sheet Q4 ($6,200 for Fleet Commercial tier).', 'unresolved'),
      ($1, 'specification_mismatch', 'Cycle Life', 'critical',
       'Conflicting battery cycle life endurance claims: Advertisement claims 1,800 cycles, Social Media claims 1,500 cycles, and Press Release cites certified 1,200 cycles.',
       $4, $5, '1,200 cycles retaining >85% capacity (SAE J2288)', 'Correct all materials to certified 1,200 cycle benchmark from Engineering Spec Sheet v2.2.', 'unresolved'),
      ($1, 'specification_mismatch', 'Fast Charging Time', 'high',
       'Contradictory charging duration: Advertisement promises unvalidated 5-minute charge time, while Press Release quotes certified 15-minute rate.',
       $6, $5, '15 minutes (10% to 80% SOC at 350 kW)', 'Update charge time to validated 15-minute rate to prevent technical breach.', 'unresolved')`,
      [
        campaignId,
        JSON.stringify([
          { contentId: sub1Id, title: '[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad', value: '$5,800' },
          { contentId: sub2Id, title: '[Demo] Volterra UltimaCell LinkedIn & X Launch Creative', value: '$6,200' },
          { contentId: sub3Id, title: '[Demo] Volterra Energy Dynamics Q4 Commercial Press Release', value: '$7,400' },
        ]),
        'VOL-PRC-2026-Q4',
        JSON.stringify([
          { contentId: sub1Id, title: '[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad', value: '1,800 cycles' },
          { contentId: sub2Id, title: '[Demo] Volterra UltimaCell LinkedIn & X Launch Creative', value: '1,500 cycles' },
          { contentId: sub3Id, title: '[Demo] Volterra Energy Dynamics Q4 Commercial Press Release', value: '1,200 cycles' },
        ]),
        'VOL-ENG-2026-v2.2',
        JSON.stringify([
          { contentId: sub1Id, title: '[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad', value: '5 minutes' },
          { contentId: sub3Id, title: '[Demo] Volterra Energy Dynamics Q4 Commercial Press Release', value: '15 minutes' },
        ]),
      ]
    );

    // 11. Campaign Consistency Score
    await db.query(
      `INSERT INTO campaign_consistency_scores (
        campaign_id, overall_score, confirmed_violations_count, unresolved_conflicts_count, unverified_info_count, formula_breakdown
      ) VALUES ($1, 48, 2, 3, 1, $2)`,
      [
        campaignId,
        JSON.stringify({
          base_score: 100,
          deductions: [
            { issue_id: 'c1', title: 'Critical Price Contradiction ($5,800 vs $6,200 vs $7,400)', severity: 'critical', deduction_points: 25 },
            { issue_id: 'c2', title: 'Critical Battery Cycle Contradiction (1,800 vs 1,500 vs 1,200)', severity: 'critical', deduction_points: 20 },
            { issue_id: 'c3', title: 'Charge Speed Mismatch (5 min vs 15 min)', severity: 'high', deduction_points: 7 },
          ],
          explanation: 'Score calculated deterministically from itemized severity deductions. Does not represent empirical prediction of market damage.',
        }),
      ]
    );

    // 12. Extracted Claims on Asset 1 (Advertisement)
    await db.query(
      `INSERT INTO extracted_claims (
        content_id, claim_text, claim_type, classification, confidence_score, confidence_rationale,
        matched_passage_id, matched_rule_id, contradiction_details, explanation,
        suggested_correction, status
      ) VALUES
      ($1, 'Delivering an astounding 1,800 charge cycles with absolute zero degradation', 'numerical', 'Contradicted', 0.96,
       'Certified Engineering Spec Sheet v2.2 explicitly confirms cycle life is validated at 1,200 cycles retaining >85% capacity, and physical degradation cannot be zero.',
       $2, $3,
       'Approved Specification certifies 1,200 cycles >85%. Claim of 1,800 cycles with zero degradation is ungrounded and violates physics limits.',
       'Contradicts certified Engineering Spec Sheet v2.2 (Page 3). Zero degradation claim violates FTC 16 CFR § 260.',
       'Validated for 1,200 full charge cycles retaining over 85% nominal capacity under standard SAE J2288 testing.', 'pending_review'),
      ($1, 'Fast-charge from 10% to 80% in an unprecedented 5 minutes', 'numerical', 'Contradicted', 0.94,
       'Certified Engineering Spec Sheet validates fast charging at 15 minutes with 350 kW dispensers. 5-minute claim exceeds thermal safety boundaries.',
       $4, $3,
       'Approved Specification defines 15 minutes as certified charge time.',
       'Contradicts Page 4 of Engineering Spec Sheet v2.2.',
       'Rapidly recharge from 10% to 80% in 15 minutes with certified 350 kW DC charging.', 'pending_review'),
      ($1, 'Available for direct fleet delivery starting at just $5,800 per pack', 'numerical', 'Contradicted', 0.98,
       'Master Commercial Price Sheet Q4 establishes Tier 2 Fleet Commercial volume pricing at $6,200 per pack.',
       $5, $6,
       'Approved Master Price Sheet defines $6,200 as minimum authorized fleet volume price.',
       'Contradicts Master Commercial Price Sheet Q4 (Page 1).',
       'Commercial fleet packages available starting at $6,200 per pack.', 'pending_review'),
      ($1, 'the world''s most indestructible EV battery', 'promotional', 'Needs Human Review', 0.92,
       'Prohibited superlative and ungrounded perfection statement.',
       NULL, $3,
       'Breaches forbidden hyperbole guidelines.',
       'Violates corporate policy Section 3.2 prohibiting unsupportable superlatives.',
       'the engineered endurance of the Volterra UltimaCell™ Series 4 EV battery architecture', 'pending_review')`,
      [
        sub1Id,
        passageMap['p_0'],
        ruleMap.get('forbidden_terms'),
        passageMap['p_1'],
        passageMap['p_3'],
        ruleMap.get('regulatory'),
      ]
    );

    // 13. Risk Report on Asset 1 (Precomputed Explainable Risk Assessment)
    await db.query(
      `INSERT INTO risk_reports (
        content_id, overall_risk_score, risk_category, tone_score, claims_score, compliance_score,
        violations, unsubstantiated_claims, suggested_disclaimers,
        unresolved_uncertainties, remediation_steps, scoring_formula_breakdown, ai_model_used, content_version
      ) VALUES ($1, 88, 'critical', 35, 15, 20, $2, $3, $4, $5, $6, $7, 'volterra-deterministic-v3', 1)`,
      [
        sub1Id,
        JSON.stringify([
          { rule_title: '[Demo] Prohibit Absolute Battery Degradation & Superlative Range Claims', severity: 'critical', matched_text: 'absolute zero degradation', explanation: 'Prohibited absolute claim.' },
          { rule_title: '[Demo] Commercial Pricing Alignment with Master Sheet Q4', severity: 'critical', matched_text: '$5,800 per pack', explanation: 'Contradicts Master Price Sheet.' },
          { rule_title: '[Demo] Mandatory Range & Ambient Temperature Disclaimer', severity: 'high', matched_text: '[Missing Footnote]', explanation: 'Missing required EPA disclosure.' },
        ]),
        JSON.stringify([
          { claim: 'Delivering an astounding 1,800 charge cycles with absolute zero degradation', reason: 'Contradicted by Engineering Spec Sheet v2.2' },
          { claim: 'Fast-charge from 10% to 80% in an unprecedented 5 minutes', reason: 'Contradicted by Engineering Spec Sheet v2.2' },
        ]),
        JSON.stringify([
          '*Actual real-world vehicle range and charging duration vary by ambient temperature, terrain, vehicle aerodynamics, and driving style.*',
        ]),
        JSON.stringify([
          {
            finding_id: 'unc_1',
            text: 'Fast-charge in 5 minutes',
            source_checked: 'Volterra UltimaCell Series 4 Engineering Spec Sheet v2.2',
            explanation: 'Specification sheet certifies 15-minute rate only. 5-minute charge is ungrounded in primary documentation.',
          },
        ]),
        JSON.stringify([
          '1. Correct battery cycle life to certified 1,200 cycles retaining >85% capacity.',
          '2. Align tier price to $6,200 per Master Commercial Price Sheet Q4.',
          '3. Append mandatory ambient temperature disclosure footnote.',
        ]),
        JSON.stringify({
          base_formula: 'Score = min(100, sum(BaseSeverity * DomainMultiplier * Confidence * EvidenceFactor * CampaignMultiplier * StatusMultiplier))',
          total_raw_points: 88,
          clamped_score: 88,
          deduplicated_count: 3,
          disclaimer: 'A score of 100 represents elevated compliance rule violations according to defined enterprise weights and is not a scientifically proven empirical probability of actual brand damage.',
        }),
      ]
    );

    // 14. Content Version 1 & Version 2 Snapshot (For Risk Reduction Diffing Demo)
    const correctedAdBody =
      `Experience the engineered endurance of the Volterra UltimaCell™ Series 4 EV battery architecture. Validated for 1,200 full charge cycles retaining over 85% nominal capacity under standard SAE J2288 testing. Rapidly recharge from 10% to 80% in 15 minutes with certified 350 kW DC charging. Commercial fleet packages available starting at $6,200 per pack. *Actual real-world vehicle range and charging duration vary by ambient temperature, terrain, vehicle aerodynamics, and driving style.*`;

    // Version 1 Snapshot
    await db.query(
      `INSERT INTO content_versions (
        content_id, version_number, content_body, title, risk_score, risk_level, status,
        violations_snapshot, change_summary, created_by
      ) VALUES ($1, 1, $2, $3, 88, 'critical', 'ready_for_review', $4, 'Initial copy submission containing deliberate demonstration issues.', $5)`,
      [
        sub1Id,
        adContentBody,
        '[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad',
        JSON.stringify([
          { ruleTitle: 'Cycle Contradiction', matchedText: '1,800 charge cycles' },
          { ruleTitle: 'Price Contradiction', matchedText: '$5,800 per pack' },
          { ruleTitle: 'Missing Disclaimer', matchedText: '[Missing Footnote]' },
        ]),
        creatorId,
      ]
    );

    // Version 2 Snapshot (Preloaded Corrected State)
    await db.query(
      `INSERT INTO content_versions (
        content_id, version_number, content_body, title, risk_score, risk_level, status,
        violations_snapshot, change_summary, created_by
      ) VALUES ($1, 2, $2, $3, 12, 'low', 'approved', '[]'::jsonb, 'Remediated cycle benchmarks to 1,200, pricing to $6,200, and appended mandatory ambient temperature disclaimer.', $4)`,
      [
        sub1Id,
        correctedAdBody,
        '[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad (Revised)',
        creatorId,
      ]
    );

    // 15. Review History & Comments
    await db.query(
      `INSERT INTO submission_comments (content_id, user_id, comment_text, is_internal_only)
       VALUES
       ($1, $2, 'Legal review check: 1,800 cycles cannot be approved. Specification Sheet v2.2 Page 3 strictly limits certified cycles to 1,200. Also, $5,800 violates Q4 commercial price list.', false),
       ($1, $3, 'Understood. Revising copy now to harmonize with certified 1,200 spec and $6,200 Fleet Volume tier.', false)`,
      [sub1Id, complianceId, creatorId]
    );

    await db.query(
      `INSERT INTO review_approvals (
        content_id, reviewer_id, stage, decision, feedback_notes, conditions, content_version
      ) VALUES
      ($1, $2, 'legal_review', 'revision_requested',
       'Revisions required: Correct 1,800 cycles to 1,200, align price to $6,200, and append mandatory EPA range footnote.',
       'Must cite certified Engineering Spec Sheet v2.2 and Master Commercial Price Sheet Q4.', 1)`,
      [sub1Id, complianceId]
    );

    // 16. Audit Logs
    await auditService.logEvent({
      orgId,
      userId: complianceId,
      action: 'VOLTERRA_DEMO_WORKSPACE_INITIALIZED',
      resourceType: 'org',
      resourceId: orgId,
      details: { brand: 'VOLTERRA', scenario: 'Electric Vehicle Solid-State Battery Governance' },
    });

    console.log('[DemoService] VOLTERRA Demonstration Workspace successfully initialized.');
    return orgId;
  }

  /**
   * Reset the demo workspace back to pristine demonstration state.
   * Guarantees zero side-effects on real customer accounts.
   */
  public async resetVolterraDemo(): Promise<string> {
    const orgRes = await db.query(
      `SELECT id FROM organizations WHERE slug = $1 AND is_demo = true`,
      [this.DEMO_ORG_SLUG]
    );

    if (orgRes.rows.length === 0) {
      // Re-seed directly
      return this.seedVolterraDemo(true);
    }

    const orgId = orgRes.rows[0].id;
    await this.cleanDemoOrgData(orgId);
    return this.seedVolterraDemo(true);
  }

  /**
   * Securely cleans only demo organization records.
   */
  private async cleanDemoOrgData(orgId: string): Promise<void> {
    // Verify it is indeed a demo org
    const check = await db.query(`SELECT is_demo FROM organizations WHERE id = $1`, [orgId]);
    if (!check.rows[0]?.is_demo) {
      throw new Error('Security Violation: Refusing to reset a non-demo organization.');
    }

    // Cascade delete in child tables
    await db.query(`DELETE FROM campaign_review_actions WHERE contradiction_id IN (SELECT id FROM campaign_contradictions WHERE campaign_id IN (SELECT id FROM campaigns WHERE org_id = $1))`, [orgId]);
    await db.query(`DELETE FROM campaign_consistency_scores WHERE campaign_id IN (SELECT id FROM campaigns WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM campaign_contradictions WHERE campaign_id IN (SELECT id FROM campaigns WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM campaign_facts WHERE campaign_id IN (SELECT id FROM campaigns WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM policy_candidate_recommendations WHERE org_id = $1`, [orgId]);
    await db.query(`DELETE FROM reviewer_feedback_records WHERE org_id = $1`, [orgId]);
    await db.query(`DELETE FROM submission_comments WHERE content_id IN (SELECT id FROM content_submissions WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM content_versions WHERE content_id IN (SELECT id FROM content_submissions WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM review_approvals WHERE content_id IN (SELECT id FROM content_submissions WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM risk_reports WHERE content_id IN (SELECT id FROM content_submissions WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM extracted_claims WHERE content_id IN (SELECT id FROM content_submissions WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM content_submissions WHERE org_id = $1`, [orgId]);
    await db.query(`DELETE FROM campaigns WHERE org_id = $1`, [orgId]);
    await db.query(`DELETE FROM source_passages WHERE document_id IN (SELECT id FROM evidence_sources WHERE org_id = $1)`, [orgId]);
    await db.query(`DELETE FROM evidence_sources WHERE org_id = $1`, [orgId]);
    await db.query(`DELETE FROM approved_claims WHERE org_id = $1`, [orgId]);
    await db.query(`DELETE FROM brand_guidelines WHERE org_id = $1`, [orgId]);
    await db.query(`DELETE FROM audit_logs WHERE org_id = $1`, [orgId]);
  }

  /**
   * Switch active user token to a preloaded VOLTERRA role for effortless judge role-playing
   */
  public async getDemoUserToken(role: string): Promise<{ token: string; user: any; org: any }> {
    const orgRes = await db.query(
      `SELECT id, name, slug, plan FROM organizations WHERE slug = $1 AND is_demo = true`,
      [this.DEMO_ORG_SLUG]
    );

    if (orgRes.rows.length === 0) {
      await this.seedVolterraDemo(true);
      return this.getDemoUserToken(role);
    }

    const org = orgRes.rows[0];
    const userRes = await db.query(
      `SELECT * FROM users WHERE org_id = $1 AND role = $2 LIMIT 1`,
      [org.id, role]
    );

    if (userRes.rows.length === 0) {
      throw new Error(`Demo user for role "${role}" not found.`);
    }

    const user = userRes.rows[0];
    const token = jwt.sign(
      { id: user.id, org_id: org.id, email: user.email, role: user.role, full_name: user.full_name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    const { password_hash, ...safeUser } = user;
    return { token, user: safeUser, org };
  }

  /**
   * Quick-load sample content snippets for 1-click form autofill across pages
   */
  public getSampleSnippets(): Record<string, any> {
    return {
      volterra_ad: {
        title: '[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad',
        channel: 'Print & Billboard Ad',
        body: `Meet the revolutionary Volterra UltimaCell Series 4: the world's most indestructible EV battery. Delivering an astounding 1,800 charge cycles with absolute zero degradation, it completely shatters industry limits. Fast-charge from 10% to 80% in an unprecedented 5 minutes. Available for direct fleet delivery starting at just $5,800 per pack. Unbeatable range that never fades.`,
        issuesDescription: 'Contains 4 deliberate violations: 1,800 cycles (vs 1,200), 5 min charge (vs 15 min), $5,800 price (vs $6,200), and missing ambient temperature disclaimer.',
      },
      volterra_corrected_ad: {
        title: '[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad (Revised)',
        channel: 'Print & Billboard Ad',
        body: `Experience the engineered endurance of the Volterra UltimaCell™ Series 4 EV battery architecture. Validated for 1,200 full charge cycles retaining over 85% nominal capacity under standard SAE J2288 testing. Rapidly recharge from 10% to 80% in 15 minutes with certified 350 kW DC charging. Commercial fleet packages available starting at $6,200 per pack. *Actual real-world vehicle range and charging duration vary by ambient temperature, terrain, vehicle aerodynamics, and driving style.*`,
        issuesDescription: 'Fully remediated copy: risk score drops from 88 to 12.',
      },
      volterra_social: {
        title: '[Demo] Volterra UltimaCell LinkedIn & X Launch Creative',
        channel: 'Social Media',
        body: `Commercial fleets demand endurance. Volterra UltimaCell™ Series 4 delivers 1,500 continuous cycles and ultra-dense 720 Wh/L silicon-ceramic power. OEM fleet volume packages available starting at $6,200 per pack with 8-year warranty. Powering tomorrow's zero-emission transport.`,
        issuesDescription: 'Conflicts with Billboard ad on cycle count (1,500 vs 1,800).',
      },
      volterra_press_release: {
        title: '[Demo] Volterra Energy Dynamics Q4 Commercial Press Release',
        channel: 'Press Release',
        body: `Volterra Energy Dynamics today officially announced general commercial availability of the Volterra UltimaCell™ Series 4 solid-state battery architecture. Independently validated at 1,200 full charge-discharge cycles retaining >85% capacity under SAE J2288 testing, the system introduces certified 15-minute 10-80% DC fast-charging with 350 kW infrastructure. The standard 75 kWh pack carries an authorized wholesale base price of $7,400 per unit under 8-year warranty. *Actual real-world vehicle range and charging duration vary by ambient temperature, terrain, vehicle aerodynamics, and driving style.*`,
        issuesDescription: 'Approved factual baseline.',
      },
      volterra_guideline_template: {
        title: '[Demo] Prohibit Absolute Battery Degradation & Superlative Range Claims',
        category: 'forbidden_terms',
        severity: 'critical',
        description: 'Physical battery degradation is governed by thermodynamics. Claims of zero degradation violate FTC guidelines.',
        forbiddenWords: 'zero degradation, infinite battery life, indestructible, charges in seconds, never needs replacement',
        contextNotes: 'Replace with certified cycle testing metrics from Engineering Spec Sheet v2.2.',
      },
    };
  }

  /**
   * Structure and explanations for the 12-Step Judge Interactive Tour
   */
  public getWalkthroughSteps(): any[] {
    return [
      {
        step: 1,
        title: 'Initialize Volterra Demo Workspace',
        route: '/dashboard',
        role: 'admin',
        summary: 'Load the fictional brand VOLTERRA Energy Dynamics (CleanTech OEM promoting EV solid-state batteries).',
        judgeAction: 'Click "Start Interactive Tour" to switch to the Volterra workspace.',
        deliberateIssue: 'None (Setup stage).',
        evidenceSource: 'Volterra Demo Organization created in isolated sandbox.',
      },
      {
        step: 2,
        title: 'Inspect Brand Guidelines & Evidence Sources',
        route: '/guidelines',
        role: 'brand_manager',
        summary: 'Review preloaded brand rules prohibiting absolute "zero degradation" claims and requiring ambient temperature disclaimers.',
        judgeAction: 'Review Rule 1 and Rule 2, then check Evidence Sources for Engineering Spec Sheet v2.2 and Master Commercial Price Sheet Q4.',
        deliberateIssue: 'None (Reviewing rules of engagement).',
        evidenceSource: 'VOL-ENG-2026-v2.2 & VOL-PRC-2026-Q4 in Evidence Library.',
      },
      {
        step: 3,
        title: 'Open Preloaded Billboard Advertisement',
        route: '/submissions',
        role: 'content_creator',
        summary: 'Inspect the preloaded advertisement asset drafted by the copywriter containing deliberate promotional exaggerations.',
        judgeAction: 'Click into the "[Demo] Volterra UltimaCell Q4 Global Print & Billboard Ad" submission.',
        deliberateIssue: 'Ad claims 1,800 cycles with zero degradation, 5-minute charge time, $5,800 price, and omits disclaimers.',
        evidenceSource: 'Original copy displayed with DEMO DATA badges.',
      },
      {
        step: 4,
        title: 'Run Evidence-Backed Claim Verification',
        route: '/claim-verification',
        role: 'compliance_officer',
        summary: 'The verification engine extracts individual factual and promotional statements and compares them against primary documents.',
        judgeAction: 'Observe the 4 extracted claims classified with deterministic confidence scores.',
        deliberateIssue: 'Battery life, charging duration, and pricing are classified as "Contradicted" by primary evidence.',
        evidenceSource: 'Passages linked from certified Engineering Spec Sheet v2.2 and Master Price Sheet Q4.',
      },
      {
        step: 5,
        title: 'Detect Unsupported Battery-Life Claim',
        route: '/claim-verification',
        role: 'compliance_officer',
        summary: 'Deep-dive into the cycle life finding: "1,800 charge cycles with absolute zero degradation".',
        judgeAction: 'Inspect the contradiction callout linking to Page 3, Section "Cycle Life Endurance Protocol".',
        deliberateIssue: 'Claim (1,800 cycles zero degradation) directly contradicts certified spec (1,200 cycles >85%).',
        evidenceSource: 'Passage: "validated at 1,200 cycles... zero degradation is unvalidated".',
      },
      {
        step: 6,
        title: 'Cross-Campaign Consistency Comparison',
        route: '/campaigns',
        role: 'brand_manager',
        summary: 'Compare extracted facts across all 3 campaign assets (Billboard Ad, Social Media, and Press Release).',
        judgeAction: 'View the side-by-side contradiction matrix showing conflicting prices and cycle counts.',
        deliberateIssue: 'Billboard ($5,800) vs Social ($6,200) vs Press Release ($7,400) creates critical pricing conflict.',
        evidenceSource: 'Master Commercial Price Sheet Q4 confirms $6,200 is minimum Fleet Volume tier.',
      },
      {
        step: 7,
        title: 'Check Brand Terminology & Missing Evidence',
        route: '/risk-reports',
        role: 'compliance_officer',
        summary: 'Inspect the Explainable Brand Risk Assessment report with an overall score of 88/100 (Critical Risk).',
        judgeAction: 'Review the mathematical formula breakdown and Unresolved Uncertainties drawer.',
        deliberateIssue: 'Missing mandatory EPA ambient temperature disclaimer incurs legal domain penalty (1.4x multiplier).',
        evidenceSource: 'Volterra Regulatory Footnotes Directive 2026.',
      },
      {
        step: 8,
        title: 'Inspect Suggested Actionable Corrections',
        route: '/risk-reports',
        role: 'compliance_officer',
        summary: 'The engine generates precise corrections grounded in certified evidence rather than arbitrary text generation.',
        judgeAction: 'Review the itemized remediation steps for cycle life, price, and required disclaimers.',
        deliberateIssue: 'Three severe violations require editorial remediation.',
        evidenceSource: 'Suggested phrasing matches approved primary source passages.',
      },
      {
        step: 9,
        title: 'Apply Remediations & Edit Asset',
        route: '/submissions',
        role: 'content_creator',
        summary: 'The author updates the advertisement copy to incorporate verified cycle counts, approved fleet pricing, and the mandatory disclosure footnote.',
        judgeAction: 'View the revised submission text (v2).',
        deliberateIssue: 'All 4 deliberate issues are corrected in the revised draft.',
        evidenceSource: 'Revised text strictly adheres to certified documentation.',
      },
      {
        step: 10,
        title: 'Risk Reduction Comparison (v1 vs v2)',
        route: '/risk-reports',
        role: 'compliance_officer',
        summary: 'Compare version 1 (Score: 88) against version 2 (Score: 12) with side-by-side text diffing.',
        judgeAction: 'Observe the -76 point risk reduction delta: 4 issues remediated, 0 remaining critical issues.',
        deliberateIssue: 'Zero remaining violations in revised draft.',
        evidenceSource: 'Automated revision snapshot diff in content_versions.',
      },
      {
        step: 11,
        title: 'Submit to Human Approval Workflow',
        route: '/reviews',
        role: 'compliance_officer',
        summary: 'Asset transitions from "Needs Revision" to "Ready for Review" in the multi-stage approval center.',
        judgeAction: 'Inspect the reviewer queue and discussion comment thread between Legal and Copywriter.',
        deliberateIssue: 'Reviewer verifies high-risk safeguard requirements are satisfied.',
        evidenceSource: 'Immutable transition history in review_approvals.',
      },
      {
        step: 12,
        title: 'Official Approval & Immutable Audit Trail',
        route: '/audit',
        role: 'compliance_officer',
        summary: 'The compliance signatory issues formal approval. The complete decision history is permanently sealed in the audit trail.',
        judgeAction: 'Inspect the chronological audit log showing timestamps, actor IDs, and cryptographic hashes.',
        deliberateIssue: 'Demonstration complete: asset approved for publication.',
        evidenceSource: 'Append-only audit_logs record sealed.',
      },
    ];
  }
}

export const demoService = new DemoService();
