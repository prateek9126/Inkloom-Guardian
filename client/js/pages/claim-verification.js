/**
 * Inkloom Guardian - Claim Verification & Traceable Evidence Graph View (Vanilla JS)
 */
window.ClaimVerificationPageView = {
  submissions: [],
  selectedContentId: '',
  verificationData: null,
  activeTab: 'claims',
  selectedGraphNode: null,

  async render(container) {
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const contentIdParam = urlParams.get('contentId');

    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading claim verification engine...</span>
        </div>
      </div>
    `;

    try {
      const res = await window.api.getContentSubmissions();
      this.submissions = res.submissions || [];

      if (this.submissions.length > 0) {
        const volterraSub = this.submissions.find(s => s.title.toLowerCase().includes('volterra') || s.title.includes('[Demo]'));
        this.selectedContentId = contentIdParam && this.submissions.some(s => s.id === contentIdParam)
          ? contentIdParam
          : (volterraSub ? volterraSub.id : this.submissions[0].id);
      }

      await this.loadVerificationData();
      this.renderView(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load claim verification: ${err.message}
        </div>
      `;
    }
  },

  async loadVerificationData() {
    if (!this.selectedContentId) return;
    try {
      this.verificationData = await window.api.getClaimVerification(this.selectedContentId);
    } catch (err) {
      console.warn('Error fetching verification:', err);
      this.verificationData = null;
    }
  },

  renderView(container) {
    const data = this.verificationData;
    const content = data ? data.content : null;
    const claims = data ? data.claims || [] : [];
    const summary = data ? data.summary || {} : {};
    const graph = data ? data.evidenceGraph : null;

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Top Title & Asset Switcher -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Claim Verification & Evidence Graph</h1>
              <span class="badge badge-demo">VOLTERRA DEMO</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Deterministic claim extraction, passage-level attribution, and mathematical integrity evaluation.
            </p>
          </div>

          <!-- Selector -->
          <div class="flex items-center space-x-2">
            <label class="text-xs font-semibold text-slate-700">Target Asset:</label>
            <select
              id="verification-asset-select"
              onchange="window.ClaimVerificationPageView.handleSelectAsset(this.value)"
              class="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 max-w-xs"
            >
              ${this.submissions.map(s => `
                <option value="${s.id}" ${s.id === this.selectedContentId ? 'selected' : ''}>
                  ${s.title}
                </option>
              `).join('')}
            </select>

            <button
              onclick="window.ClaimVerificationPageView.reverifyContent()"
              class="btn-secondary text-xs flex items-center gap-1.5"
              title="Re-run Verification Scan"
            >
              <span>Re-Verify</span>
            </button>
          </div>
        </div>

        <!-- Summary Metric Row -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div class="card-standard p-3 text-center">
            <span class="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Total Claims</span>
            <div class="text-xl font-extrabold text-slate-900 mt-1">${summary.total || 0}</div>
          </div>
          <div class="card-standard p-3 text-center bg-emerald-50/50 border-emerald-200">
            <span class="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">Supported</span>
            <div class="text-xl font-extrabold text-emerald-700 mt-1">${summary.supported || 0}</div>
          </div>
          <div class="card-standard p-3 text-center bg-rose-50/50 border-rose-200">
            <span class="text-[10px] font-bold uppercase text-rose-800 tracking-wider">Contradicted</span>
            <div class="text-xl font-extrabold text-rose-700 mt-1">${summary.contradicted || 0}</div>
          </div>
          <div class="card-standard p-3 text-center bg-slate-50 border-slate-200">
            <span class="text-[10px] font-bold uppercase text-slate-600 tracking-wider">Unverified</span>
            <div class="text-xl font-extrabold text-slate-700 mt-1">${summary.unverified || 0}</div>
          </div>
          <div class="card-standard p-3 text-center bg-amber-50/50 border-amber-200">
            <span class="text-[10px] font-bold uppercase text-amber-800 tracking-wider">Needs Review</span>
            <div class="text-xl font-extrabold text-amber-700 mt-1">${summary.needsReview || 0}</div>
          </div>
          <div class="card-standard p-3 text-center">
            <span class="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Integrity Score</span>
            <div class="text-xl font-extrabold ${summary.integrityScore >= 70 ? 'text-emerald-600' : 'text-amber-600'} mt-1">
              ${summary.integrityScore !== undefined ? summary.integrityScore + '%' : '100%'}
            </div>
          </div>
        </div>

        <!-- Tab Controls -->
        <div class="flex items-center space-x-2 border-b border-slate-200 pb-2">
          <button
            onclick="window.ClaimVerificationPageView.setTab('claims')"
            class="px-3 py-1.5 text-xs font-semibold rounded ${this.activeTab === 'claims' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
          >
            Extracted Claims & Provenance (${claims.length})
          </button>
          <button
            onclick="window.ClaimVerificationPageView.setTab('graph')"
            class="px-3 py-1.5 text-xs font-semibold rounded ${this.activeTab === 'graph' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
          >
            Traceable Evidence Graph Viewer
          </button>
          <button
            onclick="window.ClaimVerificationPageView.setTab('content')"
            class="px-3 py-1.5 text-xs font-semibold rounded ${this.activeTab === 'content' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
          >
            Original Asset Copy
          </button>
        </div>

        <!-- Tab Body -->
        <div id="verification-tab-content">
          ${this.renderActiveTab(claims, graph, content)}
        </div>
      </div>
    `;
  },

  renderActiveTab(claims, graph, content) {
    if (this.activeTab === 'claims') {
      return this.renderClaimsTab(claims);
    } else if (this.activeTab === 'graph') {
      return this.renderGraphTab(graph);
    } else {
      return this.renderContentTab(content);
    }
  },

  renderClaimsTab(claims) {
    if (claims.length === 0) {
      return `
        <div class="card-standard p-8 text-center text-xs text-slate-500">
          No factual claims detected in this asset. Run Re-Verify or upload marketing text containing numerical or performance claims.
        </div>
      `;
    }

    return `
      <div class="space-y-4">
        ${claims.map((claim, idx) => {
          let badgeClass = 'badge-unverified';
          if (claim.classification === 'Supported') badgeClass = 'badge-supported';
          if (claim.classification === 'Contradicted') badgeClass = 'badge-contradicted';
          if (claim.classification === 'Needs Human Review') badgeClass = 'badge-review';

          const confidencePct = Math.round((claim.confidence_score || 0) * 100);

          return `
            <div class="card-standard p-5 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                    ${idx + 1}
                  </span>
                  <span class="badge ${badgeClass}">${claim.classification}</span>
                  <span class="text-[11px] font-mono text-slate-400">Confidence: ${confidencePct}%</span>
                  <span class="text-[11px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono uppercase">${claim.claim_type}</span>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    onclick="window.ClaimVerificationPageView.openReviewModal('${claim.id}')"
                    class="btn-secondary text-[11px] py-1 px-2.5"
                  >
                    Human Review
                  </button>
                  ${claim.suggested_correction ? `
                    <button
                      onclick="window.ClaimVerificationPageView.applyCorrection('${claim.id}', '${encodeURIComponent(claim.suggested_correction)}')"
                      class="btn-primary text-[11px] py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700"
                    >
                      Apply Correction
                    </button>
                  ` : ''}
                </div>
              </div>

              <!-- Statement -->
              <div class="p-3 bg-slate-50 rounded border border-slate-200">
                <div class="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Asset Assertion:</div>
                <div class="text-xs font-semibold text-slate-900 mt-1">"${claim.claim_text}"</div>
              </div>

              <!-- Contradiction & Provenance Citation -->
              ${claim.matched_passage_text ? `
                <div class="p-3 bg-emerald-50/50 rounded border border-emerald-200 text-xs">
                  <div class="flex items-center justify-between text-[11px] font-bold text-emerald-900">
                    <span>Certified Primary Evidence Citation:</span>
                    <span class="font-mono text-slate-600">
                      ${claim.source_document_title || 'Certified Benchmark Study'} • Page ${claim.source_page_number || '1'}
                    </span>
                  </div>
                  <p class="text-slate-800 text-xs mt-1.5 italic font-serif">
                    "${claim.matched_passage_text}"
                  </p>
                </div>
              ` : ''}

              ${claim.suggested_correction ? `
                <div class="p-3 bg-rose-50/50 rounded border border-rose-200 text-xs">
                  <div class="text-[11px] font-bold text-rose-900">Detected Contradiction & Suggested Correction:</div>
                  <p class="text-rose-800 text-xs mt-1">
                    <strong>Correction:</strong> "${claim.suggested_correction}"
                  </p>
                  ${claim.explanation ? `<p class="text-slate-600 text-[11px] mt-1">${claim.explanation}</p>` : ''}
                </div>
              ` : ''}

              ${claim.human_review_status ? `
                <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <span>Human Review Decision:</span>
                  <strong class="text-slate-900 capitalize">${claim.human_review_status}</strong>
                  ${claim.review_notes ? `— <em>"${claim.review_notes}"</em>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderGraphTab(graph) {
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
      return `
        <div class="card-standard p-8 text-center text-xs text-slate-500">
          No evidence graph nodes generated for this asset.
        </div>
      `;
    }

    const contentNodes = graph.nodes.filter(n => n.type === 'content' || n.type === 'claim');
    const passageNodes = graph.nodes.filter(n => n.type === 'evidence_passage');
    const sourceNodes = graph.nodes.filter(n => n.type === 'source_document' || n.type === 'brand_rule');

    return `
      <div class="card-standard p-5 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700">
              Interactive Evidence Provenance Hierarchy
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              ${graph.nodes.length} Nodes & ${graph.edges.length} Traceable Provenance Edges
            </p>
          </div>
          <span class="badge badge-demo">PROVENANCE MATRIX</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Column 1: Claims -->
          <div class="space-y-2">
            <div class="text-xs font-bold text-slate-700 pb-1 border-b border-slate-200 flex items-center justify-between">
              <span>Claims in Asset</span>
              <span class="text-[11px] text-slate-400 font-mono">${contentNodes.length}</span>
            </div>
            ${contentNodes.map(node => `
              <div
                onclick="window.ClaimVerificationPageView.selectGraphNode('${node.id}')"
                class="p-2.5 rounded border border-slate-200 bg-white hover:border-slate-400 cursor-pointer text-xs transition-colors shadow-2xs"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-mono text-slate-400 uppercase">${node.type}</span>
                  <span class="badge ${node.status === 'Supported' ? 'badge-supported' : (node.status === 'Contradicted' ? 'badge-contradicted' : 'badge-unverified')}">${node.status || 'Extracted'}</span>
                </div>
                <div class="font-medium text-slate-900 mt-1">${node.label}</div>
              </div>
            `).join('')}
          </div>

          <!-- Column 2: Evidence Passages -->
          <div class="space-y-2">
            <div class="text-xs font-bold text-slate-700 pb-1 border-b border-slate-200 flex items-center justify-between">
              <span>Ground Truth Passages</span>
              <span class="text-[11px] text-slate-400 font-mono">${passageNodes.length}</span>
            </div>
            ${passageNodes.map(node => `
              <div
                onclick="window.ClaimVerificationPageView.selectGraphNode('${node.id}')"
                class="p-2.5 rounded border border-emerald-200 bg-emerald-50/30 hover:border-emerald-400 cursor-pointer text-xs transition-colors shadow-2xs"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-mono text-emerald-800 font-bold uppercase">Passage ${node.properties && node.properties.page_number ? 'P.' + node.properties.page_number : ''}</span>
                  <span class="badge badge-supported">Certified</span>
                </div>
                <div class="font-medium text-slate-900 mt-1">${node.label}</div>
              </div>
            `).join('')}
          </div>

          <!-- Column 3: Primary Sources -->
          <div class="space-y-2">
            <div class="text-xs font-bold text-slate-700 pb-1 border-b border-slate-200 flex items-center justify-between">
              <span>Primary Approved Sources</span>
              <span class="text-[11px] text-slate-400 font-mono">${sourceNodes.length}</span>
            </div>
            ${sourceNodes.map(node => `
              <div
                onclick="window.ClaimVerificationPageView.selectGraphNode('${node.id}')"
                class="p-2.5 rounded border border-slate-300 bg-slate-50 hover:border-slate-500 cursor-pointer text-xs transition-colors shadow-2xs"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-mono text-slate-500 uppercase">${node.type.replace(/_/g, ' ')}</span>
                  <span class="badge badge-demo">Source of Truth</span>
                </div>
                <div class="font-medium text-slate-900 mt-1">${node.label}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Node Inspector Drawer -->
        <div id="graph-node-inspector" class="mt-4 p-4 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <span class="font-semibold text-slate-800">Node Inspector:</span> Click any node above to trace its verified citations, relationships, and document provenance.
        </div>
      </div>
    `;
  },

  selectGraphNode(nodeId) {
    const data = this.verificationData;
    if (!data || !data.evidenceGraph) return;

    const node = data.evidenceGraph.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const edges = data.evidenceGraph.edges.filter(e => e.source === nodeId || e.target === nodeId);
    const inspector = document.getElementById('graph-node-inspector');
    if (!inspector) return;

    inspector.innerHTML = `
      <div class="space-y-2">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <strong class="text-slate-900 text-sm">${node.label}</strong>
          <span class="badge badge-demo font-mono">${node.type}</span>
        </div>
        <p class="text-xs text-slate-700 font-mono">${JSON.stringify(node.properties || {}, null, 2)}</p>
        <div class="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
          Connected Relations: <strong>${edges.map(e => e.relationship).join(', ') || 'Root Node'}</strong>
        </div>
      </div>
    `;
  },

  renderContentTab(content) {
    if (!content) return `<div class="card-standard p-6 text-xs text-slate-500">No asset selected.</div>`;

    return `
      <div class="card-standard p-6 space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h3 class="text-sm font-bold text-slate-900">${content.title}</h3>
            <span class="text-xs text-slate-500 font-mono">${content.channel || 'Marketing'} • Version ${content.version || 1}</span>
          </div>
          <a href="#/risk-reports?contentId=${content.id}" class="btn-primary text-xs">
            Open Explainable Risk Report
          </a>
        </div>
        <div class="p-4 bg-slate-50 rounded border border-slate-200 font-mono text-xs leading-relaxed whitespace-pre-wrap text-slate-800">
${content.content_body || 'No text content available.'}
        </div>
      </div>
    `;
  },

  setTab(tab) {
    this.activeTab = tab;
    this.renderView(document.getElementById('app-content'));
  },

  handleSelectAsset(contentId) {
    this.selectedContentId = contentId;
    window.location.hash = `#/claim-verification?contentId=${contentId}`;
  },

  async reverifyContent() {
    if (!this.selectedContentId) return;
    try {
      window.toast.info('Running Claim Verification engine...');
      await window.api.runClaimVerification(this.selectedContentId);
      await this.loadVerificationData();
      this.renderView(document.getElementById('app-content'));
      window.toast.success('Claim verification updated.');
    } catch (err) {
      window.toast.error('Re-verification failed: ' + err.message);
    }
  },

  openReviewModal(claimId) {
    const data = this.verificationData;
    const claim = data && data.claims ? data.claims.find(c => c.id === claimId) : null;
    if (!claim) return;

    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Human Claim Review Decision</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <span class="text-[10px] font-bold uppercase text-slate-500">Claim Statement:</span>
            <p class="font-semibold text-slate-900 mt-1">"${claim.claim_text}"</p>
          </div>

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-medium text-slate-700">Review Decision *</label>
              <select id="modal-review-decision" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                <option value="confirmed">Confirmed (Approve Finding)</option>
                <option value="rejected">Rejected (Override - Finding False)</option>
                <option value="amended">Amended (Modify Classification)</option>
              </select>
            </div>

            <div>
              <label class="block font-medium text-slate-700">Reviewer Justification Notes *</label>
              <textarea id="modal-review-notes" rows="3" required placeholder="Mandatory written rationale for compliance audit trail..." class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-sans"></textarea>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Cancel</button>
            <button onclick="window.ClaimVerificationPageView.submitReviewDecision('${claimId}')" class="btn-primary text-xs">
              Save Review Decision
            </button>
          </div>
        </div>
      </div>
    `;
  },

  async submitReviewDecision(claimId) {
    const decision = document.getElementById('modal-review-decision').value;
    const notes = document.getElementById('modal-review-notes').value.trim();

    if (!notes) {
      window.toast.error('Reviewer justification notes are required.');
      return;
    }

    try {
      await window.api.reviewClaim(claimId, decision, notes);
      window.toast.success('Human review decision recorded.');
      document.getElementById('modal-container').innerHTML = '';
      await this.loadVerificationData();
      this.renderView(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to submit review: ' + err.message);
    }
  },

  async applyCorrection(claimId, encodedCorrection) {
    const correctionText = decodeURIComponent(encodedCorrection);
    if (!confirm(`Apply verified evidence correction into the asset body?\n\n"${correctionText}"`)) {
      return;
    }

    try {
      window.toast.info('Applying correction...');
      await window.api.applyClaimCorrection(claimId, correctionText);
      window.toast.success('Correction applied directly to asset body.');
      await this.loadVerificationData();
      this.renderView(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to apply correction: ' + err.message);
    }
  }
};
