/**
 * Inkloom Guardian - Login Page View (Vanilla JS)
 */
window.LoginPageView = {
  render(container) {
    container.innerHTML = `
      <div class="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div class="sm:mx-auto sm:w-full sm:max-w-md">
          <div class="flex justify-center">
            <div class="w-10 h-10 rounded-md bg-slate-900 flex items-center justify-center text-white shadow-sm">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
          </div>
          <h2 class="mt-4 text-center text-2xl font-bold tracking-tight text-slate-900">
            Sign in to Inkloom Guardian
          </h2>
          <p class="mt-1 text-center text-xs text-slate-500">
            Brand Governance & Risk Intelligence Platform
          </p>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <!-- 1-Click Demo Personas -->
          <div class="mb-6 card-standard p-4 bg-slate-900 text-white border-slate-800">
            <div class="flex items-center justify-between pb-2 border-b border-slate-800">
              <div class="flex items-center space-x-1.5">
                <span class="badge badge-demo">VOLTERRA DEMO</span>
                <span class="text-xs font-semibold text-slate-200">1-Click Judge Sign In</span>
              </div>
            </div>
            <p class="text-[11px] text-slate-400 mt-2">
              Select a preconfigured enterprise role to explore the VOLTERRA EV demonstration scenario:
            </p>
            <div class="grid grid-cols-2 gap-2 mt-3">
              <button
                onclick="window.LoginPageView.handleDemoLogin('compliance_officer', 'Dr. Elena Vance (Lead Regulatory Compliance)')"
                class="btn-secondary text-[11px] py-1.5 px-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white justify-start"
              >
                ⚖️ Compliance Officer
              </button>
              <button
                onclick="window.LoginPageView.handleDemoLogin('brand_manager', 'Marcus Sterling (Brand Director)')"
                class="btn-secondary text-[11px] py-1.5 px-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white justify-start"
              >
                🛡️ Brand Director
              </button>
              <button
                onclick="window.LoginPageView.handleDemoLogin('content_creator', 'Sarah Chen (Content Creator)')"
                class="btn-secondary text-[11px] py-1.5 px-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white justify-start"
              >
                ✍️ Content Creator
              </button>
              <button
                onclick="window.LoginPageView.handleDemoLogin('admin', 'System Administrator')"
                class="btn-secondary text-[11px] py-1.5 px-2 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white justify-start"
              >
                ⚙️ Platform Admin
              </button>
            </div>
          </div>

          <!-- Email / Password Form -->
          <div class="card-standard py-8 px-6 sm:px-10">
            <form id="login-form" onsubmit="window.LoginPageView.handleSubmit(event)" class="space-y-4">
              <div>
                <label for="login-email" class="block text-xs font-medium text-slate-700">Email address</label>
                <div class="mt-1">
                  <input
                    id="login-email"
                    type="email"
                    required
                    value="compliance@volterra.demo"
                    class="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label for="login-password" class="block text-xs font-medium text-slate-700">Password</label>
                <div class="mt-1">
                  <input
                    id="login-password"
                    type="password"
                    required
                    value="Compliance2026!"
                    class="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <button id="login-submit-btn" type="submit" class="w-full btn-primary py-2 text-xs">
                  Sign in
                </button>
              </div>
            </form>

            <div class="mt-6 border-t border-slate-200 pt-4 text-center">
              <span class="text-xs text-slate-500">Need a new organization?</span>
              <a href="#/register" class="ml-1 text-xs font-semibold text-slate-900 hover:underline">Register workspace</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async handleSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-submit-btn');

    if (!email || !password) {
      window.toast.error('Please enter both email and password.');
      return;
    }

    try {
      btn.disabled = true;
      btn.textContent = 'Authenticating...';
      await window.auth.login(email, password);
      window.toast.success('Authenticated successfully.');
      window.location.hash = '#/dashboard';
    } catch (err) {
      window.toast.error(err.message || 'Login failed.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  },

  async handleDemoLogin(role, roleName) {
    try {
      window.toast.info(`Authenticating as ${roleName}...`);
      await window.auth.demoLogin(role);
      window.toast.success(`Authenticated as ${roleName}`);
      window.location.hash = '#/dashboard';
    } catch (err) {
      window.toast.error('Demo authentication failed: ' + err.message);
    }
  }
};
