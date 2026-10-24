/**
 * Inkloom Guardian - Cross-Campaign Consistency Workspace View (Vanilla JS)
 */
window.CampaignsPageView = {
  campaigns: [],
  selectedCampaign: null,
  assets: [],
  contradictions: [],
  facts: [],
  scoreBreakdown: null,
  activeTab: 'contradictions',
  severityFilter: 'all',

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading cross-campaign consistency workspace...</span>
        </div>
      </div>
    `;

    try {
      const res = await window.api.getCampaigns();
      this.campaigns = res.campaigns || [];

      if (this.campaigns.length > 0) {
        const demoCamp = this.campaigns.find(c => c.code === 'CAMP-VOLT-2026' || c.code === 'CAMP-2026-HW') || this.campaigns[0];
        await this.selectCampaign(demoCamp.id);
      }

      this.renderWorkspace(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load campaign workspace: ${err.message}
        </div>
      `;
    }
  },

  async selectCampaign(campaignId) {
    try {
      const [campRes, consistRes] = await Promise.all([
        window.api.getCampaign(campaignId),
        window.api.getCampaignConsistency(campaignId),
      ]);
      this.selectedCampaign = campRes.campaign;
      this.assets = campRes.assets || [];
      this.contradictions = consistRes.contradictions || [];
      this.facts = consistRes.facts || [];
      this.scoreBreakdown = consistRes.scoreBreakdown || null;
    } catch (err) {
      console.warn('Error loading campaign details:', err);
    }
  },

  async handleSelectChange(campaignId) {
    await this.selectCampaign(campaignId);
    this.renderWorkspace(document.getElementById('app-content'));
  },

  renderWorkspace(container) {
    const camp = this.selectedCampaign;
    if (!camp) {
      container.innerHTML = `<div class="card-standard p-8 text-center text-xs text-slate-500">No campaigns found. Create one below.</div>`;
      return;
    }

    const score = this.scoreBreakdown ? this.scoreBreakdown.score : 80;

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Cross-Campaign Consistency Engine</h1>
              <span class="badge badge-demo">VOLTERRA DEMO</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Multi-asset contradiction detection, expired promotion flags, and unified specification alignment.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <select
              id="campaign-select"
              onchange="window.CampaignsPageView.handleSelectChange(this.value)"
              class="text-xs border border-slate-300 rounded px-3 py-1.5 bg-white font-medium focus:ring-1 focus:ring-slate-900"
            >
              ${this.campaigns.map(c => `
                <option value="${c.id}" ${c.id === camp.id ? 'selected' : ''}>
                  ${c.name} (${c.code})
                </option>
              `).join('')}
            </select>

            <button
              onclick="window.CampaignsPageView.scanConsistency()"
              class="btn-primary text-xs flex items-center gap-1.5"
            >
              <span>Scan Contradictions</span>
            </button>

            <button
              onclick="window.CampaignsPageView.openCreateModal()"
              class="btn-secondary text-xs"
            >
              + New Campaign
            </button>
          </div>
        </div>

        <!-- Score Gauge & Overview Banner -->
        <div class="card-standard p-5 bg-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div class="flex items-center space-x-5">
            <div class="w-20 h-20 rounded-full border-4 ${score >= 80 ? 'border-emerald-500 text-emerald-700' : 'border-amber-500 text-amber-700'} flex flex-col items-center justify-center font-extrabold text-2xl shadow-inner">
              ${score}
              <span class="text-[9px] uppercase tracking-wider text-slate-400 font-semibold -mt-1">/ 100</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-base font-bold text-slate-900">${camp.name}</h3>
                <span class="badge badge-demo">${camp.code}</span>
              </div>
              <p class="text-xs text-slate-500 mt-1 max-w-xl">
                ${camp.description || 'Enterprise multi-channel campaign with assets evaluated against approved price sheets and specs.'}
              </p>
              <div class="mt-2 text-xs text-slate-600 flex items-center gap-3">
                <span>Enrolled Assets: <strong class="text-slate-900">${this.assets.length}</strong></span>
                <span>•</span>
                <span>Active Contradictions: <strong class="text-rose-600">${this.contradictions.filter(c => c.status === 'open').length}</strong></span>
                <span>•</span>
                <span>Extracted Facts: <strong class="text-slate-900">${this.facts.length}</strong></span>
              </div>
            </div>
          </div>

          <!-- Itemized Deductions Summary -->
          ${this.scoreBreakdown && this.scoreBreakdown.deductions && this.scoreBreakdown.deductions.length > 0 ? `
            <div class="bg-slate-50 p-3 rounded border border-slate-200 text-xs w-full md:w-80">
              <span class="font-bold text-slate-700 uppercase text-[10px] tracking-wider block pb-1 border-b border-slate-200">
                Itemized Score Deductions
              </span>
              <div class="space-y-1 mt-1.5 max-h-24 overflow-y-auto">
                ${this.scoreBreakdown.deductions.map(d => `
                  <div class="flex items-center justify-between text-[11px]">
                    <span class="text-slate-600 truncate mr-2">${d.reason}</span>
                    <span class="font-mono text-rose-600 font-semibold">-${d.points}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Tabs -->
        <div class="flex items-center justify-between border-b border-slate-200 pb-2">
          <div class="flex items-center space-x-2">
            <button
              onclick="window.CampaignsPageView.setTab('contradictions')"
              class="px-3 py-1.5 text-xs font-semibold rounded ${this.activeTab === 'contradictions' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
            >
              Detected Contradictions (${this.contradictions.length})
            </button>
            <button
              onclick="window.CampaignsPageView.setTab('facts')"
              class="px-3 py-1.5 text-xs font-semibold rounded ${this.activeTab === 'facts' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
            >
              Extracted Structured Facts (${this.facts.length})
            </button>
            <button
              onclick="window.CampaignsPageView.setTab('assets')"
              class="px-3 py-1.5 text-xs font-semibold rounded ${this.activeTab === 'assets' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}"
            >
              Enrolled Campaign Assets (${this.assets.length})
            </button>
          </div>
        </div>

        <!-- Tab Body -->
        <div>
          ${this.renderActiveTab()}
        </div>
      </div>
    `;
  },

  renderActiveTab() {
    if (this.activeTab === 'contradictions') {
      return this.renderContradictionsTab();
    } else if (this.activeTab === 'facts') {
      return this.renderFactsTab();
    } else {
      return this.renderAssetsTab();
    }
  },

  renderContradictionsTab() {
    if (this.contradictions.length === 0) {
      return `
        <div class="card-standard p-8 text-center text-xs text-slate-500">
          No cross-asset contradictions detected. All campaign assets share consistent pricing, claims, and specifications.
        </div>
      `;
    }

    return `
      <div class="space-y-4">
        ${this.contradictions.map(contra => {
          let sevClass = 'badge-medium';
          if (contra.severity === 'critical') sevClass = 'badge-critical';
          if (contra.severity === 'high') sevClass = 'badge-high';

          let statusClass = contra.status === 'resolved' ? 'badge-supported' : 'badge-contradicted';

          return `
            <div class="card-standard p-5 space-y-3">
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="badge ${sevClass} uppercase font-bold">${contra.severity}</span>
                  <span class="badge ${statusClass} capitalize">${contra.status}</span>
                  <span class="text-xs font-bold text-slate-900">${contra.title || contra.issue_type}</span>
                </div>

                ${contra.status !== 'resolved' ? `
                  <button
                    onclick="window.CampaignsPageView.openReviewModal('${contra.id}')"
                    class="btn-primary text-xs py-1 px-3"
                  >
                    Resolve Contradiction
                  </button>
                ` : `
                  <span class="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                    ✓ Resolved by Reviewer
                  </span>
                `}
              </div>

              <!-- Side-by-side asset values comparison -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div class="p-3 bg-rose-50/60 rounded border border-rose-200 text-xs">
                  <span class="text-[10px] font-bold uppercase text-rose-800">Asset 1 Assertion:</span>
                  <div class="font-semibold text-slate-900 mt-1">${contra.asset_1_title || 'Creative 1'}</div>
                  <div class="p-2 bg-white rounded mt-1.5 font-mono text-rose-700 font-bold border border-rose-100">
                    "${contra.value_1 || contra.conflicting_values && contra.conflicting_values[0] || 'Unmatched'}"
                  </div>
                </div>

                <div class="p-3 bg-rose-50/60 rounded border border-rose-200 text-xs">
                  <span class="text-[10px] font-bold uppercase text-rose-800">Asset 2 Assertion:</span>
                  <div class="font-semibold text-slate-900 mt-1">${contra.asset_2_title || 'Creative 2'}</div>
                  <div class="p-2 bg-white rounded mt-1.5 font-mono text-rose-700 font-bold border border-rose-100">
                    "${contra.value_2 || contra.conflicting_values && contra.conflicting_values[1] || 'Unmatched'}"
                  </div>
                </div>
              </div>

              <!-- Approved ground truth reference -->
              <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
                <div class="flex items-center justify-between text-[11px] font-bold text-slate-800">
                  <span>Approved Benchmark Ground Truth:</span>
                  <span class="text-emerald-700 font-mono font-bold">${contra.approved_value || 'Official Spec Sheet'}</span>
                </div>
                <p class="text-slate-600 text-[11px] mt-1">${contra.explanation || 'Contradiction detected across multiple creative assets.'}</p>
                ${contra.suggested_remediation ? `
                  <div class="mt-2 text-xs font-medium text-slate-900 bg-white p-2 rounded border border-slate-200">
                    <strong>Suggested Remediation:</strong> ${contra.suggested_remediation}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderFactsTab() {
    return `
      <div class="card-standard overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
              <th class="py-2.5 px-4">Entity Type</th>
              <th class="py-2.5 px-4">Entity Key</th>
              <th class="py-2.5 px-4">Normalized Value</th>
              <th class="py-2.5 px-4">Source Asset</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 font-mono">
            ${this.facts.map(f => `
              <tr class="hover:bg-slate-50">
                <td class="py-2.5 px-4"><span class="badge badge-unverified">${f.fact_type}</span></td>
                <td class="py-2.5 px-4 font-semibold text-slate-800">${f.fact_key}</td>
                <td class="py-2.5 px-4 text-emerald-800 font-bold">${f.normalized_value}</td>
                <td class="py-2.5 px-4 text-slate-500">${f.content_title || f.content_id}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderAssetsTab() {
    return `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${this.assets.map(asset => `
          <div class="card-standard p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="badge badge-unverified">${asset.channel || 'Creative'}</span>
              <span class="badge ${asset.risk_level === 'critical' ? 'badge-critical' : 'badge-low'} capitalize">${asset.risk_level || 'standard'}</span>
            </div>
            <h4 class="font-bold text-slate-900 text-xs">${asset.title}</h4>
            <p class="text-xs text-slate-500 line-clamp-3 font-mono">${asset.content_body}</p>
            <div class="pt-2 border-t border-slate-100 flex justify-end">
              <a href="#/claim-verification?contentId=${asset.id}" class="btn-subtle text-[11px] font-semibold text-slate-900">
                Inspect Asset Claims →
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  setTab(tab) {
    this.activeTab = tab;
    this.renderWorkspace(document.getElementById('app-content'));
  },

  async scanConsistency() {
    if (!this.selectedCampaign) return;
    try {
      window.toast.info('Running Cross-Campaign Consistency Scan...');
      await window.api.scanCampaignConsistency(this.selectedCampaign.id);
      await this.selectCampaign(this.selectedCampaign.id);
      this.renderWorkspace(document.getElementById('app-content'));
      window.toast.success('Cross-campaign consistency scan complete.');
    } catch (err) {
      window.toast.error('Scan failed: ' + err.message);
    }
  },

  openReviewModal(contraId) {
    const contra = this.contradictions.find(c => c.id === contraId);
    if (!contra) return;

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Review & Resolve Contradiction</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="p-3 bg-slate-50 rounded border border-slate-200 text-xs">
            <div class="font-semibold text-slate-900">${contra.title || contra.issue_type}</div>
            <div class="text-slate-600 mt-1">${contra.explanation}</div>
          </div>

          <div class="space-y-3 text-xs">
            <div>
              <label class="block font-medium text-slate-700">Resolution Action *</label>
              <select id="modal-contra-action" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                <option value="resolve">Resolve (Accept Approved Correction)</option>
                <option value="exception">Mark as Justified Exception</option>
                <option value="escalate">Escalate to Legal Review</option>
              </select>
            </div>

            <div>
              <label class="block font-medium text-slate-700">Audit Justification Notes *</label>
              <textarea id="modal-contra-notes" rows="3" required placeholder="Document the reason for resolving or marking exception..." class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-sans"></textarea>
            </div>
          </div>

          <div class="pt-3 border-t border-slate-200 flex justify-end space-x-2">
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Cancel</button>
            <button onclick="window.CampaignsPageView.submitReviewAction('${contraId}')" class="btn-primary text-xs">
              Save Resolution
            </button>
          </div>
        </div>
      </div>
    `;
  },

  async submitReviewAction(contraId) {
    const action = document.getElementById('modal-contra-action').value;
    const notes = document.getElementById('modal-contra-notes').value.trim();

    if (!notes) {
      window.toast.error('Justification notes are required for compliance audit trail.');
      return;
    }

    try {
      await window.api.reviewCampaignContradiction(contraId, action, notes);
      window.toast.success('Contradiction status updated.');
      document.getElementById('modal-container').innerHTML = '';
      await this.selectCampaign(this.selectedCampaign.id);
      this.renderWorkspace(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to submit resolution: ' + err.message);
    }
  },

  openCreateModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Create New Campaign Workspace</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form onsubmit="window.CampaignsPageView.submitCreateCampaign(event)" class="space-y-3 text-xs">
            <div>
              <label class="block font-medium text-slate-700">Campaign Name *</label>
              <input id="camp-name" type="text" required placeholder="e.g. Q1 Global Launch" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
            </div>

            <div>
              <label class="block font-medium text-slate-700">Campaign Code *</label>
              <input id="camp-code" type="text" required placeholder="e.g. CAMP-2026-Q1" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs uppercase" />
            </div>

            <div>
              <label class="block font-medium text-slate-700">Description</label>
              <textarea id="camp-desc" rows="2" placeholder="Campaign scope and target audience..." class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs"></textarea>
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Cancel</button>
              <button type="submit" class="btn-primary text-xs">Create Campaign</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitCreateCampaign(e) {
    e.preventDefault();
    const name = document.getElementById('camp-name').value.trim();
    const code = document.getElementById('camp-code').value.trim();
    const description = document.getElementById('camp-desc').value.trim();

    try {
      const res = await window.api.createCampaign({ name, code, description });
      window.toast.success('Campaign created.');
      document.getElementById('modal-container').innerHTML = '';
      this.campaigns.push(res.campaign);
      await this.selectCampaign(res.campaign.id);
      this.renderWorkspace(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to create campaign: ' + err.message);
    }
  }
};
