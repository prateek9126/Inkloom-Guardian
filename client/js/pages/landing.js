/**
 * Inkloom Guardian - Landing Page View (Vanilla JS)
 */
window.LandingPageView = {
  render(container) {
    container.innerHTML = `
      <div class="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-200">
        <!-- Top Nav -->
        <nav class="border-b border-slate-200 bg-white sticky top-0 z-40">
          <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-8 h-8 rounded-md bg-slate-900 flex items-center justify-center text-white shadow-xs">
                <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <span class="font-bold text-slate-900 text-base tracking-tight leading-none block">Inkloom Guardian</span>
                <span class="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Brand Governance & Risk Intelligence</span>
              </div>
            </div>

            <div class="flex items-center space-x-4">
              <a href="#/login" class="text-xs font-semibold text-slate-700 hover:text-slate-900">Sign In</a>
              <a href="#/register" class="btn-primary text-xs">Launch Platform</a>
            </div>
          </div>
        </nav>

        <!-- Hero Section -->
        <section class="py-20 px-6 max-w-5xl mx-auto text-center border-b border-slate-100">
          <div class="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold tracking-wide uppercase mb-6 border border-slate-200">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Evidence-Backed Verification & Brand Risk Intelligence</span>
          </div>
          
          <h1 class="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight max-w-4xl mx-auto">
            Automated Brand Governance and Evidence-Backed Claim Verification
          </h1>

          <p class="mt-6 text-base sm:text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Inkloom Guardian extracts factual, numerical, and promotional claims from enterprise communications, verifies each assertion against approved primary evidence documents, detects cross-campaign contradictions, and enforces human-in-the-loop review before publication.
          </p>

          <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a href="#/register" class="btn-primary px-6 py-3 text-sm">
              Open Governance Workspace
            </a>
            <button onclick="window.LandingPageView.launchDemo()" class="btn-secondary px-6 py-3 text-sm flex items-center gap-2">
              <svg class="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Explore VOLTERRA EV Demo</span>
            </button>
          </div>

          <!-- Feature Pills -->
          <div class="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 font-medium">
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
              ✓ Granular Passage Attribution
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
              ✓ Cross-Asset Contradiction Engine
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
              ✓ Explainable Risk Scoring Formula
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded">
              ✓ Immutable Cryptographic Audit Trail
            </span>
          </div>
        </section>

        <!-- Core Capabilities Grid -->
        <section class="py-16 px-6 max-w-6xl mx-auto">
          <div class="text-center max-w-2xl mx-auto mb-12">
            <h2 class="text-2xl font-bold text-slate-900 tracking-tight">Four Pillars of Enterprise Brand Governance</h2>
            <p class="text-xs text-slate-500 mt-2">Rigorous fact-checking without hallucination or fabricated metrics.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div class="card-standard p-5">
              <div class="w-8 h-8 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs mb-3">01</div>
              <h3 class="font-bold text-slate-900 text-sm">Evidence-Backed Verification</h3>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                Extracts facts and claims, maps them to chunked passages in certified primary PDFs and specs with exact page citations.
              </p>
            </div>

            <div class="card-standard p-5">
              <div class="w-8 h-8 rounded bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-xs mb-3">02</div>
              <h3 class="font-bold text-slate-900 text-sm">Cross-Campaign Consistency</h3>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                Compares social, print ads, and press releases across the campaign to catch conflicting prices, expired dates, and mismatched battery specs.
              </p>
            </div>

            <div class="card-standard p-5">
              <div class="w-8 h-8 rounded bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs mb-3">03</div>
              <h3 class="font-bold text-slate-900 text-sm">Explainable Risk Scoring</h3>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                Deterministic formula bounding scores from 0 to 100 with distinct severity weights, confidence multipliers, and deduplicated correlated findings.
              </p>
            </div>

            <div class="card-standard p-5">
              <div class="w-8 h-8 rounded bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs mb-3">04</div>
              <h3 class="font-bold text-slate-900 text-sm">Human Approval Workflow</h3>
              <p class="text-xs text-slate-600 mt-2 leading-relaxed">
                Role-based authorization preventing self-approvals, tracking revision snapshots, and recording justified exceptions for continuous compliance.
              </p>
            </div>
          </div>
        </section>

        <!-- Footer -->
        <footer class="border-t border-slate-200 py-8 px-6 bg-slate-50">
          <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <div>© 2026 Inkloom Guardian. Enterprise Brand Governance Platform.</div>
            <div class="flex items-center space-x-4">
              <a href="#/privacy" class="hover:text-slate-800">Privacy Policy</a>
              <span>•</span>
              <a href="#/terms" class="hover:text-slate-800">Terms of Service</a>
              <span>•</span>
              <span class="text-emerald-700 font-medium">Demo Mode Available</span>
            </div>
          </div>
        </footer>
      </div>
    `;
  },

  async launchDemo() {
    try {
      window.toast.info('Initializing VOLTERRA demonstration workspace...');
      const res = await window.api.seedDemo(false);
      window.auth.setUser(res.auth.user, res.auth.token);
      localStorage.setItem('inkloom_demo_open', 'true');
      localStorage.setItem('inkloom_demo_step', '0');
      window.toast.success('Logged in as Lead Regulatory Compliance.');
      window.location.hash = '#/dashboard';
    } catch (err) {
      window.toast.error('Failed to launch demo: ' + err.message);
    }
  }
};
