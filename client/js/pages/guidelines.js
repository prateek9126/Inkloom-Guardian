/**
 * Inkloom Guardian - Brand Guidelines View (Vanilla JS)
 */
window.GuidelinesPageView = {
  guidelines: [],
  categoryFilter: '',
  severityFilter: '',
  searchQuery: '',

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading brand guidelines...</span>
        </div>
      </div>
    `;

    try {
      const res = await window.api.getGuidelines();
      this.guidelines = res.guidelines || [];
      this.renderCards(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load brand guidelines: ${err.message}
        </div>
      `;
    }
  },

  renderCards(container) {
    const filtered = this.guidelines.filter(g => {
      const matchesCat = !this.categoryFilter || g.category === this.categoryFilter;
      const matchesSev = !this.severityFilter || g.severity === this.severityFilter;
      const matchesSearch = !this.searchQuery ||
        g.rule_name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (g.description && g.description.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchesCat && matchesSev && matchesSearch;
    });

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Brand Governance Guidelines</h1>
              <span class="badge badge-demo">VOLTERRA DEMO</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Deterministic rulebooks enforcing legal compliance, prohibited claims, and terminology standards.
            </p>
          </div>

          <button onclick="window.GuidelinesPageView.openCreateModal()" class="btn-primary text-xs">
            + New Guideline Rule
          </button>
        </div>

        <!-- Filter bar -->
        <div class="card-standard p-3 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div class="flex items-center space-x-2">
            <select
              onchange="window.GuidelinesPageView.handleCatFilter(this.value)"
              class="text-xs border border-slate-300 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">All Rule Categories</option>
              <option value="forbidden_terms" ${this.categoryFilter === 'forbidden_terms' ? 'selected' : ''}>Forbidden Terms</option>
              <option value="mandatory_claims" ${this.categoryFilter === 'mandatory_claims' ? 'selected' : ''}>Mandatory Disclaimers</option>
              <option value="tone_and_style" ${this.categoryFilter === 'tone_and_style' ? 'selected' : ''}>Tone & Style</option>
              <option value="competitor_references" ${this.categoryFilter === 'competitor_references' ? 'selected' : ''}>Competitor Claims</option>
            </select>

            <select
              onchange="window.GuidelinesPageView.handleSevFilter(this.value)"
              class="text-xs border border-slate-300 rounded px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              <option value="">All Severities</option>
              <option value="critical" ${this.severityFilter === 'critical' ? 'selected' : ''}>Critical</option>
              <option value="high" ${this.severityFilter === 'high' ? 'selected' : ''}>High</option>
              <option value="medium" ${this.severityFilter === 'medium' ? 'selected' : ''}>Medium</option>
              <option value="low" ${this.severityFilter === 'low' ? 'selected' : ''}>Low</option>
            </select>
          </div>

          <div class="flex-1 max-w-xs">
            <input
              type="text"
              placeholder="Search guideline rules..."
              value="${this.searchQuery}"
              oninput="window.GuidelinesPageView.handleSearch(this.value)"
              class="w-full text-xs border border-slate-300 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>
        </div>

        <!-- Rule Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          ${filtered.map(g => {
            let sevBadge = 'badge-medium';
            if (g.severity === 'critical') sevBadge = 'badge-critical';
            if (g.severity === 'high') sevBadge = 'badge-high';

            const forbidden = Array.isArray(g.forbidden_words) ? g.forbidden_words : [];
            const required = Array.isArray(g.required_phrases) ? g.required_phrases : [];

            return `
              <div class="card-standard p-5 space-y-3 flex flex-col justify-between">
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="badge ${sevBadge} uppercase font-bold">${g.severity}</span>
                    <span class="badge badge-unverified font-mono uppercase text-[10px]">${g.category.replace(/_/g, ' ')}</span>
                  </div>
                  <h3 class="text-sm font-bold text-slate-900">${g.rule_name}</h3>
                  <p class="text-xs text-slate-600 leading-relaxed">${g.description || ''}</p>

                  ${forbidden.length > 0 ? `
                    <div class="pt-2">
                      <span class="text-[10px] font-bold uppercase text-rose-800 tracking-wider">Prohibited Phrases:</span>
                      <div class="flex flex-wrap gap-1 mt-1">
                        ${forbidden.map(w => `<span class="badge badge-critical font-mono text-[10px]">${w}</span>`).join('')}
                      </div>
                    </div>
                  ` : ''}

                  ${required.length > 0 ? `
                    <div class="pt-2">
                      <span class="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">Required Disclaimers:</span>
                      <div class="flex flex-wrap gap-1 mt-1">
                        ${required.map(w => `<span class="badge badge-supported font-mono text-[10px]">${w}</span>`).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>

                <div class="pt-3 border-t border-slate-100 flex justify-end">
                  <button onclick="window.GuidelinesPageView.deleteGuideline('${g.id}')" class="btn-subtle text-[11px] text-red-600 hover:text-red-800">
                    Delete Rule
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  handleCatFilter(val) {
    this.categoryFilter = val;
    this.renderCards(document.getElementById('app-content'));
  },

  handleSevFilter(val) {
    this.severityFilter = val;
    this.renderCards(document.getElementById('app-content'));
  },

  handleSearch(val) {
    this.searchQuery = val;
    this.renderCards(document.getElementById('app-content'));
  },

  openCreateModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Add Brand Guideline Rule</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form onsubmit="window.GuidelinesPageView.submitCreate(event)" class="space-y-3 text-xs">
            <div>
              <label class="block font-medium text-slate-700">Rule Name *</label>
              <input id="rule-name" type="text" required placeholder="e.g. Prohibit Unqualified Superlatives" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-medium text-slate-700">Category</label>
                <select id="rule-category" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                  <option value="forbidden_terms">Forbidden Terms</option>
                  <option value="mandatory_claims">Mandatory Disclaimers</option>
                  <option value="tone_and_style">Tone and Style</option>
                  <option value="competitor_references">Competitor Claims</option>
                </select>
              </div>

              <div>
                <label class="block font-medium text-slate-700">Severity</label>
                <select id="rule-severity" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block font-medium text-slate-700">Description</label>
              <textarea id="rule-desc" rows="2" placeholder="Explain the legal or brand rationale for this rule..." class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs"></textarea>
            </div>

            <div>
              <label class="block font-medium text-slate-700">Forbidden Words / Phrases (comma-separated)</label>
              <input id="rule-forbidden" type="text" placeholder="e.g. 100% guarantee, invincible, best on earth" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Cancel</button>
              <button type="submit" class="btn-primary text-xs">Save Guideline</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitCreate(e) {
    e.preventDefault();
    const name = document.getElementById('rule-name').value.trim();
    const category = document.getElementById('rule-category').value;
    const severity = document.getElementById('rule-severity').value;
    const desc = document.getElementById('rule-desc').value.trim();
    const forbiddenStr = document.getElementById('rule-forbidden').value.trim();
    const forbiddenWords = forbiddenStr ? forbiddenStr.split(',').map(s => s.trim()) : [];

    try {
      const res = await window.api.createGuideline({
        rule_name: name,
        category,
        severity,
        description: desc,
        forbidden_words: forbiddenWords,
        required_phrases: [],
      });
      window.toast.success('Guideline rule created.');
      document.getElementById('modal-container').innerHTML = '';
      this.guidelines.push(res.guideline);
      this.renderCards(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to create rule: ' + err.message);
    }
  },

  async deleteGuideline(id) {
    if (!confirm('Are you sure you want to delete this brand guideline rule?')) return;
    try {
      await window.api.deleteGuideline(id);
      window.toast.success('Guideline deleted.');
      this.guidelines = this.guidelines.filter(g => g.id !== id);
      this.renderCards(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to delete rule: ' + err.message);
    }
  }
};
