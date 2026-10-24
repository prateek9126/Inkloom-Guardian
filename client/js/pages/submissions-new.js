/**
 * Inkloom Guardian - New Content Submission View (Vanilla JS)
 */
window.NewSubmissionPageView = {
  campaigns: [],
  snippets: {},

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading form data...</span>
        </div>
      </div>
    `;

    try {
      const [campRes, snipRes] = await Promise.all([
        window.api.getCampaigns().catch(() => ({ campaigns: [] })),
        window.api.getDemoSnippets().catch(() => ({ snippets: {} })),
      ]);
      this.campaigns = campRes.campaigns || [];
      this.snippets = snipRes.snippets || {};

      this.renderForm(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load form: ${err.message}
        </div>
      `;
    }
  },

  renderForm(container) {
    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-6 font-sans">
        <div class="flex items-center justify-between pb-2 border-b border-slate-200">
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-slate-900">Submit Content for AI Governance</h1>
            <p class="text-xs text-slate-500 mt-1">
              Upload marketing copy, press releases, or documentation for claim extraction and risk verification.
            </p>
          </div>
          <a href="#/submissions" class="btn-secondary text-xs">
            Back to Submissions
          </a>
        </div>

        <!-- 1-Click Demo Snippets Panel -->
        <div class="card-standard p-4 bg-slate-900 text-white border-slate-800">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="badge badge-demo">VOLTERRA DEMO</span>
              <span class="text-xs font-semibold text-slate-200">Load Test Creative Assets</span>
            </div>
            <span class="text-[11px] text-slate-400">1-click autofill to test verification</span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            <button
              type="button"
              onclick="window.NewSubmissionPageView.applySnippet('volterra_ad')"
              class="btn-secondary text-[11px] py-1.5 px-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-left flex flex-col items-start"
            >
              <strong class="text-rose-400 font-semibold">1. Volterra Billboard Ad</strong>
              <span class="text-[10px] text-slate-400">Critical pricing & specs</span>
            </button>

            <button
              type="button"
              onclick="window.NewSubmissionPageView.applySnippet('volterra_social')"
              class="btn-secondary text-[11px] py-1.5 px-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-left flex flex-col items-start"
            >
              <strong class="text-amber-400 font-semibold">2. Volterra Social Media</strong>
              <span class="text-[10px] text-slate-400">Expired promotion discount</span>
            </button>

            <button
              type="button"
              onclick="window.NewSubmissionPageView.applySnippet('volterra_press_release')"
              class="btn-secondary text-[11px] py-1.5 px-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-left flex flex-col items-start"
            >
              <strong class="text-sky-400 font-semibold">3. Volterra Press Release</strong>
              <span class="text-[10px] text-slate-400">Official launch release</span>
            </button>

            <button
              type="button"
              onclick="window.NewSubmissionPageView.applySnippet('volterra_corrected_ad')"
              class="btn-secondary text-[11px] py-1.5 px-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white text-left flex flex-col items-start"
            >
              <strong class="text-emerald-400 font-semibold">4. Remediated Ad Copy</strong>
              <span class="text-[10px] text-slate-400">All claims verified clean</span>
            </button>
          </div>
        </div>

        <!-- Submission Form -->
        <div class="card-standard p-6 bg-white">
          <form id="new-content-form" onsubmit="window.NewSubmissionPageView.handleSubmit(event)" class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="sub-title" class="block text-xs font-semibold text-slate-700">Content Asset Title *</label>
                <input
                  id="sub-title"
                  type="text"
                  required
                  placeholder="e.g. Q4 Volterra Commercial Billboard Ad"
                  class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label for="sub-channel" class="block text-xs font-semibold text-slate-700">Publication Channel</label>
                <select
                  id="sub-channel"
                  class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="Print & Billboard Ad">Print & Billboard Ad</option>
                  <option value="Social Media">Social Media</option>
                  <option value="Press Release">Press Release</option>
                  <option value="Website & Landing Page">Website & Landing Page</option>
                  <option value="Product Whitepaper">Product Whitepaper</option>
                  <option value="Email Newsletter">Email Newsletter</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label for="sub-campaign" class="block text-xs font-semibold text-slate-700">Assign to Campaign (Optional)</label>
                <select
                  id="sub-campaign"
                  class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs text-xs bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="none">-- Standalone Asset --</option>
                  ${this.campaigns.map(c => `
                    <option value="${c.id}">${c.name} (${c.code})</option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label for="sub-file" class="block text-xs font-semibold text-slate-700">Attach Document or Graphic (Optional)</label>
                <input
                  id="sub-file"
                  type="file"
                  accept=".txt,.md,.pdf,.png,.jpg,.jpeg"
                  class="mt-1 block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
              </div>
            </div>

            <div>
              <label for="sub-body" class="block text-xs font-semibold text-slate-700">Asset Text / Copy *</label>
              <textarea
                id="sub-body"
                rows="8"
                required
                placeholder="Paste the marketing copy, headline, body text, and specifications here for automated claim extraction..."
                class="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs text-xs font-mono focus:ring-1 focus:ring-slate-900 focus:outline-none"
              ></textarea>
            </div>

            <div class="flex items-center space-x-2">
              <input id="sub-autoscan" type="checkbox" checked class="rounded border-slate-300 text-slate-900 focus:ring-slate-900" />
              <label for="sub-autoscan" class="text-xs text-slate-700 font-medium">
                Automatically run Claim Verification & Risk Intelligence scan immediately upon submission
              </label>
            </div>

            <div class="pt-4 border-t border-slate-200 flex justify-end space-x-3">
              <a href="#/submissions" class="btn-secondary text-xs">Cancel</a>
              <button id="sub-submit-btn" type="submit" class="btn-primary text-xs">
                Submit Content for Verification
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  applySnippet(key) {
    const s = this.snippets[key];
    if (!s) return;

    const titleEl = document.getElementById('sub-title');
    const channelEl = document.getElementById('sub-channel');
    const bodyEl = document.getElementById('sub-body');
    const campaignEl = document.getElementById('sub-campaign');

    if (titleEl) titleEl.value = s.title;
    if (channelEl) channelEl.value = s.channel || 'Print & Billboard Ad';
    if (bodyEl) bodyEl.value = s.body;

    if (campaignEl && this.campaigns.length > 0) {
      const volterraCamp = this.campaigns.find(c => c.name.toLowerCase().includes('volterra') || c.code.toLowerCase().includes('volt'));
      if (volterraCamp) {
        campaignEl.value = volterraCamp.id;
      }
    }

    window.toast.info(`Loaded demo template: "${s.title}"`);
  },

  async handleSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('sub-title').value.trim();
    const channel = document.getElementById('sub-channel').value;
    const campaignId = document.getElementById('sub-campaign').value;
    const body = document.getElementById('sub-body').value.trim();
    const fileInput = document.getElementById('sub-file');
    const autoScan = document.getElementById('sub-autoscan').checked;
    const btn = document.getElementById('sub-submit-btn');

    const formData = new FormData();
    formData.append('title', title);
    formData.append('channel', channel);
    formData.append('contentBody', body);
    formData.append('autoScan', autoScan ? 'true' : 'false');
    if (campaignId !== 'none') {
      formData.append('campaignId', campaignId);
    }
    if (fileInput.files && fileInput.files[0]) {
      formData.append('file', fileInput.files[0]);
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Submitting & running AI scan...';
      const res = await window.api.submitContent(formData);
      window.toast.success('Content submitted and analyzed.');
      const subId = res.submission ? res.submission.id : '';
      window.location.hash = `#/claim-verification?contentId=${subId}`;
    } catch (err) {
      window.toast.error('Submission failed: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Submit Content for Verification';
    }
  }
};
