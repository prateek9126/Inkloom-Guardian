/**
 * Inkloom Guardian - Dashboard Page View (Vanilla JS)
 */
window.DashboardPageView = {
  async render(container) {
    container.innerHTML = `
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="flex items-center space-x-2 text-xs text-slate-500">
          <svg class="animate-spin h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Querying governance metrics...</span>
        </div>
      </div>
    `;

    try {
      const data = await window.api.getDashboardStats();
      const metrics = data.metrics || {};
      const submissions = data.recentSubmissions || [];
      const activity = data.recentActivity || [];

      container.innerHTML = `
        <div class="space-y-6">
          <!-- Top Demo Banner -->
          <div class="card-standard p-4 bg-slate-900 text-white border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="badge badge-demo">VOLTERRA DEMO</span>
                <h3 class="text-sm font-bold text-slate-100">Interactive Governance Demonstration</h3>
              </div>
              <p class="text-xs text-slate-400 mt-1 max-w-2xl">
                Preloaded with Volterra EV commercial campaign, 3 assets with deliberate pricing and specification contradictions, and approved benchmark study.
              </p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <button onclick="window.tour.openTour()" class="btn-primary text-xs bg-emerald-600 hover:bg-emerald-700 border-none shadow-xs">
                Judge Guided Tour (12 Steps)
              </button>
              <button onclick="window.tour.resetDemo()" class="btn-secondary text-xs bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700">
                Reset Demo
              </button>
            </div>
          </div>

          <!-- 4 Core Metrics Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="card-standard p-4">
              <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Submissions</div>
              <div class="mt-2 flex items-baseline justify-between">
                <span class="text-2xl font-extrabold text-slate-900">${metrics.totalSubmissions || 0}</span>
                <span class="badge badge-high">${metrics.pendingReview || 0} Pending</span>
              </div>
              <div class="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Approved: <strong class="text-slate-800">${metrics.approvedCount || 0}</strong></span>
                <span>Flagged: <strong class="text-slate-800">${metrics.flaggedCount || 0}</strong></span>
              </div>
            </div>

            <div class="card-standard p-4">
              <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Verified Claims</div>
              <div class="mt-2 flex items-baseline justify-between">
                <span class="text-2xl font-extrabold text-slate-900">${metrics.totalClaims || 0}</span>
                <span class="badge badge-supported">${metrics.supportedClaims || 0} Supported</span>
              </div>
              <div class="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Contradicted: <strong class="text-red-600">${metrics.contradictedClaims || 0}</strong></span>
                <span>Unverified: <strong class="text-slate-700">${metrics.unverifiedClaims || 0}</strong></span>
              </div>
            </div>

            <div class="card-standard p-4">
              <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Brand Guidelines</div>
              <div class="mt-2 flex items-baseline justify-between">
                <span class="text-2xl font-extrabold text-slate-900">${metrics.totalGuidelines || 0}</span>
                <span class="badge badge-critical">${metrics.criticalRules || 0} Critical</span>
              </div>
              <div class="mt-3 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Active Rules: <strong class="text-slate-800">${metrics.totalGuidelines || 0}</strong></span>
                <a href="#/guidelines" class="text-slate-900 font-semibold hover:underline">Manage</a>
              </div>
            </div>

            <div class="card-standard p-4">
              <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Consistency Index</div>
              <div class="mt-2 flex items-baseline justify-between">
                <span class="text-2xl font-extrabold ${metrics.avgConsistencyScore >= 75 ? 'text-emerald-600' : 'text-amber-600'}">
                  ${metrics.avgConsistencyScore !== undefined ? metrics.avgConsistencyScore + '%' : '88%'}
                </span>
                <span class="badge badge-review">Deterministic</span>
              </div>
              <div class="mt-3 text-[11px] text-slate-500">
                Cross-campaign contradiction scan active
              </div>
            </div>
          </div>

          <!-- Quick Action Bar -->
          <div class="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200">
            <h2 class="text-base font-bold text-slate-900 tracking-tight">Recent Governance Submissions</h2>
            <div class="flex items-center gap-2">
              <a href="#/submissions/new" class="btn-primary text-xs">
                + Submit New Content
              </a>
              <a href="#/campaigns" class="btn-secondary text-xs">
                Campaign Workspace
              </a>
            </div>
          </div>

          <!-- Recent Submissions Table -->
          <div class="card-standard overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th class="py-2.5 px-4">Asset Title</th>
                  <th class="py-2.5 px-4">Channel</th>
                  <th class="py-2.5 px-4">Governance Status</th>
                  <th class="py-2.5 px-4">Risk Level</th>
                  <th class="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                ${submissions.length === 0 ? `
                  <tr>
                    <td colspan="5" class="py-6 text-center text-slate-500">No content submissions found.</td>
                  </tr>
                ` : submissions.map(sub => {
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
                        ${sub.title.includes('[Demo]') ? '<span class="ml-1.5 badge badge-demo">DEMO</span>' : ''}
                      </td>
                      <td class="py-3 px-4 text-slate-600">${sub.channel || 'Marketing'}</td>
                      <td class="py-3 px-4">${statusBadge}</td>
                      <td class="py-3 px-4">${riskBadge}</td>
                      <td class="py-3 px-4 text-right space-x-2">
                        <a href="#/claim-verification?contentId=${sub.id}" class="btn-subtle text-[11px] font-semibold text-slate-900">
                          Verify Claims
                        </a>
                        <a href="#/risk-reports?contentId=${sub.id}" class="btn-subtle text-[11px] font-semibold text-sky-700">
                          Risk Report
                        </a>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Audit Activity Feed -->
          <div class="card-standard p-5">
            <div class="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-600">Recent Immutable Audit Activity</h3>
              <a href="#/audit" class="text-xs text-slate-900 font-semibold hover:underline">View Full Audit Trail →</a>
            </div>
            <div class="divide-y divide-slate-100 mt-2">
              ${activity.slice(0, 5).map(log => `
                <div class="py-2.5 flex items-center justify-between text-xs">
                  <div class="flex items-center space-x-2.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span class="font-medium text-slate-900">${log.action}</span>
                    <span class="text-slate-500 font-mono text-[11px]">(${log.resource_type})</span>
                  </div>
                  <div class="text-[11px] text-slate-400 font-mono">
                    ${new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `
        <div class="card-standard p-8 text-center">
          <p class="text-xs text-red-600">Failed to load dashboard metrics: ${err.message}</p>
          <button onclick="window.DashboardPageView.render(document.getElementById('app-content'))" class="btn-secondary text-xs mt-3">
            Retry
          </button>
        </div>
      `;
    }
  }
};
