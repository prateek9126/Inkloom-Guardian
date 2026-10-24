/**
 * Inkloom Guardian - Approved Claims Library View (Vanilla JS)
 */
window.ClaimsPageView = {
  claims: [],
  categoryFilter: '',
  statusFilter: '',
  searchQuery: '',

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading approved claims library...</span>
        </div>
      </div>
    `;

    try {
      const res = await window.api.getClaims();
      this.claims = res.claims || [];
      this.renderTable(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load claims library: ${err.message}
        </div>
      `;
    }
  },

  renderTable(container) {
    const filtered = this.claims.filter(c => {
      const matchesCat = !this.categoryFilter || c.category === this.categoryFilter;
      const matchesStat = !this.statusFilter || c.verification_status === this.statusFilter;
      const matchesSearch = !this.searchQuery ||
        c.claim_statement.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (c.citation_reference && c.citation_reference.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchesCat && matchesStat && matchesSearch;
    });

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Approved Claims Library</h1>
              <span class="badge badge-demo">VOLTERRA DEMO</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Verified corporate assertions and numerical benchmarks pre-cleared by legal counsel.
            </p>
          </div>

          <button onclick="window.ClaimsPageView.openCreateModal()" class="btn-primary text-xs">
            + Add Approved Claim
          </button>
        </div>

        <!-- Filter bar -->
        <div class="card-standard p-3 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div class="flex items-center space-x-2">
            <select
              onchange="window.ClaimsPageView.handleCatFilter(this.value)"
              class="text-xs border border-slate-300 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">All Categories</option>
              <option value="Performance" ${this.categoryFilter === 'Performance' ? 'selected' : ''}>Performance</option>
              <option value="Financial" ${this.categoryFilter === 'Financial' ? 'selected' : ''}>Financial</option>
              <option value="Technical" ${this.categoryFilter === 'Technical' ? 'selected' : ''}>Technical</option>
              <option value="Sustainability" ${this.categoryFilter === 'Sustainability' ? 'selected' : ''}>Sustainability</option>
              <option value="Security" ${this.categoryFilter === 'Security' ? 'selected' : ''}>Security</option>
            </select>

            <select
              onchange="window.ClaimsPageView.handleStatFilter(this.value)"
              class="text-xs border border-slate-300 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">All Statuses</option>
              <option value="verified" ${this.statusFilter === 'verified' ? 'selected' : ''}>Verified</option>
              <option value="pending" ${this.statusFilter === 'pending' ? 'selected' : ''}>Pending</option>
              <option value="expired" ${this.statusFilter === 'expired' ? 'selected' : ''}>Expired</option>
            </select>
          </div>

          <div class="flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search claims or citations..."
              value="${this.searchQuery}"
              oninput="window.ClaimsPageView.handleSearch(this.value)"
              class="w-full text-xs border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        <!-- Table -->
        <div class="card-standard overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                <th class="py-2.5 px-4">Claim Statement</th>
                <th class="py-2.5 px-4">Category</th>
                <th class="py-2.5 px-4">Status</th>
                <th class="py-2.5 px-4">Approved Citation Reference</th>
                <th class="py-2.5 px-4">Expires</th>
                <th class="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${filtered.length === 0 ? `
                <tr>
                  <td colspan="6" class="py-8 text-center text-slate-500">No approved claims found.</td>
                </tr>
              ` : filtered.map(c => `
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="py-3 px-4 font-semibold text-slate-900 max-w-sm">"${c.claim_statement}"</td>
                  <td class="py-3 px-4"><span class="badge badge-unverified font-mono">${c.category}</span></td>
                  <td class="py-3 px-4">
                    <span class="badge ${c.verification_status === 'verified' ? 'badge-supported' : 'badge-review'} capitalize">${c.verification_status}</span>
                  </td>
                  <td class="py-3 px-4 text-slate-600 font-mono text-[11px]">${c.citation_reference || 'Internal Legal Doc'}</td>
                  <td class="py-3 px-4 text-slate-400 font-mono text-[11px]">${c.expiration_date || 'None'}</td>
                  <td class="py-3 px-4 text-right space-x-1.5">
                    <button onclick="window.ClaimsPageView.deleteClaim('${c.id}')" class="btn-subtle text-[11px] text-red-600 hover:text-red-800">
                      Delete
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

  handleCatFilter(val) {
    this.categoryFilter = val;
    this.renderTable(document.getElementById('app-content'));
  },

  handleStatFilter(val) {
    this.statusFilter = val;
    this.renderTable(document.getElementById('app-content'));
  },

  handleSearch(val) {
    this.searchQuery = val;
    this.renderTable(document.getElementById('app-content'));
  },

  openCreateModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Add Pre-Approved Claim</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form onsubmit="window.ClaimsPageView.submitCreate(event)" class="space-y-3 text-xs">
            <div>
              <label class="block font-medium text-slate-700">Claim Assertion *</label>
              <textarea id="claim-statement" rows="3" required placeholder="e.g. Delivers up to 1,200 continuous battery discharge cycles..." class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs"></textarea>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-medium text-slate-700">Category</label>
                <select id="claim-category" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                  <option value="Performance">Performance</option>
                  <option value="Financial">Financial</option>
                  <option value="Technical">Technical</option>
                  <option value="Sustainability">Sustainability</option>
                  <option value="Security">Security</option>
                </select>
              </div>

              <div>
                <label class="block font-medium text-slate-700">Citation Reference</label>
                <input id="claim-citation" type="text" placeholder="e.g. UL Benchmark v3.1 §4" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
              </div>
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Cancel</button>
              <button type="submit" class="btn-primary text-xs">Save Claim</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitCreate(e) {
    e.preventDefault();
    const statement = document.getElementById('claim-statement').value.trim();
    const category = document.getElementById('claim-category').value;
    const citation = document.getElementById('claim-citation').value.trim();

    try {
      const res = await window.api.createClaim({
        claim_statement: statement,
        category,
        citation_reference: citation,
        verification_status: 'verified',
        approved_by: 'Legal Counsel',
      });
      window.toast.success('Approved claim created.');
      document.getElementById('modal-container').innerHTML = '';
      this.claims.push(res.claim);
      this.renderTable(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to create claim: ' + err.message);
    }
  },

  async deleteClaim(id) {
    if (!confirm('Are you sure you want to delete this approved claim?')) return;
    try {
      await window.api.deleteClaim(id);
      window.toast.success('Claim deleted.');
      this.claims = this.claims.filter(c => c.id !== id);
      this.renderTable(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to delete claim: ' + err.message);
    }
  }
};
