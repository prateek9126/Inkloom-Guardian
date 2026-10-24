/**
 * Inkloom Guardian - Human Review & Approval Center View (Vanilla JS)
 */
window.ReviewsPageView = {
  submissions: [],
  team: [],
  filterStatus: 'all',

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading human approval queue...</span>
        </div>
      </div>
    `;

    try {
      const [revRes, setRes] = await Promise.all([
        window.api.getPendingReviews().catch(() => ({ pendingReviews: [] })),
        window.api.getSettings().catch(() => ({ team: [] })),
      ]);
      this.submissions = revRes.pendingReviews || [];
      this.team = setRes.team || [];

      this.renderQueue(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load review center: ${err.message}
        </div>
      `;
    }
  },

  renderQueue(container) {
    const filtered = this.submissions.filter(s => {
      if (this.filterStatus === 'all') return true;
      return s.status === this.filterStatus;
    });

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Human Review & Approval Center</h1>
              <span class="badge badge-demo">VOLTERRA DEMO</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Multi-stage review workflow: Draft → Analysis Pending → Analysis Complete → Ready for Review → Approved/Rejected.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500 font-medium">Logged in Role:</span>
            <span class="badge badge-unverified font-mono font-bold capitalize">
              ${window.auth.getUser() ? window.auth.getUser().role.replace(/_/g, ' ') : 'Reviewer'}
            </span>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="flex items-center space-x-2 border-b border-slate-200 pb-2">
          <button
            onclick="window.ReviewsPageView.setFilter('all')"
            class="px-3 py-1.5 text-xs font-semibold rounded ${this.filterStatus === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
          >
            All Pending (${this.submissions.length})
          </button>
          <button
            onclick="window.ReviewsPageView.setFilter('ready_for_review')"
            class="px-3 py-1.5 text-xs font-semibold rounded ${this.filterStatus === 'ready_for_review' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
          >
            Ready for Review
          </button>
          <button
            onclick="window.ReviewsPageView.setFilter('needs_revision')"
            class="px-3 py-1.5 text-xs font-semibold rounded ${this.filterStatus === 'needs_revision' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
          >
            Needs Revision
          </button>
          <button
            onclick="window.ReviewsPageView.setFilter('approved')"
            class="px-3 py-1.5 text-xs font-semibold rounded ${this.filterStatus === 'approved' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
          >
            Approved
          </button>
        </div>

        <!-- Review Cards Queue -->
        ${filtered.length === 0 ? `
          <div class="card-standard p-8 text-center text-xs text-slate-500">
            No assets currently waiting in this review queue.
          </div>
        ` : `
          <div class="space-y-4">
            ${filtered.map(sub => {
              let sevBadge = 'badge-low';
              if (sub.risk_level === 'critical') sevBadge = 'badge-critical';
              if (sub.risk_level === 'high') sevBadge = 'badge-high';
              if (sub.risk_level === 'medium') sevBadge = 'badge-medium';

              return `
                <div class="card-standard p-5 space-y-3">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="badge ${sevBadge} uppercase font-bold">${sub.risk_level || 'standard'} Risk</span>
                        <span class="badge badge-review capitalize">${sub.status.replace(/_/g, ' ')}</span>
                        <span class="text-xs text-slate-400 font-mono">v${sub.version || 1} • ${sub.channel || 'Marketing'}</span>
                      </div>
                      <h3 class="text-sm font-bold text-slate-900 mt-1">${sub.title}</h3>
                    </div>

                    <div class="flex items-center gap-2">
                      <button
                        onclick="window.ReviewsPageView.openDecisionModal('${sub.id}')"
                        class="btn-primary text-xs py-1.5 px-3"
                      >
                        Submit Decision
                      </button>
                      <button
                        onclick="window.ReviewsPageView.openCommentsModal('${sub.id}')"
                        class="btn-secondary text-xs py-1.5 px-3"
                      >
                        Comments
                      </button>
                    </div>
                  </div>

                  <!-- Text Snippet -->
                  <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-800 font-mono whitespace-pre-wrap line-clamp-3">
${sub.content_body || 'No copy text available.'}
                  </div>

                  <!-- Footer info -->
                  <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <div>
                      Submitted by: <strong class="text-slate-700">${sub.author_name || 'Sarah Chen'}</strong>
                    </div>
                    <div class="space-x-3">
                      <a href="#/claim-verification?contentId=${sub.id}" class="text-slate-900 font-semibold hover:underline">Inspect Claims →</a>
                      <a href="#/risk-reports?contentId=${sub.id}" class="text-sky-700 font-semibold hover:underline">Risk Breakdown →</a>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;
  },

  setFilter(status) {
    this.filterStatus = status;
    this.renderQueue(document.getElementById('app-content'));
  },

  openDecisionModal(contentId) {
    const sub = this.submissions.find(s => s.id === contentId);
    if (!sub) return;

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Authorize Governance Decision</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <strong class="text-slate-900">${sub.title}</strong>
            <div class="text-slate-500 mt-0.5">Current Risk: <span class="badge ${sub.risk_level === 'critical' ? 'badge-critical' : 'badge-low'} uppercase">${sub.risk_level}</span></div>
          </div>

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-medium text-slate-700">Formal Decision *</label>
              <select id="modal-rev-decision" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                <option value="approved">Approved for Publication</option>
                <option value="needs_revision">Request Revisions</option>
                <option value="rejected">Rejected (Unresolvable Violations)</option>
              </select>
            </div>

            <div>
              <label class="block font-medium text-slate-700">Audit Review Notes * (Mandatory for compliance)</label>
              <textarea id="modal-rev-notes" rows="3" required placeholder="State exact policy and factual justification for this approval or rejection..." class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-sans"></textarea>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Cancel</button>
            <button onclick="window.ReviewsPageView.submitDecision('${contentId}')" class="btn-primary text-xs">
              Confirm & Seal Approval
            </button>
          </div>
        </div>
      </div>
    `;
  },

  async submitDecision(contentId) {
    const decision = document.getElementById('modal-rev-decision').value;
    const notes = document.getElementById('modal-rev-notes').value.trim();

    if (!notes) {
      window.toast.error('Reviewer notes are mandatory for the audit log.');
      return;
    }

    try {
      await window.api.submitReviewDecision({
        content_id: contentId,
        decision,
        feedback_notes: notes,
      });
      window.toast.success(`Review decision recorded: ${decision.replace(/_/g, ' ')}`);
      document.getElementById('modal-container').innerHTML = '';
      await this.render(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to submit review: ' + err.message);
    }
  },

  async openCommentsModal(contentId) {
    try {
      const res = await window.api.getComments(contentId);
      const comments = res.comments || [];

      const modal = document.getElementById('modal-container');
      modal.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal-dialog p-6 space-y-4 max-w-xl">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 class="text-sm font-bold text-slate-900">Compliance Review Discussion</h3>
              <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <!-- List -->
            <div class="space-y-2 max-h-60 overflow-y-auto pr-1">
              ${comments.length === 0 ? `
                <p class="text-xs text-slate-500 text-center py-4">No comments recorded yet.</p>
              ` : comments.map(c => `
                <div class="p-2.5 rounded bg-slate-50 border border-slate-200 text-xs space-y-1">
                  <div class="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                    <span>${c.user_name || 'Reviewer'}</span>
                    <span class="text-slate-400 font-mono">${new Date(c.created_at).toLocaleTimeString()}</span>
                  </div>
                  <p class="text-slate-800">${c.comment_text}</p>
                </div>
              `).join('')}
            </div>

            <!-- Add comment -->
            <div class="pt-2 border-t border-slate-200 space-y-2 text-xs">
              <textarea id="modal-new-comment" rows="2" placeholder="Add compliance note..." class="w-full px-3 py-1.5 border border-slate-300 rounded text-xs"></textarea>
              <div class="flex justify-end">
                <button onclick="window.ReviewsPageView.addComment('${contentId}')" class="btn-primary text-xs">
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      window.toast.error('Failed to load comments: ' + err.message);
    }
  },

  async addComment(contentId) {
    const text = document.getElementById('modal-new-comment').value.trim();
    if (!text) return;

    try {
      await window.api.addComment(contentId, text, false);
      window.toast.success('Comment posted.');
      this.openCommentsModal(contentId);
    } catch (err) {
      window.toast.error('Failed to post comment: ' + err.message);
    }
  }
};
