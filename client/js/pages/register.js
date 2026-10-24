/**
 * Inkloom Guardian - Register Page View (Vanilla JS)
 */
window.RegisterPageView = {
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
            Create Governance Workspace
          </h2>
          <p class="mt-1 text-center text-xs text-slate-500">
            Start verifying claims and managing brand compliance
          </p>
        </div>

        <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div class="card-standard py-8 px-6 sm:px-10">
            <form id="register-form" onsubmit="window.RegisterPageView.handleSubmit(event)" class="space-y-4">
              <div>
                <label for="reg-org" class="block text-xs font-medium text-slate-700">Organization Name</label>
                <div class="mt-1">
                  <input
                    id="reg-org"
                    type="text"
                    required
                    placeholder="e.g. Acme Corporation"
                    class="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label for="reg-name" class="block text-xs font-medium text-slate-700">Full Name</label>
                <div class="mt-1">
                  <input
                    id="reg-name"
                    type="text"
                    required
                    placeholder="e.g. Jane Doe"
                    class="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label for="reg-email" class="block text-xs font-medium text-slate-700">Work Email</label>
                <div class="mt-1">
                  <input
                    id="reg-email"
                    type="email"
                    required
                    placeholder="name@company.com"
                    class="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label for="reg-password" class="block text-xs font-medium text-slate-700">Password</label>
                <div class="mt-1">
                  <input
                    id="reg-password"
                    type="password"
                    required
                    placeholder="Minimum 8 characters"
                    class="appearance-none block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label for="reg-role" class="block text-xs font-medium text-slate-700">Initial Role</label>
                <div class="mt-1">
                  <select
                    id="reg-role"
                    class="block w-full px-3 py-2 border border-slate-300 rounded-md shadow-xs focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 text-xs bg-white"
                  >
                    <option value="compliance_officer">Compliance Officer</option>
                    <option value="brand_manager">Brand Manager</option>
                    <option value="content_creator">Content Creator</option>
                    <option value="admin">Platform Administrator</option>
                  </select>
                </div>
              </div>

              <div>
                <button id="register-submit-btn" type="submit" class="w-full btn-primary py-2 text-xs">
                  Create Workspace
                </button>
              </div>
            </form>

            <div class="mt-6 border-t border-slate-200 pt-4 text-center">
              <span class="text-xs text-slate-500">Already registered?</span>
              <a href="#/login" class="ml-1 text-xs font-semibold text-slate-900 hover:underline">Sign in</a>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async handleSubmit(e) {
    e.preventDefault();
    const orgName = document.getElementById('reg-org').value.trim();
    const fullName = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const role = document.getElementById('reg-role').value;
    const btn = document.getElementById('register-submit-btn');

    try {
      btn.disabled = true;
      btn.textContent = 'Provisioning workspace...';
      await window.auth.register({ orgName, fullName, email, password, role });
      window.toast.success('Workspace created successfully.');
      window.location.hash = '#/dashboard';
    } catch (err) {
      window.toast.error(err.message || 'Registration failed.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Workspace';
    }
  }
};
