/**
 * Inkloom Guardian - Evidence Sources Library View (Vanilla JS)
 */
window.EvidencePageView = {
  sources: [],

  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
          <span>Loading certified evidence sources...</span>
        </div>
      </div>
    `;

    try {
      const res = await window.api.getEvidenceSources();
      this.sources = res.sources || [];
      this.renderList(container);
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-6 text-center text-xs text-red-600">
          Failed to load evidence sources: ${err.message}
        </div>
      `;
    }
  },

  renderList(container) {
    container.innerHTML = `
      <div class="space-y-6 font-sans">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <div class="flex items-center space-x-2">
              <h1 class="text-2xl font-bold tracking-tight text-slate-900">Certified Evidence Sources</h1>
              <span class="badge badge-demo">VOLTERRA DEMO</span>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Primary approved benchmark studies, product specification sheets, and verified pricing documents.
            </p>
          </div>

          <button onclick="window.EvidencePageView.openUploadModal()" class="btn-primary text-xs">
            + Upload Evidence Document
          </button>
        </div>

        <!-- Evidence Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          ${this.sources.map(source => `
            <div class="card-standard p-5 space-y-3 flex flex-col justify-between">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="badge badge-unverified font-mono uppercase text-[10px]">${source.document_type || 'benchmark_study'}</span>
                  <span class="badge badge-supported">v${source.version || '1.0'}</span>
                </div>
                <h3 class="text-sm font-bold text-slate-900">${source.title}</h3>
                <p class="text-xs text-slate-500 font-mono">
                  Effective: ${source.effective_date || '2026-01-01'} ${source.expiration_date ? '• Expires: ' + source.expiration_date : ''}
                </p>
              </div>

              <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span class="text-xs text-slate-600 font-medium">
                  Passages: <strong class="text-slate-900">${source.passages_count || 3}</strong>
                </span>
                <div class="space-x-1.5">
                  <button
                    onclick="window.EvidencePageView.viewPassages('${source.id}')"
                    class="btn-secondary text-[11px] py-1 px-2.5"
                  >
                    Inspect Passages
                  </button>
                  <button
                    onclick="window.EvidencePageView.deleteSource('${source.id}')"
                    class="btn-subtle text-[11px] text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  async viewPassages(sourceId) {
    try {
      window.toast.info('Loading passages...');
      const res = await window.api.getEvidenceSource(sourceId);
      const source = res.source;
      const passages = res.passages || [];

      const modal = document.getElementById('modal-container');
      modal.innerHTML = `
        <div class="modal-backdrop">
          <div class="modal-dialog p-6 space-y-4 max-w-3xl">
            <div class="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 class="text-sm font-bold text-slate-900">${source.title}</h3>
                <span class="text-xs text-slate-500 font-mono">Certified Document Passages (${passages.length})</span>
              </div>
              <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div class="space-y-3 max-h-96 overflow-y-auto pr-1">
              ${passages.map((p, idx) => `
                <div class="p-3.5 bg-slate-50 rounded border border-slate-200 text-xs space-y-1.5">
                  <div class="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span class="text-emerald-800 font-mono">Passage #${idx + 1} • Page ${p.page_number || 1}</span>
                    <span class="font-mono text-slate-400 text-[10px]">${p.section_header || 'General'}</span>
                  </div>
                  <p class="text-slate-800 font-serif leading-relaxed italic">
                    "${p.passage_text}"
                  </p>
                </div>
              `).join('')}
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-end">
              <button onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      window.toast.error('Failed to load passages: ' + err.message);
    }
  },

  openUploadModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog p-6 space-y-4">
          <div class="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 class="text-sm font-bold text-slate-900">Upload Certified Evidence Document</h3>
            <button onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-slate-600">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <form onsubmit="window.EvidencePageView.submitUpload(event)" class="space-y-3 text-xs">
            <div>
              <label class="block font-medium text-slate-700">Document Title *</label>
              <input id="ev-title" type="text" required placeholder="e.g. UL 9540A Battery Certification Test" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block font-medium text-slate-700">Document Type</label>
                <select id="ev-type" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded bg-white text-xs">
                  <option value="benchmark_study">Benchmark Study</option>
                  <option value="spec_sheet">Product Spec Sheet</option>
                  <option value="audit_report">Audit Report</option>
                  <option value="price_sheet">Enterprise Price Sheet</option>
                </select>
              </div>

              <div>
                <label class="block font-medium text-slate-700">Version</label>
                <input id="ev-version" type="text" value="1.0" class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs" />
              </div>
            </div>

            <div>
              <label class="block font-medium text-slate-700">Document Content / Text *</label>
              <textarea id="ev-content" rows="4" required placeholder="Paste verified report passages, test metrics, and verbatim specifications..." class="mt-1 block w-full px-3 py-1.5 border border-slate-300 rounded text-xs font-mono"></textarea>
            </div>

            <div class="pt-3 border-t border-slate-200 flex justify-end space-x-2">
              <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="btn-secondary text-xs">Cancel</button>
              <button type="submit" class="btn-primary text-xs">Save & Chunk Passages</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  async submitUpload(e) {
    e.preventDefault();
    const title = document.getElementById('ev-title').value.trim();
    const documentType = document.getElementById('ev-type').value;
    const version = document.getElementById('ev-version').value.trim();
    const content = document.getElementById('ev-content').value.trim();

    const formData = new FormData();
    formData.append('title', title);
    formData.append('documentType', documentType);
    formData.append('version', version);
    formData.append('content', content);

    try {
      await window.api.uploadEvidenceSource(formData);
      window.toast.success('Evidence source uploaded and chunked into passages.');
      document.getElementById('modal-container').innerHTML = '';
      await this.render(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Upload failed: ' + err.message);
    }
  },

  async deleteSource(id) {
    if (!confirm('Are you sure you want to delete this evidence source?')) return;
    try {
      await window.api.deleteEvidenceSource(id);
      window.toast.success('Evidence source deleted.');
      this.sources = this.sources.filter(s => s.id !== id);
      this.renderList(document.getElementById('app-content'));
    } catch (err) {
      window.toast.error('Failed to delete evidence source: ' + err.message);
    }
  }
};
