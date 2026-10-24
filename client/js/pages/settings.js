/**
 * Inkloom Guardian - Settings & Team Page View (Vanilla JS)
 */
window.SettingsPageView = {
  org: null,
  settings: null,
  team: [],

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading system configuration...</span>
        </div>
      </div>
    `;

    try {
      const res = await window.api.getSettings();
      this.org = res.organization;
      this.settings = res.settings || {};
      this.team = res.team || [];

      this.renderView(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load settings: ${err.message}
        </div>
      `;
    }
  },

  renderView(container) {
    const s = this.settings || {};

    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Workspace Settings & Team</h1>
              <span class="badge badge-demo">VOLTERRA DEMO</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Deterministic verification parameters, strictness thresholds, and role-based access control.
            </p>
          </div>

          <button onclick="window.SettingsPageView.resetDemo()" class="btn-secondary text-xs text-red-600 border-red-200 hover:bg-red-50">
            Reset Demo Environment
          </button>
        </div>

        <!-- System Governance Parameters Form -->
        <div class="card-standard p-6 bg-white space-y-4">
          <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-200">
            Deterministic Verification Engine Configuration
          </h3>

          <form onsubmit="window.SettingsPageView.saveSettings(event)" class="space-y-4 text-xs">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block font-medium text-slate-700">Verification Model</label>
                <input
                  id="set-model"
                  type="text"
                  value="${s.llm_model || 'inkloom-deterministic-v2'}"
                  class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded font-mono text-xs"
                />
              </div>

              <div>
                <label class="block font-medium text-slate-700">Verification Strictness Level</label>
                <select id="set-strictness" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                  <option value="standard" ${s.strictness_level === 'standard' ? 'selected' : ''}>Standard (Balanced Evidence Grounding)</option>
                  <option value="strict" ${s.strictness_level === 'strict' ? 'selected' : ''}>Strict (Zero-Tolerance Exact Word Citations)</option>
                  <option value="lenient" ${s.strictness_level === 'lenient' ? 'selected' : ''}>Lenient (Semantic Paraphrase Allowed)</option>
                </select>
              </div>
            </div>

            <div class="space-y-2 pt-2">
              <div class="flex items-center space-x-2">
                <input id="set-autoscan" type="checkbox" ${s.auto_scan_on_submit !== false ? 'checked' : ''} class="rounded text-slate-900 focus:ring-slate-900" />
                <label for="set-autoscan" class="text-xs font-medium text-slate-800">
                  Automatically run claim extraction and evidence graph verification on new submissions
                </label>
              </div>

              <div class="flex items-center space-x-2">
                <input id="set-dualapproval" type="checkbox" ${s.require_dual_approval !== false ? 'checked' : ''} class="rounded text-slate-900 focus:ring-slate-900" />
                <label for="set-dualapproval" class="text-xs font-medium text-slate-800">
                  Enforce strict separation of duties (Content creator cannot approve their own content)
                </label>
              </div>
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-end">
              <button type="submit" class="btn-primary text-xs">
                Save System Settings
              </button>
            </div>
          </form>
        </div>

        <!-- Team Members & Roles -->
        <div class="card-standard p-6 bg-white space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700">Governance Personas & Team</h3>
              <p class="text-xs text-slate-500 mt-0.5">Role-based permissions separating authoring, compliance, and administration.</p>
            </div>
            <button onclick="window.SettingsPageView.openInviteModal()" class="btn-secondary text-xs">
              + Add Member
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th class="py-2.5 px-3">Name</th>
                  <th class="py-2.5 px-3">Email</th>
                  <th class="py-2.5 px-3">Role</th>
                  <th class="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                ${this.team.map(member => `
                  <tr class="hover:bg-slate-50">
                    <td class="py-2.5 px-3 font-semibold text-slate-900">${member.full_name}</td>
                    <td class="py-2.5 px-3 text-slate-600 font-mono text-[11px]">${member.email}</td>
                    <td class="py-2.5 px-3">
                      <span class="badge badge-unverified font-mono text-[10px] capitalize">${member.role.replace(/_/g, ' ')}</span>
                    </td>
                    <td class="py-2.5 px-3 text-right">
                      <button onclick="window.SettingsPageView.removeMember('${member.id}')" class="btn-subtle text-[11px] text-red-600 hover:text-red-800">
                        Remove
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async saveSettings(e) {
    e.preventDefault();
    const model = document.getElementById('set-model').value.trim();
    const strictness = document.getElementById('set-strictness').value;
    const autoScan = document.getElementById('set-autoscan').checked;
    const dualApproval = document.getElementById('set-dualapproval').checked;

    try {
      await window.api.updateSystemSettings({
        llm_model: model,
        strictness_level: strictness,
        auto_scan_on_submit: autoScan,
        require_dual_approval: dualApproval,
      });
      window.toast.success('System settings saved.');
    } catch (err) {
      window.toast.error('Failed to save settings: ' + err.message);
    }
  },

  openInviteModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Add Team Member</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form onsubmit="window.SettingsPageView.submitInvite(event)" class="space-y-3 text-xs">
            <div>
              <label class="block font-medium text-slate-700">Full Name *</label>
              <input id="inv-name" type="text" required placeholder="e.g. David Ross" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
            </div>

            <div>
              <label class="block font-medium text-slate-700">Email Address *</label>
              <input id="inv-email" type="email" required placeholder="david@company.com" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
            </div>

            <div>
              <label class="block font-medium text-slate-700">Governance Role</label>
              <select id="inv-role" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                <option value="compliance_officer">Compliance Officer</option>
                <option value="brand_manager">Brand Manager</option>
                <option value="content_creator">Content Creator</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Cancel</button>
              <button type="submit" class="btn-primary text-xs">Add Member</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitInvite(e) {
    e.preventDefault();
    const fullName = document.getElementById('inv-name').value.trim();
    const email = document.getElementById('inv-email').value.trim();
    const role = document.getElementById('inv-role').value;

    try {
      const res = await window.api.inviteTeamMember({ full_name: fullName, email, role });
      window.toast.success('Member added.');
      document.getElementById('modal-container').innerHTML = '';
      this.team.push(res.user);
      this.renderView(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to add member: ' + err.message);
    }
  },

  async removeMember(memberId) {
    if (!confirm('Remove this team member from the workspace?')) return;
    try {
      await window.api.removeTeamMember(memberId);
      window.toast.success('Member removed.');
      this.team = this.team.filter(m => m.id !== memberId);
      this.renderView(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to remove member: ' + err.message);
    }
  },

  async resetDemo() {
    window.tour.resetDemo();
  }
};
