import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
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

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Strict CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:5173', 'http://localhost:5000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server) or matching allowed list
      if (!origin || allowedOrigins.includes(origin) || config.nodeEnv === 'development') {
        callback(null, true);
      } else {
        callback(new Error('CORS policy: Not allowed by Access-Control-Allow-Origin'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Rate Limiting: General API Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded: Too many requests. Please try again later.' },
});
app.use('/api/', apiLimiter);

// Rate Limiting: Sensitive Auth Limiter
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // limit to 30 authentication attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Request Parsing with strict payload size limits
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

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

// Serve Frontend Client build if available
const possibleClientDistPaths = [
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
];

for (const distPath of possibleClientDistPaths) {
  if (fs.existsSync(distPath)) {
    console.log(`[Inkloom Guardian] Serving static frontend from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
    break;
  }
}

// Global Error Handler with production sanitization
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Inkloom Guardian Unhandled Error]:', err);
  const status = err.status || 500;
  const safeMessage =
    config.nodeEnv === 'production' && status === 500
      ? 'An unexpected error occurred. The incident has been logged for security audit.'
      : err.message || 'Internal Server Error';

  res.status(status).json({
    error: safeMessage,
    ...(config.nodeEnv === 'development' ? { stack: err.stack } : {}),
  });
});

// Start Server
async function startServer() {
  try {
    console.log('[Inkloom Guardian] Initializing backend services...');
    await db.ensureReady();
    await runMigrations();
    // Auto-seed demo data if DB is empty
    await seedDatabase(false);

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

startServer();
