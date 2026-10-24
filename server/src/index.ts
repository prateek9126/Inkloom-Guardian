import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { db } from './db/db.js';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';

import authRoutes from './routes/authRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import guidelinesRoutes from './routes/guidelinesRoutes.js';
import claimsRoutes from './routes/claimsRoutes.js';
import campaignRoutes from './routes/campaignRoutes.js';
import contentRoutes from './routes/contentRoutes.js';
import riskRoutes from './routes/riskRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import evidenceRoutes from './routes/evidenceRoutes.js';
import claimVerificationRoutes from './routes/claimVerificationRoutes.js';
import campaignConsistencyRoutes from './routes/campaignConsistencyRoutes.js';
import policyLearningRoutes from './routes/policyLearningRoutes.js';
import demoRoutes from './routes/demoRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Essential HTTP Security Headers configured directly in Express (Zero 3rd-party dependencies; replaces helmet)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' https://*.vercel.app https://inkloom-guardian-server.vercel.app http://localhost:5000 http://127.0.0.1:5000"
  );
  next();
});

// Explicit Allowed Origins (Defaulting to the production frontend and local dev environments)
const explicitAllowedOrigins = [
  'https://inkloom-guardian.vercel.app',
  'https://inkloom-guardian-client.vercel.app',
  'https://inkloom-guardian-server.vercel.app',
  'http://localhost:5173',
  'http://localhost:5000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const envOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/+$/, ''))
  : [];

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true; // allow non-browser clients (curl, mobile, server-to-server)
  const clean = origin.trim().replace(/\/+$/, '');
  if (explicitAllowedOrigins.includes(clean) || envOrigins.includes(clean) || envOrigins.includes('*')) {
    return true;
  }
  // Allow all Vercel deployment domains (*.vercel.app) and local development
  try {
    const url = new URL(clean);
    if (url.hostname.endsWith('.vercel.app') || url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

// 1. Direct Pre-Flight & CORS Middleware (ensures OPTIONS returns 204 immediately before any DB/auth logic)
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  // Preflight requests return immediately with 204 No Content
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
});

// 2. Standard CORS middleware for Express route handlers
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Disposition', 'Content-Length', 'X-Total-Count'],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// NOTE: express-rate-limit package has been completely removed as requested.
// Public API endpoints are served without external rate-limiting middleware.

// Request Parsing with strict payload size limits
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Lazy / eager service initialization for serverless and standalone environments
let initPromise: Promise<void> | null = null;
export async function initializeServices(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      console.log('[Inkloom Guardian] Initializing backend services...');
      await db.ensureReady();
      await runMigrations();
      // Auto-seed demo data if DB is empty
      await seedDatabase(false);
    })();
  }
  return initPromise;
}

// Ensure database and services are initialized before processing any requests (essential for Vercel Serverless)
app.use(async (_req: Request, _res: Response, next: NextFunction) => {
  try {
    await initializeServices();
    next();
  } catch (err) {
    next(err);
  }
});

// Vercel Serverless Path Normalization Middleware
// When Vercel rewrites requests to serverless functions, restore the original client path if rewritten
app.use((req: Request, _res: Response, next: NextFunction) => {
  const matchedPath = (req.headers['x-matched-path'] || req.headers['x-forwarded-uri'] || req.headers['x-original-uri']) as string;
  if (matchedPath && (req.url === '/src/index.js' || req.url === '/src/index' || req.url === '/api' || req.url.startsWith('/src/index'))) {
    req.url = matchedPath;
  }
  next();
});

// Serve uploaded attachments safely with security headers
app.use(
  '/uploads',
  (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    next();
  },
  express.static(config.uploadDir)
);

// API Health Check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    platform: 'Inkloom Guardian API',
    engine: db.getEngineType(),
    features: [
      'brand_governance',
      'evidence_verification_engine',
      'evidence_graph',
      'cross_campaign_consistency',
      'explainable_risk_scoring',
      'human_approval_workflow',
      'policy_learning_engine',
    ],
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/guidelines', guidelinesRoutes);
app.use('/api/claims', claimsRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/claims-verification', claimVerificationRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/campaigns-consistency', campaignConsistencyRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/policy-learning', policyLearningRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/demo', demoRoutes);

// Dedicated 404 Handler for /api/* to ensure API requests never fall through to static index.html
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.path}`,
    method: req.method,
    path: req.path,
    status: 404,
  });
});

// Serve Static Frontend (plain HTML/CSS/JS without build step, with fallback to dist if present)
const possibleClientPaths = [
  path.resolve(__dirname, '../../client'),
  path.resolve(process.cwd(), '../client'),
  path.resolve(process.cwd(), 'client'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
];

for (const clientPath of possibleClientPaths) {
  if (fs.existsSync(path.join(clientPath, 'index.html'))) {
    console.log(`[Inkloom Guardian] Serving static frontend from: ${clientPath}`);
    app.use(express.static(clientPath));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.join(clientPath, 'index.html'));
    });
    break;
  }
}

// Global Error Handler with guaranteed CORS headers on error responses
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error('[Inkloom Guardian Unhandled Error]:', err);
  const status = err.status || 500;

  const origin = req.headers.origin;
  if (origin && isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  const safeMessage =
    config.nodeEnv === 'production' && status === 500
      ? 'An unexpected error occurred. The incident has been logged for security audit.'
      : err.message || 'Internal Server Error';

  res.status(status).json({
    error: safeMessage,
    ...(config.nodeEnv === 'development' ? { stack: err.stack } : {}),
  });
});

// Start Server for standalone / local environments (skipped on Vercel Serverless)
export async function startServer(): Promise<void> {
  try {
    await initializeServices();
    app.listen(config.port, () => {
      console.log(`[Inkloom Guardian API] Server running on http://localhost:${config.port}`);
      console.log(`[Inkloom Guardian API] Database engine: ${db.getEngineType()}`);
      console.log(`[Inkloom Guardian API] LLM Provider configured: ${config.llm.provider}`);
    });
  } catch (err: any) {
    console.error('[Inkloom Guardian Fatal] Failed to bootstrap application:', err);
    process.exit(1);
  }
}

// Automatically start HTTP listener only when run directly as main entrypoint and NOT in Vercel Serverless
const isDirectRun =
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js')) &&
  !process.argv[1].includes('test') &&
  !process.argv[1].includes('verify');

if (!process.env.VERCEL && process.env.NODE_ENV !== 'test' && isDirectRun) {
  startServer();
}

export { app };
export default app;
