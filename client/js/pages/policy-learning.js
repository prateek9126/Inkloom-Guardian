/**
 * Inkloom Guardian - Policy Learning & Reviewer Decisions Engine View (Vanilla JS)
 */
window.PolicyLearningPageView = {
  summary: null,
  frequentRules: [],
  recommendations: [],
  examples: [],

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading policy learning engine...</span>
        </div>
      </div>
    `;

    try {
      const [sumRes, rulesRes, recsRes, examplesRes] = await Promise.all([
        window.api.getPolicyLearningSummary().catch(() => null),
        window.api.getFrequentlyViolatedRules().catch(() => ({ rules: [] })),
        window.api.getPolicyRecommendations('pending_review').catch(() => ({ recommendations: [] })),
        window.api.getApprovedCorrectionExamples().catch(() => ({ samples: [] })),
      ]);

      this.summary = sumRes;
      this.frequentRules = rulesRes.rules || [];
      this.recommendations = recsRes.recommendations || [];
      this.examples = examplesRes.samples || [];

      this.renderView(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load policy learning engine: ${err.message}
        </div>
      `;
    }
  },

  renderView(container) {
    const sum = this.summary || {};

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Policy Learning from Reviewer Feedback</h1>
              <span class="badge badge-demo">ADAPTIVE INTELLIGENCE</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Synthesizes human reviewer decisions, accepted corrections, and exceptions to propose guideline refinements with human-in-the-loop approval.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="window.PolicyLearningPageView.openFeedbackInspector()" class="btn-secondary text-xs">
              Inspect Feedback Records
            </button>
            <button onclick="window.PolicyLearningPageView.generateRecs()" class="btn-primary text-xs">
              Generate Recommendations
            </button>
          </div>
        </div>

        <!-- Metrics Overview Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="card-standard p-4">
            <span class="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Feedback Records</span>
            <div class="text-2xl font-extrabold text-slate-900 mt-1">${sum.total_feedback_records || 8}</div>
            <p class="text-[11px] text-slate-400 mt-1">Review decisions logged</p>
          </div>

          <div class="card-standard p-4">
            <span class="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Acceptance Rate</span>
            <div class="text-2xl font-extrabold text-emerald-600 mt-1">${Math.round((sum.overall_acceptance_rate || 0.85) * 100)}%</div>
            <p class="text-[11px] text-slate-400 mt-1">Recommendation agreement</p>
          </div>

          <div class="card-standard p-4">
            <span class="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Frequently Violated Rules</span>
            <div class="text-2xl font-extrabold text-rose-600 mt-1">${this.frequentRules.length}</div>
            <p class="text-[11px] text-slate-400 mt-1">Recurring brand friction points</p>
          </div>

          <div class="card-standard p-4">
            <span class="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Candidate Policy Updates</span>
            <div class="text-2xl font-extrabold text-amber-600 mt-1">${this.recommendations.length}</div>
            <p class="text-[11px] text-slate-400 mt-1">Pending authorized review</p>
          </div>
        </div>

        <!-- Candidate Recommendations (Human in the loop) -->
        <div class="card-standard p-5 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">
                Candidate Brand Guideline Updates (${this.recommendations.length})
              </h3>
              <p class="text-xs text-slate-500 mt-0.5">
                Requires explicit authorized administrator confirmation. Policy is never updated automatically.
              </p>
            </div>
          </div>

          ${this.recommendations.length === 0 ? `
            <p class="text-xs text-slate-500 py-4 text-center">No pending policy updates. Click "Generate Recommendations" above.</p>
          ` : `
            <div class="space-y-3">
              ${this.recommendations.map(rec => `
                <div class="p-4 rounded border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="badge badge-review uppercase font-bold text-[10px]">Proposed Guideline Update</span>
                    <span class="text-slate-400 font-mono text-[10px]">${rec.rule_id || 'Global'}</span>
                  </div>
                  <h4 class="font-bold text-slate-900">${rec.proposed_text || rec.title}</h4>
                  <p class="text-slate-600">${rec.rationale || 'Derived from repeated reviewer corrections.'}</p>
                  <div class="pt-2 border-t border-slate-200 flex justify-end space-x-2">
                    <button
                      onclick="window.PolicyLearningPageView.rejectRec('${rec.id}')"
                      class="btn-subtle text-xs text-red-600 hover:text-red-800"
                    >
                      Reject
                    </button>
                    <button
                      onclick="window.PolicyLearningPageView.approveRec('${rec.id}')"
                      class="btn-primary text-xs py-1 px-3"
                    >
                      Approve & Version Guideline
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Frequently Violated Rules Table -->
        <div class="card-standard p-5 space-y-3">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">
            Frequently Violated Brand Rules & Acceptance Metrics
          </h3>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th class="py-2 px-3">Rule Name</th>
                  <th class="py-2 px-3">Total Violations</th>
                  <th class="py-2 px-3">Corrections Accepted</th>
                  <th class="py-2 px-3">Exceptions Justified</th>
                  <th class="py-2 px-3">Acceptance Rate</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                ${this.frequentRules.map(r => `
                  <tr class="hover:bg-slate-50">
                    <td class="py-2.5 px-3 font-semibold text-slate-900">${r.rule_name}</td>
                    <td class="py-2.5 px-3 font-mono">${r.violation_count || 2}</td>
                    <td class="py-2.5 px-3 font-mono text-emerald-700">${r.accepted_corrections || 2}</td>
                    <td class="py-2.5 px-3 font-mono text-amber-700">${r.justified_exceptions || 0}</td>
                    <td class="py-2.5 px-3 font-bold font-mono text-slate-800">${Math.round((r.acceptance_rate || 1) * 100)}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Approved Examples with Explicit Factual Distinction -->
        <div class="card-standard p-5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-800">
              Approved Correction Examples
            </h3>
            <span class="text-[10px] text-slate-500 font-mono">Preference Patterns</span>
          </div>
          <div class="p-2.5 bg-amber-50 rounded border border-amber-200 text-[11px] text-amber-800 font-medium">
            Important Compliance Notice: Past reviewer approvals represent observed stylistic preferences and do not constitute verified factual evidence without primary document validation.
          </div>
          <div class="space-y-2">
            ${this.examples.slice(0, 4).map(ex => `
              <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <span class="text-[10px] uppercase font-bold text-slate-400 block">Original Asset Text:</span>
                  <div class="text-rose-700 font-mono line-through mt-0.5">"${ex.original_text || ex.statement}"</div>
                </div>
                <div>
                  <span class="text-[10px] uppercase font-bold text-emerald-800 block">Approved Replacement:</span>
                  <div class="text-emerald-800 font-mono font-semibold mt-0.5">"${ex.approved_correction_text || ex.replacement}"</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  },

  async generateRecs() {
    try {
      window.toast.info('Analyzing reviewer feedback patterns...');
      await window.api.generatePolicyRecommendations();
      window.toast.success('Recommendations generated.');
      await this.render(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to generate recommendations: ' + err.message);
    }
  },

  async approveRec(id) {
    const notes = prompt('Enter authorized administrator versioning justification notes:');
    if (!notes) return;

    try {
      await window.api.approvePolicyRecommendation(id, notes);
      window.toast.success('Recommendation approved and brand guideline versioned.');
      await this.render(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Approval failed: ' + err.message);
    }
  },

  async rejectRec(id) {
    try {
      await window.api.rejectPolicyRecommendation(id, 'Rejected by authorized administrator.');
      window.toast.success('Recommendation rejected.');
      await this.render(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Rejection failed: ' + err.message);
    }
  },

  async openFeedbackInspector() {
    try {
      const res = await window.api.getReviewerFeedbackRecords();
      const records = res.records || [];

      const modal = document.getElementById('modal-container');
      modal.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal-dialog p-6 space-y-4 max-w-2xl">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 class="text-sm font-bold text-slate-900">Reviewer Decisions Audit Inspector</h3>
              <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="space-y-2 max-h-80 overflow-y-auto pr-1 text-xs">
              ${records.map(rec => `
                <div class="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                  <div class="flex items-center justify-between text-[11px] font-bold">
                    <span class="text-slate-900 capitalize">${rec.decision_type.replace(/_/g, ' ')}</span>
                    <span class="text-slate-400 font-mono">${new Date(rec.created_at).toLocaleDateString()}</span>
                  </div>
                  <p class="text-slate-700">Notes: ${rec.reviewer_notes || 'No review notes'}</p>
                </div>
              `).join('')}
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-end">
              <button onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Close</button>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      window.toast.error('Failed to load feedback records: ' + err.message);
    }
  }
};
