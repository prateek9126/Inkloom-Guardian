/**
 * Inkloom Guardian - Main Application Bootstrap (Vanilla JS)
 */
document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Inkloom Guardian] Initializing static HTML/CSS/JS frontend...');

  // Setup Role Switcher Dropdown in Header
  const demoMenuBtn = document.getElementById('header-role-btn');
  const demoDropdown = document.getElementById('header-role-dropdown');
  if (demoMenuBtn && demoDropdown) {
    demoMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      demoDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      demoDropdown.classList.add('hidden');
    });
  }

  // Bind Role Switch Buttons inside Dropdown
  document.querySelectorAll('[data-role-switch]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const role = btn.getAttribute('data-role-switch');
      const name = btn.getAttribute('data-role-name') || role;
      try {
        window.toast.info(`Switching session to: ${name}...`);
        await window.auth.switchDemoRole(role);
        window.toast.success(`Switched active session to: ${name}`);
        if (demoDropdown) demoDropdown.classList.add('hidden');
        window.location.hash = '#/dashboard';
      } catch (err) {
        window.toast.error('Failed to switch role: ' + err.message);
      }
    });
  });

  // Setup Sign Out Button
  const logoutBtn = document.getElementById('header-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      window.auth.logout();
      window.toast.info('Logged out successfully.');
      window.location.hash = '#/login';
    });
  }

  // Setup Judge Tour Header Button
  const tourHeaderBtn = document.getElementById('header-judge-tour-btn');
  if (tourHeaderBtn) {
    tourHeaderBtn.addEventListener('click', () => {
      window.tour.openTour();
      window.location.hash = '#/dashboard';
    });
  }

  // Verify Session and start router
  try {
    await window.auth.checkSession();
  } catch (e) {
    console.warn('Initial session check error:', e);
  }

  window.router.init();
});
