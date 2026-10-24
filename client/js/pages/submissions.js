/**
 * Inkloom Guardian - Content Submissions List View (Vanilla JS)
 */
window.SubmissionsPageView = {
  submissions: [],
  filterStatus: 'all',
  searchQuery: '',

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading content submissions...</span>
        </div>
      </div>
    `;

    try {
      const res = await window.api.getContentSubmissions();
      this.submissions = res.submissions || [];
      this.renderTable(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load content submissions: ${err.message}
        </div>
      `;
    }
  },

  renderTable(container) {
    const filtered = this.submissions.filter(sub => {
      const matchesStatus = this.filterStatus === 'all' || sub.status === this.filterStatus;
      const matchesSearch = !this.searchQuery || 
        sub.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (sub.channel && sub.channel.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchesStatus && matchesSearch;
    });

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900">Content Submissions & Assets</h1>
            <p class="text-xs text-slate-500 mt-1">
              Draft, submitted, and approved enterprise communications evaluated for brand risk.
            </p>
          </div>
          <a href="#/submissions/new" class="btn-primary text-xs">
            + New Content Submission
          </a>
        </div>

        <!-- Filter bar -->
        <div class="card-standard p-3 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div class="flex items-center space-x-2">
            <label class="text-xs font-medium text-slate-600">Status:</label>
            <select
              id="sub-filter-status"
              onchange="window.SubmissionsPageView.handleFilterStatus(this.value)"
              class="text-xs border border-slate-300 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="draft" ${this.filterStatus === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="analysis_pending" ${this.filterStatus === 'analysis_pending' ? 'selected' : ''}>Analysis Pending</option>
              <option value="analysis_complete" ${this.filterStatus === 'analysis_complete' ? 'selected' : ''}>Analysis Complete</option>
              <option value="ready_for_review" ${this.filterStatus === 'ready_for_review' ? 'selected' : ''}>Ready for Review</option>
              <option value="needs_revision" ${this.filterStatus === 'needs_revision' ? 'selected' : ''}>Needs Revision</option>
              <option value="approved" ${this.filterStatus === 'approved' ? 'selected' : ''}>Approved</option>
              <option value="rejected" ${this.filterStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
            </select>
          </div>

          <div class="flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search assets by title or channel..."
              value="${this.searchQuery}"
              oninput="window.SubmissionsPageView.handleSearch(this.value)"
              class="w-full text-xs border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        <!-- Table -->
        <div class="card-standard overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th class="py-2.5 px-4">Title</th>
                <th class="py-2.5 px-4">Channel</th>
                <th class="py-2.5 px-4">Status</th>
                <th class="py-2.5 px-4">Risk Level</th>
                <th class="py-2.5 px-4">Created</th>
                <th class="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="6" class="py-8 text-center text-slate-500">
                    No matching content submissions found.
                  </td>
                </tr>
              ` : filtered.map(sub => {
                let statusBadge = `<span class="badge badge-review">${sub.status.replace(/_/g, ' ')}</span>`;
                if (sub.status === 'approved') statusBadge = `<span class="badge badge-supported">Approved</span>`;
                if (sub.status === 'rejected') statusBadge = `<span class="badge badge-critical">Rejected</span>`;

                let riskBadge = `<span class="badge badge-low">Low</span>`;
                if (sub.risk_level === 'critical') riskBadge = `<span class="badge badge-critical">Critical</span>`;
                if (sub.risk_level === 'high') riskBadge = `<span class="badge badge-high">High</span>`;
                if (sub.risk_level === 'medium') riskBadge = `<span class="badge badge-medium">Medium</span>`;

                return `
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="py-3 px-4 font-medium text-slate-900">
                      ${sub.title}
                      ${sub.title.includes('[Demo]') ? '<span class="ml-1 badge badge-demo">DEMO</span>' : ''}
                    </td>
                    <td class="py-3 px-4 text-slate-600">${sub.channel || 'Standard'}</td>
                    <td class="py-3 px-4">${statusBadge}</td>
                    <td class="py-3 px-4">${riskBadge}</td>
                    <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">
                      ${new Date(sub.created_at).toLocaleDateString()}
                    </td>
                    <td class="py-3 px-4 text-right space-x-1.5">
                      <a href="#/claim-verification?contentId=${sub.id}" class="btn-subtle text-[11px] font-semibold text-slate-900">
                        Verify Claims
                      </a>
                      <a href="#/risk-reports?contentId=${sub.id}" class="btn-subtle text-[11px] font-semibold text-sky-700">
                        Risk Report
                      </a>
                      <button onclick="window.SubmissionsPageView.deleteSubmission('${sub.id}')" class="btn-subtle text-[11px] text-red-600 hover:text-red-800">
                        Delete
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  handleFilterStatus(val) {
    this.filterStatus = val;
    this.renderTable(document.getElementById('app-content'));
  },

  handleSearch(val) {
    this.searchQuery = val;
    this.renderTable(document.getElementById('app-content'));
  },

  async deleteSubmission(id) {
    if (!confirm('Are you sure you want to delete this content submission?')) return;
    try {
      await window.api.deleteContentSubmission(id);
      window.toast.success('Submission deleted.');
      this.submissions = this.submissions.filter(s => s.id !== id);
      this.renderTable(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to delete submission: ' + err.message);
    }
  }
};
