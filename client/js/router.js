/**
 * Inkloom Guardian - Lightweight Client-Side Router (Vanilla JS)
 */
class Router {
  constructor() {
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  init() {
    if (!window.location.hash) {
      window.location.hash = window.auth.isAuthenticated() ? '#/dashboard' : '#/';
    } else {
      this.handleRoute();
    }
  }

  getRoute() {
    const raw = window.location.hash.slice(1) || '/';
    return raw.split('?')[0];
  }

  async handleRoute() {
    const route = this.getRoute();
    const appShell = document.getElementById('app-shell');
    const publicShell = document.getElementById('public-shell');
    const contentEl = document.getElementById('app-content');
    const publicContentEl = document.getElementById('public-content');

    const publicRoutes = ['/', '/login', '/register'];
    const isPublic = publicRoutes.includes(route);

    // Session check for protected routes
    if (!isPublic && !window.auth.isAuthenticated()) {
      window.location.hash = '#/login';
      return;
    }

    // Toggle app shell layout vs public shell layout
    if (isPublic) {
      if (appShell) appShell.style.display = 'none';
      if (publicShell) {
        publicShell.style.display = 'block';
        if (route === '/') {
          window.LandingPageView.render(publicContentEl);
        } else if (route === '/login') {
          window.LoginPageView.render(publicContentEl);
        } else if (route === '/register') {
          window.RegisterPageView.render(publicContentEl);
        }
      }
      return;
    }

    // Protected Route
    if (publicShell) publicShell.style.display = 'none';
    if (appShell) appShell.style.display = 'flex';

    // Update active nav links in sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
      const targetHash = link.getAttribute('href');
      if (targetHash === `#${route}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Update tour position if relevant
    if (window.tour && window.tour.render) {
      window.tour.render();
    }

    // Scroll to top
    window.scrollTo(0, 0);

    // Route dispatch
    switch (route) {
      case '/dashboard':
        await window.DashboardPageView.render(contentEl);
        break;
      case '/submissions':
        await window.SubmissionsPageView.render(contentEl);
        break;
      case '/submissions/new':
        await window.NewSubmissionPageView.render(contentEl);
        break;
      case '/claim-verification':
        await window.ClaimVerificationPageView.render(contentEl);
        break;
      case '/evidence-sources':
        await window.EvidencePageView.render(contentEl);
        break;
      case '/claims':
        await window.ClaimsPageView.render(contentEl);
        break;
      case '/guidelines':
        await window.GuidelinesPageView.render(contentEl);
        break;
      case '/policy-learning':
        await window.PolicyLearningPageView.render(contentEl);
        break;
      case '/campaigns':
        await window.CampaignsPageView.render(contentEl);
        break;
      case '/risk-reports':
      case '/risk-analysis':
        await window.RiskPageView.render(contentEl);
        break;
      case '/reviews':
      case '/review-approval':
        await window.ReviewsPageView.render(contentEl);
        break;
      case '/audit':
        await window.AuditPageView.render(contentEl);
        break;
      case '/settings':
        await window.SettingsPageView.render(contentEl);
        break;
      case '/privacy':
        window.LegalPageView.renderPrivacy(contentEl);
        break;
      case '/terms':
        window.LegalPageView.renderTerms(contentEl);
        break;
      default:
        window.location.hash = '#/dashboard';
        break;
    }
  }
}

window.router = new Router();
