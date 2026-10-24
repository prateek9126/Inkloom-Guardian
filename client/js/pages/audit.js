/**
 * Inkloom Guardian - Immutable Audit Trail View (Vanilla JS)
 */
window.AuditPageView = {
  logs: [],
  total: 0,
  resourceFilter: '',
  actionFilter: '',
  searchQuery: '',

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading immutable compliance audit trail...</span>
        </div>
      </div>
    `;

    try {
      const res = await window.api.getAuditLogs({ limit: 100 });
      this.logs = res.logs || [];
      this.total = res.total || 0;
      this.renderTable(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load audit trail: ${err.message}
        </div>
      `;
    }
  },

  renderTable(container) {
    const filtered = this.logs.filter(log => {
      const matchesRes = !this.resourceFilter || log.resource_type === this.resourceFilter;
      const matchesAct = !this.actionFilter || log.action === this.actionFilter;
      const matchesSearch = !this.searchQuery ||
        log.action.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        log.resource_type.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (log.user_email && log.user_email.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchesRes && matchesAct && matchesSearch;
    });

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Immutable Compliance Audit Trail</h1>
              <span class="badge badge-demo">CRYPTOGRAPHIC AUDIT</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Append-only tamper-evident record of all claim verifications, reviewer actions, and policy updates.
            </p>
          </div>

          <button onclick="window.AuditPageView.exportCSV()" class="btn-secondary text-xs flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            <span>Export CSV</span>
          </button>
        </div>

        <!-- Filter bar -->
        <div class="card-standard p-3 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div class="flex items-center space-x-2">
            <select
              onchange="window.AuditPageView.handleResFilter(this.value)"
              class="text-xs border border-slate-300 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">All Resource Types</option>
              <option value="content_submission">Content Submissions</option>
              <option value="extracted_claim">Extracted Claims</option>
              <option value="campaign_contradiction">Campaign Contradictions</option>
              <option value="brand_guideline">Brand Guidelines</option>
              <option value="evidence_source">Evidence Sources</option>
            </select>
          </div>

          <div class="flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search audit trail..."
              value="${this.searchQuery}"
              oninput="window.AuditPageView.handleSearch(this.value)"
              class="w-full text-xs border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        <!-- Table -->
        <div class="card-standard overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th class="py-2.5 px-4">Action</th>
                <th class="py-2.5 px-4">Resource Type</th>
                <th class="py-2.5 px-4">Authorized Actor</th>
                <th class="py-2.5 px-4">Timestamp</th>
                <th class="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 font-mono">
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="5" class="py-8 text-center text-slate-500 font-sans">No matching audit logs found.</td>
                </tr>
              ` : filtered.map(log => `
                <tr class="hover:bg-slate-50">
                  <td class="py-2.5 px-4 font-bold text-slate-900 font-sans">${log.action}</td>
                  <td class="py-2.5 px-4 text-slate-600"><span class="badge badge-unverified text-[10px]">${log.resource_type}</span></td>
                  <td class="py-2.5 px-4 text-slate-800 font-sans text-xs">${log.user_email || 'System / Automated Scan'}</td>
                  <td class="py-2.5 px-4 text-slate-400 text-[11px]">${new Date(log.created_at).toLocaleString()}</td>
                  <td class="py-2.5 px-4 text-right">
                    <button onclick="window.AuditPageView.inspectLog('${log.id}')" class="btn-subtle text-[11px] text-slate-700 hover:text-slate-900">
                      View JSON
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  handleResFilter(val) {
    this.resourceFilter = val;
    this.renderTable(document.getElementById('app-content'));
  },

  handleSearch(val) {
    this.searchQuery = val;
    this.renderTable(document.getElementById('app-content'));
  },

  exportCSV() {
    window.open('/api/audit/export?format=csv', '_blank');
    window.toast.success('Exporting audit trail to CSV...');
  },

  inspectLog(logId) {
    const log = this.logs.find(l => l.id === logId);
    if (!log) return;

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4 max-w-xl">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Audit Record Inspector</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <pre class="p-4 bg-slate-900 text-emerald-400 rounded text-xs font-mono max-h-80 overflow-y-auto">${JSON.stringify(log, null, 2)}</pre>

          <div class="pt-3 border-t border-slate-200 flex justify-end">
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Close</button>
          </div>
        </div>
      </div>
    `;
  }
};
