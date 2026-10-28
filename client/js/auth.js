/**
 * Inkloom Guardian - Authentication & Session Manager (Vanilla JavaScript)
 */
class AuthManager {
  constructor() {
    this.user = null;
    this.listeners = [];
    this.initSession();
  }

  initSession() {
    const cachedUser = localStorage.getItem('inkloom_user');
    if (cachedUser) {
      try {
        this.user = JSON.parse(cachedUser);
      } catch (e) {
        this.user = null;
      }
    }
  }

  getUser() {
    return this.user;
  }

  getToken() {
    return window.api.getToken();
  }

  isAuthenticated() {
    return !!(this.getToken() && this.user);
  }

  setUser(user, token) {
    this.user = user;
    if (user) {
      localStorage.setItem('inkloom_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('inkloom_user');
    }
    if (token) {
      window.api.setToken(token);
    }
    this.notify();
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.listeners.forEach(fn => fn(this.user));
    this.updateUI();
  }

  async checkSession() {
    const token = this.getToken();
    if (!token) {
      this.user = null;
      localStorage.removeItem('inkloom_user');
      this.notify();
      return null;
    }

    try {
      const res = await window.api.getMe();
      this.setUser(res.user);
      return res.user;
    } catch (err) {
      console.warn('Session check warning:', err.message);
      const msg = (err.message || '').toLowerCase();
      // Only clear session token if authentication is explicitly rejected (401 or expired session)
      if (msg.includes('401') || msg.includes('expired') || msg.includes('authentication required') || msg.includes('invalid or expired')) {
        this.logout();
      }
      return null;
    }
  }

  async login(email, password) {
    const res = await window.api.login(email, password);
    this.setUser(res.user, res.token);
    return res;
  }

  async demoLogin(role = 'compliance_officer') {
    const res = await window.api.demoLogin(role);
    this.setUser(res.user, res.token);
    return res;
  }

  async switchDemoRole(role) {
    const res = await window.api.switchDemoUser(role);
    this.setUser(res.user, res.token);
    return res;
  }

  async register(data) {
    const res = await window.api.register(data);
    this.setUser(res.user, res.token);
    return res;
  }

  logout() {
    this.user = null;
    localStorage.removeItem('inkloom_user');
    window.api.setToken(null);
    this.notify();
  }

  updateUI() {
    const user = this.user;
    const isAuthed = !!user;

    const userEmailEl = document.getElementById('header-user-email');
    const userNameEl = document.getElementById('header-user-name');
    const userRoleEl = document.getElementById('header-user-role');
    const demoBadgeEl = document.getElementById('header-demo-badge');

    if (userEmailEl) userEmailEl.textContent = user ? user.email : '';
    if (userNameEl) userNameEl.textContent = user ? user.full_name : '';
    if (userRoleEl) {
      const roleName = user && user.role ? user.role.replace(/_/g, ' ') : 'User';
      userRoleEl.textContent = roleName;
    }

    if (demoBadgeEl) {
      const isDemo = user && (user.email.includes('@volterra.demo') || user.org_slug === 'volterra-demo');
      demoBadgeEl.style.display = isDemo ? 'inline-flex' : 'none';
    }
  }
}

window.auth = new AuthManager();
