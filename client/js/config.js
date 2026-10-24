/**
 * Inkloom Guardian - Runtime Environment Configuration
 * Static HTML / Vanilla JS Frontend (Zero build process required)
 */
(function () {
  const isLocal =
    window.location.protocol === 'file:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  window.INKLOOM_CONFIG = {
    APP_NAME: 'Inkloom Guardian',
    VERSION: '2.4',
    ENV: isLocal ? 'development' : 'production',
    // In local development, port 5000 is the Express backend (use relative '/api'),
    // while other ports (e.g., live-server, 5173, 5500) connect to http://localhost:5000/api.
    // In production, connect directly to the deployed backend server.
    API_BASE_URL: isLocal
      ? (window.location.port === '5000' ? '/api' : 'http://localhost:5000/api')
      : 'https://inkloom-guardian-server.vercel.app/api',
  };

  // Expose API_BASE_URL on window for immediate access
  if (!window.API_BASE_URL) {
    window.API_BASE_URL = window.INKLOOM_CONFIG.API_BASE_URL;
  }
})();
