import { db } from '../db/db.js';
import {
  ExtractedClaim,
  ClaimType,
  ClaimClassification,
  EvidenceGraphData,
  EvidenceGraphNode,
  EvidenceGraphEdge
} from '../types/index.js';
import { auditService } from './auditService.js';

export interface ClaimVerificationResult {
  claims: ExtractedClaim[];
  evidenceGraph: EvidenceGraphData;
  summary: {
    total: number;
    supported: number;
    contradicted: number;
    unverified: number;
    needsReview: number;
    overallIntegrityScore: number;
  };
}

export class ClaimVerificationService {
  /**
   * Split document content into clean, traceable passages with page approximations and section headers.
   */
  public chunkDocumentIntoPassages(rawContent: string): Array<{
    passage_index: number;
    page_number: number;
    section_header?: string;
    content: string;
  }> {
    const paragraphs = rawContent
      .split(/\n\s*\n/)
      .map(p => p.trim())
      .filter(p => p.length > 20);

    const passages: Array<{
      passage_index: number;
      page_number: number;
      section_header?: string;
      content: string;
    }> = [];

    let currentSection = 'General Specifications';
    let charCount = 0;

    paragraphs.forEach((p, index) => {
      // Detect heading-like short lines
      if (p.length < 80 && (p.startsWith('#') || p.toUpperCase() === p || p.endsWith(':'))) {
        currentSection = p.replace(/^#+\s*/, '').trim();
      }

      // Approximate 1500 chars per page
      charCount += p.length;
      const pageNumber = Math.max(1, Math.ceil(charCount / 1500));

      passages.push({
        passage_index: index + 1,
        page_number: pageNumber,
        section_header: currentSection,
        content: p,
      });
    });

    if (passages.length === 0 && rawContent.trim().length > 0) {
      passages.push({
        passage_index: 1,
        page_number: 1,
        section_header: 'Document Body',
        content: rawContent.trim(),
      });
    }

    return passages;
  }

  /**
   * Pipeline step 2: Extract individual factual, numerical, comparative, and promotional claims.
   */
  public extractClaimsFromText(content: string): Array<{
    claimText: string;
    claimType: ClaimType;
    positionStart: number;
    positionEnd: number;
  }> {
    const claims: Array<{
      claimText: string;
      claimType: ClaimType;
      positionStart: number;
      positionEnd: number;
    }> = [];

    // Split into sentences
    const sentenceRegex = /[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g;
    let match: RegExpExecArray | null;

    while ((match = sentenceRegex.exec(content)) !== null) {
      const sentence = match[0].trim();
      if (sentence.length < 15) continue;

      const start = match.index;
      const end = start + sentence.length;

      // Determine claim type
      const lower = sentence.toLowerCase();

      // Numerical: Contains numbers, percentages, metrics, monetary figures
      const hasNumber = /\b\d+(?:\.\d+)?%?\b/.test(sentence);
      // Comparative: Contains comparative adjectives, superlatives
      const isComparative = /\b(faster|lowest|highest|more|best|leading|first|exceeds|compared to|peer)\b/i.test(sentence);
      // Promotional: Contains guarantees, ROI, benefits, marketing claims
      const isPromotional = /\b(guaranteed|guarantee|roi|accelerate|unbreakable|zero risk|flawless|breakthrough|empowers|boosts)\b/i.test(sentence);

      let claimType: ClaimType = 'factual';
      if (hasNumber) {
        claimType = 'numerical';
      } else if (isComparative) {
        claimType = 'comparative';
      } else if (isPromotional) {
        claimType = 'promotional';
      }

      // Only include candidate factual, promotional, comparative, or numerical assertions
      if (hasNumber || isComparative || isPromotional || /\b(certified|achieved|complies|standard|reduction|uptime|carbon|security|sla)\b/i.test(sentence)) {
        claims.push({
          claimText: sentence,
          claimType,
          positionStart: start,
          positionEnd: end,
        });
      }
    }

    // Deduplicate identical claims if any
    const uniqueMap = new Map<string, typeof claims[0]>();
    for (const c of claims) {
      if (!uniqueMap.has(c.claimText)) {
        uniqueMap.set(c.claimText, c);
      }
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Pipeline steps 3-6: Retrieve evidence passages, compare against company documents,
   * detect outdated sources or contradictions, and classify as Supported, Contradicted,
   * Unverified, or Needs Human Review.
   */
  public async verifyContentClaims(
    contentId: string,
    orgId: string,
    userId?: string
  ): Promise<ClaimVerificationResult> {
    // 1. Fetch content
    const contentRes = await db.query(
      'SELECT id, title, channel, content_body FROM content_submissions WHERE id = $1 AND org_id = $2',
      [contentId, orgId]
    );

    if (contentRes.rows.length === 0) {
      throw new Error('Content submission not found.');
    }
    const content = contentRes.rows[0];

    // 2. Fetch all approved evidence passages and documents for this org
    const passagesRes = await db.query(
      `SELECT sp.*, es.title as document_title, es.document_type, es.version as document_version,
              es.is_outdated, es.effective_date, es.expiration_date
       FROM source_passages sp
       JOIN evidence_sources es ON sp.document_id = es.id
       WHERE es.org_id = $1
       ORDER BY sp.passage_index ASC`,
      [orgId]
    );
    const passages = passagesRes.rows;

    // 3. Fetch active brand guidelines for cross-rule mapping
    const rulesRes = await db.query(
      'SELECT id, title, category, severity, rules FROM brand_guidelines WHERE org_id = $1 AND is_active = true',
      [orgId]
    );
    const guidelines = rulesRes.rows;

    // 4. Extract candidate claims from content body
    const rawClaims = this.extractClaimsFromText(content.content_body);

    // 5. Delete existing extracted claims for this content submission
    await db.query('DELETE FROM extracted_claims WHERE content_id = $1', [contentId]);

    const extractedClaims: ExtractedClaim[] = [];

    for (const raw of rawClaims) {
      const claimText = raw.claimText;
      const lowerClaim = claimText.toLowerCase();

      // Check for matching Brand Guideline violation first (e.g. prohibited superlatives)
      let matchedRule: any = null;
      for (const g of guidelines) {
        const words = g.rules?.forbiddenWords || [];
        for (const w of words) {
          if (lowerClaim.includes(w.toLowerCase())) {
            matchedRule = g;
            break;
          }
        }
        if (matchedRule) break;
      }

      // Find best matching evidence passages
      // Search score based on keyword overlap and specific numerical tokens
      const scoredPassages = passages.map(p => {
        const score = this.calculatePassageRelevance(claimText, p.content);
        return { passage: p, score };
      }).filter(sp => sp.score > 0.15).sort((a, b) => b.score - a.score);

      const bestMatch = scoredPassages.length > 0 ? scoredPassages[0] : null;

      let classification: ClaimClassification = 'Unverified';
      let confidenceScore = 0.0;
      let confidenceRationale = '';
      let explanation = '';
      let suggestedCorrection: string | null = null;
      let contradictionDetails: string | null = null;
      let matchedPassageId: string | null = null;

      if (!bestMatch || bestMatch.score < 0.25) {
        // No evidence found in approved company library
        classification = 'Unverified';
        confidenceScore = 0.90;
        confidenceRationale = 'Deterministic Search: Zero matching passages found across approved company evidence documents.';
        explanation = `The assertion "${claimText}" has no substantiating audit, policy, or technical evidence in the approved document repository.`;
        suggestedCorrection = matchedRule
          ? `Replace with approved terminology or verify against an authorized legal study.`
          : `Cite an authorized company source or submit verification documentation.`;
      } else {
        const p = bestMatch.passage;
        matchedPassageId = p.id;

        // Check if the evidence document is outdated or expired
        const isExpired = p.expiration_date && new Date(p.expiration_date) < new Date();
        const isOutdated = p.is_outdated || isExpired;

        // Check for numerical contradiction
        const contradictionCheck = this.detectContradiction(claimText, p.content);

        if (contradictionCheck.isContradiction) {
          classification = 'Contradicted';
          confidenceScore = 0.94;
          confidenceRationale = `Direct Factual Contradiction: Found contradicting data points in approved document "${p.document_title}" (v${p.document_version}, Page ${p.page_number}).`;
          contradictionDetails = contradictionCheck.details;
          explanation = `Claim contradicts approved source document: "${contradictionCheck.details}".`;
          suggestedCorrection = contradictionCheck.suggestedFix;
        } else if (isOutdated) {
          classification = 'Needs Human Review';
          confidenceScore = 0.75;
          confidenceRationale = `Outdated/Superseded Evidence: Matched document "${p.document_title}" (v${p.document_version}) is flagged as outdated or expired (${p.expiration_date || 'superseded'}).`;
          explanation = `Passage matches textually, but source document is outdated or expired. Legal or compliance review required to re-certify current validity.`;
          suggestedCorrection = `Re-certify with current ${new Date().getFullYear()} audit report before external publication.`;
        } else if (bestMatch.score >= 0.55) {
          // Strong substantiation
          classification = 'Supported';
          confidenceScore = Math.min(0.99, Math.round(bestMatch.score * 100) / 100);
          confidenceRationale = `Direct Evidence Alignment: Verifiable match with approved document "${p.document_title}" (v${p.document_version}, Page ${p.page_number}, Section: "${p.section_header || 'Body'}").`;
          explanation = `Claim is substantiated by approved evidence: "${p.content.slice(0, 140)}..."`;
        } else {
          // Weak / partial match -> Request Human Review rather than guessing!
          classification = 'Needs Human Review';
          confidenceScore = Math.round(bestMatch.score * 100) / 100;
          confidenceRationale = `Partial Semantic Overlap: Closest passage in "${p.document_title}" provides related context but does not explicitly verify the exact scope of this claim.`;
          explanation = `Evidence is insufficient to definitively certify or contradict without human reviewer determination.`;
          suggestedCorrection = `Clarify specific wording to match verbatim phrasing in "${p.document_title}".`;
        }
      }

      // If matched brand rule prohibited hyperbole, augment suggestion
      if (matchedRule && classification !== 'Supported') {
        explanation += ` Also violates Brand Guideline: ${matchedRule.title}.`;
      }

      // Persist to extracted_claims
      const insertRes = await db.query(
        `INSERT INTO extracted_claims
          (content_id, claim_text, claim_type, position_start, position_end, classification,
           confidence_score, confidence_rationale, matched_passage_id, matched_rule_id,
           contradiction_details, explanation, suggested_correction, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending_review')
         RETURNING *`,
        [
          contentId,
          claimText,
          raw.claimType,
          raw.positionStart,
          raw.positionEnd,
          classification,
          confidenceScore,
          confidenceRationale,
          matchedPassageId,
          matchedRule ? matchedRule.id : null,
          contradictionDetails,
          explanation,
          suggestedCorrection,
        ]
      );

      const savedClaim = insertRes.rows[0];
      if (bestMatch) {
        savedClaim.matched_passage = bestMatch.passage;
      }
      if (matchedRule) {
        savedClaim.matched_rule_title = matchedRule.title;
      }

      extractedClaims.push(savedClaim);
    }

    // Build Evidence Graph Data
    const evidenceGraph = this.buildEvidenceGraph(content, extractedClaims, passages, guidelines);

    // Summary Metrics
    const total = extractedClaims.length;
    const supported = extractedClaims.filter(c => c.classification === 'Supported').length;
    const contradicted = extractedClaims.filter(c => c.classification === 'Contradicted').length;
    const unverified = extractedClaims.filter(c => c.classification === 'Unverified').length;
    const needsReview = extractedClaims.filter(c => c.classification === 'Needs Human Review').length;

    const overallIntegrityScore = total === 0 ? 100 : Math.max(0, Math.round(((supported * 1.0) + (needsReview * 0.4) - (contradicted * 1.5)) / total * 100));

    // Audit log
    await auditService.logEvent({
      orgId,
      userId,
      action: 'CLAIM_VERIFICATION_EXECUTED',
      resourceType: 'content',
      resourceId: contentId,
      details: {
        totalClaims: total,
        supported,
        contradicted,
        unverified,
        needsReview,
        overallIntegrityScore,
      },
    });

    return {
      claims: extractedClaims,
      evidenceGraph,
      summary: {
        total,
        supported,
        contradicted,
        unverified,
        needsReview,
        overallIntegrityScore,
      },
    };
  }

  /**
   * Lexical & keyword similarity scoring between claim and candidate passage
   */
  private calculatePassageRelevance(claim: string, passage: string): number {
    const claimWords = this.tokenize(claim);
    const passageWords = new Set(this.tokenize(passage));

    if (claimWords.length === 0 || passageWords.size === 0) return 0;

    let matchCount = 0;
    for (const w of claimWords) {
      if (passageWords.has(w)) {
        matchCount++;
      }
    }

    // Measure recall and precision
    const claimOverlapRatio = matchCount / claimWords.length;

    // Check for numerical token overlap specifically
    const claimNumbers = claim.match(/\b\d+(?:\.\d+)?%?\b/g) || [];
    let numberBonus = 0;
    for (const num of claimNumbers) {
      if (passage.includes(num)) {
        numberBonus += 0.25;
      }
    }

    return Math.min(1.0, claimOverlapRatio + numberBonus);
  }

  private tokenize(text: string): string[] {
    const stopwords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of', 'with', 'by', 'as',
      'our', 'we', 'from', 'that', 'this', 'are', 'was', 'were', 'it', 'or', 'be', 'has', 'have'
    ]);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));
  }

  /**
   * Distinguish between missing evidence and contradictory evidence!
   * E.g. Claim says "reduced emissions by 50%", but ESG audit says "reduced emissions by 28%".
   * Claim says "99.999% uptime", but SLA policy says "99.99% core platform availability".
   */
  private detectContradiction(claim: string, passage: string): {
    isContradiction: boolean;
    details: string;
    suggestedFix: string;
  } {
    const lowerClaim = claim.toLowerCase();
    const lowerPassage = passage.toLowerCase();

    // Check for emission reduction percentage conflict
    if (lowerClaim.includes('emission') || lowerClaim.includes('carbon')) {
      const claimPercent = claim.match(/(\d+)%/);
      const passagePercent = passage.match(/(\d+)%/);
      if (claimPercent && passagePercent && claimPercent[1] !== passagePercent[1]) {
        return {
          isContradiction: true,
          details: `Claim asserts ${claimPercent[1]}% reduction, but approved ESG report states verified reduction is ${passagePercent[1]}%.`,
          suggestedFix: `Update figure to approved verified figure of ${passagePercent[1]}%.`,
        };
      }
    }

    // Check for uptime / availability conflict
    if (lowerClaim.includes('uptime') || lowerClaim.includes('availability')) {
      const claimUptime = claim.match(/(\d+\.\d+)%/);
      const passageUptime = passage.match(/(\d+\.\d+)%/);
      if (claimUptime && passageUptime && claimUptime[1] !== passageUptime[1]) {
        return {
          isContradiction: true,
          details: `Claim asserts ${claimUptime[1]}% availability, but approved SLA documentation specifies ${passageUptime[1]}%.`,
          suggestedFix: `Align SLA figure with certified contract rate of ${passageUptime[1]}%.`,
        };
      }
    }

    // Check for cycle time reduction conflict
    if (lowerClaim.includes('cycle time') || lowerClaim.includes('review time')) {
      const claimNum = claim.match(/(\d+)%/);
      const passageNum = passage.match(/(\d+)%/);
      if (claimNum && passageNum && claimNum[1] !== passageNum[1]) {
        return {
          isContradiction: true,
          details: `Claim asserts ${claimNum[1]}% cycle time reduction, but official Benchmark Study certifies ${passageNum[1]}%.`,
          suggestedFix: `Replace ${claimNum[1]}% with certified figure of ${passageNum[1]}%.`,
        };
      }
    }

    // Check for unsupportable "zero risk" or "guaranteed ROI"
    if (lowerClaim.includes('guaranteed roi') && lowerPassage.includes('results may vary')) {
      return {
        isContradiction: true,
        details: 'Claim promises guaranteed financial return, contradicting standard Enterprise Disclaimers requiring performance qualification.',
        suggestedFix: 'Replace guaranteed return with "demonstrated measurable efficiency improvements".',
      };
    }

    return {
      isContradiction: false,
      details: '',
      suggestedFix: '',
    };
  }

  /**
   * Constructs an explicit Evidence Graph representing:
   * Content Asset -> Extracted Claim -> Source Passage -> Evidence Document -> Brand Rule -> Decision
   */
  public buildEvidenceGraph(
    content: any,
    claims: ExtractedClaim[],
    passages: any[],
    rules: any[]
  ): EvidenceGraphData {
    const nodes: EvidenceGraphNode[] = [];
    const edges: EvidenceGraphEdge[] = [];

    // Root Content Node
    nodes.push({
      id: `content-${content.id}`,
      type: 'content',
      label: content.title || 'Content Submission',
      status: content.status,
      meta: { channel: content.channel },
    });

    // Claims Nodes & Edges
    claims.forEach((c) => {
      const claimNodeId = `claim-${c.id}`;
      nodes.push({
        id: claimNodeId,
        type: 'claim',
        label: c.claim_text.length > 50 ? `${c.claim_text.slice(0, 48)}...` : c.claim_text,
        status: c.classification,
        meta: {
          classification: c.classification,
          confidence: c.confidence_score,
          claimType: c.claim_type,
          fullText: c.claim_text,
        },
      });

      edges.push({
        id: `edge-content-claim-${c.id}`,
        source: `content-${content.id}`,
        target: claimNodeId,
        relationship: 'extracts_claim',
        label: `Identified ${c.claim_type} claim`,
      });

      // Link to matched passage
      if (c.matched_passage_id) {
        const passage = passages.find(p => p.id === c.matched_passage_id);
        if (passage) {
          const passageNodeId = `passage-${passage.id}`;
          const docNodeId = `doc-${passage.document_id}`;

          // Add passage node if not added
          if (!nodes.some(n => n.id === passageNodeId)) {
            nodes.push({
              id: passageNodeId,
              type: 'evidence_passage',
              label: `Page ${passage.page_number} (§${passage.passage_index})`,
              meta: {
                content: passage.content,
                page: passage.page_number,
                section: passage.section_header,
              },
            });
          }

          // Add document node if not added
          if (!nodes.some(n => n.id === docNodeId)) {
            nodes.push({
              id: docNodeId,
              type: 'source_document',
              label: `${passage.document_title} (v${passage.document_version})`,
              status: passage.is_outdated ? 'Outdated' : 'Valid',
              meta: {
                documentType: passage.document_type,
                version: passage.document_version,
                isOutdated: passage.is_outdated,
              },
            });
          }

          // Edge Claim -> Passage
          edges.push({
            id: `edge-claim-passage-${c.id}`,
            source: claimNodeId,
            target: passageNodeId,
            relationship: c.classification === 'Contradicted' ? 'contradicted_by' : 'substantiated_by',
            label: c.classification === 'Contradicted' ? 'Contradicted by citation' : 'Substantiated by passage',
          });

          // Edge Passage -> Document
          if (!edges.some(e => e.source === passageNodeId && e.target === docNodeId)) {
            edges.push({
              id: `edge-passage-doc-${passage.id}`,
              source: passageNodeId,
              target: docNodeId,
              relationship: 'contained_in',
              label: 'Contained in document',
            });
          }
        }
      }

      // Link to matched brand rule
      if (c.matched_rule_id) {
        const rule = rules.find(r => r.id === c.matched_rule_id);
        if (rule) {
          const ruleNodeId = `rule-${rule.id}`;
          if (!nodes.some(n => n.id === ruleNodeId)) {
            nodes.push({
              id: ruleNodeId,
              type: 'brand_rule',
              label: rule.title,
              severity: rule.severity,
              meta: { category: rule.category },
            });
          }

          edges.push({
            id: `edge-claim-rule-${c.id}`,
            source: claimNodeId,
            target: ruleNodeId,
            relationship: 'violates_rule',
            label: `Flagged by policy (${rule.severity})`,
          });
        }
      }
    });

    return { nodes, edges };
  }
}

export const claimVerificationService = new ClaimVerificationService();
