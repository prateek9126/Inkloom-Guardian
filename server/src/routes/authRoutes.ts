import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/db.js';
import { config } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { auditService } from '../services/auditService.js';
import { demoService } from '../services/demoService.js';

const router = Router();

/**
 * Register a new organization and admin account
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { orgName, fullName, email, password, role = 'admin' } = req.body;

    if (!orgName || !fullName || !email || !password) {
      res.status(400).json({ error: 'Please provide organization name, full name, email, and password.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    // Check if email already registered
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email address already exists.' });
      return;
    }

    const slug = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 50);

    // Create organization
    const orgRes = await db.query(
      `INSERT INTO organizations (name, slug, plan)
       VALUES ($1, $2, 'Enterprise')
       RETURNING id, name, slug`,
      [orgName.trim(), `${slug}-${Date.now().toString().slice(-4)}`]
    );
    const org = orgRes.rows[0];

    // Create system settings for org
    await db.query(
      `INSERT INTO system_settings (org_id, llm_provider, llm_model, api_key_configured)
       VALUES ($1, 'mock', 'inkloom-deterministic-v2', true)`,
      [org.id]
    );

    // Hash password and insert user
    const passwordHash = await bcrypt.hash(password, 10);
    const userRes = await db.query(
      `INSERT INTO users (org_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, org_id, email, full_name, role, created_at`,
      [org.id, email.toLowerCase().trim(), passwordHash, fullName.trim(), role]
    );
    const user = userRes.rows[0];

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, org_id: user.org_id, email: user.email, role: user.role, full_name: user.full_name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    await auditService.logEvent({
      orgId: org.id,
      userId: user.id,
      action: 'USER_REGISTERED',
      resourceType: 'user',
      resourceId: user.id,
      details: { email: user.email, role: user.role },
      ipAddress: req.ip,
    });

    res.status(201).json({
      token,
      user,
      organization: org,
    });
  } catch (err: any) {
    console.error('[Auth Register Error]:', err);
    res.status(500).json({ error: 'Failed to complete registration: ' + err.message });
  }
});

/**
 * Standard login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Please provide both email and password.' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    let userRes = await db.query(
      `SELECT u.*, o.name as org_name, o.plan as org_plan
       FROM users u
       JOIN organizations o ON u.org_id = o.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [cleanEmail]
    );

    // If user is not found, check if it's a known demo email and ensure workspace is seeded
    if (userRes.rows.length === 0) {
      if (cleanEmail.endsWith('@volterra.demo')) {
        await demoService.seedVolterraDemo(false);
        userRes = await db.query(
          `SELECT u.*, o.name as org_name, o.plan as org_plan
           FROM users u
           JOIN organizations o ON u.org_id = o.id
           WHERE LOWER(u.email) = LOWER($1)`,
          [cleanEmail]
        );
      }
    }

    if (userRes.rows.length === 0) {
      res.status(401).json({ error: 'Invalid email address or credentials.' });
      return;
    }

    const user = userRes.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email address or credentials.' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, org_id: user.org_id, email: user.email, role: user.role, full_name: user.full_name },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    await auditService.logEvent({
      orgId: user.org_id,
      userId: user.id,
      action: 'USER_LOGIN',
      resourceType: 'user',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: req.ip,
    });

    const { password_hash, ...safeUser } = user;
    res.json({
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('[Auth Login Error]:', err);
    res.status(500).json({ error: 'Failed to process login: ' + err.message });
  }
});

/**
 * Demo login helper for seamless testing of different roles
 * Strictly scoped to the isolated VOLTERRA demonstration workspace (is_demo = true)
 */
router.post('/demo-login', async (req: Request, res: Response) => {
  try {
    const { role = 'compliance_officer' } = req.body || {};
    const validRoles = ['compliance_officer', 'brand_manager', 'content_creator', 'admin'];

    if (!validRoles.includes(role)) {
      res.status(400).json({
        error: `Invalid demonstration role "${role}". Must be one of: ${validRoles.join(', ')}`,
      });
      return;
    }

    const auth = await demoService.getDemoUserToken(role);

    await auditService.logEvent({
      orgId: auth.org.id,
      userId: auth.user.id,
      action: 'DEMO_USER_LOGIN',
      resourceType: 'user',
      resourceId: auth.user.id,
      details: { role: auth.user.role, label: 'Demonstration Session' },
      ipAddress: req.ip,
    });

    res.json({
      token: auth.token,
      user: auth.user,
      organization: auth.org,
    });
  } catch (err: any) {
    console.error('[Auth Demo Login Error]:', err);
    res.status(500).json({ error: 'Demo login error: ' + err.message });
  }
});

/**
 * Get current authenticated user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    let userRes = await db.query(
      `SELECT u.id, u.org_id, u.email, u.full_name, u.role, u.created_at,
              o.name as org_name, o.slug as org_slug, o.plan as org_plan
       FROM users u
       JOIN organizations o ON u.org_id = o.id
       WHERE u.id = $1`,
      [req.user!.id]
    );

    // If not found in current worker memory, attempt recovery for demo users across serverless cold starts
    if (userRes.rows.length === 0) {
      const email = req.user?.email || '';
      if (email.endsWith('@volterra.demo')) {
        await demoService.seedVolterraDemo(false);
      } else if (email.endsWith('@inkloom.enterprise')) {
        await demoService.seedVolterraDemo(false);
      }

      // Re-query by ID or email
      userRes = await db.query(
        `SELECT u.id, u.org_id, u.email, u.full_name, u.role, u.created_at,
                o.name as org_name, o.slug as org_slug, o.plan as org_plan
         FROM users u
         JOIN organizations o ON u.org_id = o.id
         WHERE u.id = $1 OR LOWER(u.email) = LOWER($2)`,
        [req.user!.id, email]
      );
    }

    if (userRes.rows.length === 0) {
      res.status(404).json({
        error: 'User profile not found. Please log in again.',
        code: 'USER_NOT_FOUND',
      });
      return;
    }

    res.json({ user: userRes.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch user profile: ' + err.message });
  }
});

export default router;
