import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { auditService } from '../services/auditService.js';
import { seedDatabase } from '../db/seed.js';

const router = Router();

/**
 * Get organization settings, system configurations, and team members
 */
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;

    // Org details
    const orgRes = await db.query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    // System settings
    const settingsRes = await db.query('SELECT * FROM system_settings WHERE org_id = $1', [orgId]);
    // Team members
    const teamRes = await db.query(
      `SELECT id, email, full_name, role, created_at
       FROM users
       WHERE org_id = $1
       ORDER BY created_at ASC`,
      [orgId]
    );

    res.json({
      organization: orgRes.rows[0],
      settings: settingsRes.rows[0] || {
        llm_provider: 'mock',
        llm_model: 'inkloom-deterministic-v2',
        api_key_configured: true,
        strictness_level: 'standard',
        auto_scan_on_submit: true,
        require_dual_approval: true,
      },
      team: teamRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch settings: ' + err.message });
  }
});

/**
 * Update system AI engine and policy enforcement settings
 */
router.put('/system', authenticate, authorizeRoles('admin', 'compliance_officer'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const { llm_provider, llm_model, api_key_configured, strictness_level, auto_scan_on_submit, require_dual_approval } = req.body;

    const resUpdate = await db.query(
      `UPDATE system_settings
       SET llm_provider = COALESCE($1, llm_provider),
           llm_model = COALESCE($2, llm_model),
           api_key_configured = COALESCE($3, api_key_configured),
           strictness_level = COALESCE($4, strictness_level),
           auto_scan_on_submit = COALESCE($5, auto_scan_on_submit),
           require_dual_approval = COALESCE($6, require_dual_approval),
           updated_at = CURRENT_TIMESTAMP
       WHERE org_id = $7
       RETURNING *`,
      [
        llm_provider || null,
        llm_model || null,
        api_key_configured !== undefined ? api_key_configured : null,
        strictness_level || null,
        auto_scan_on_submit !== undefined ? auto_scan_on_submit : null,
        require_dual_approval !== undefined ? require_dual_approval : null,
        orgId,
      ]
    );

    await auditService.logEvent({
      orgId,
      userId,
      action: 'SYSTEM_SETTINGS_UPDATED',
      resourceType: 'org',
      resourceId: orgId,
      details: { llm_provider, strictness_level },
      ipAddress: req.ip,
    });

    res.json({ settings: resUpdate.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update system settings: ' + err.message });
  }
});

/**
 * Add / invite team member
 */
router.post('/team', authenticate, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const orgId = req.user!.org_id;
    const userId = req.user!.id;
    const { email, full_name, role = 'content_creator', temporary_password = 'Password123!' } = req.body;

    if (!email || !full_name) {
      res.status(400).json({ error: 'Email and full name are required.' });
      return;
    }

    const check = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (check.rows.length > 0) {
      res.status(409).json({ error: 'A user with this email address already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(temporary_password, 10);
    const result = await db.query(
      `INSERT INTO users (org_id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, created_at`,
      [orgId, email.toLowerCase().trim(), passwordHash, full_name.trim(), role]
    );

    const newUser = result.rows[0];

    await auditService.logEvent({
      orgId,
      userId,
      action: 'USER_INVITED',
      resourceType: 'user',
      resourceId: newUser.id,
      details: { email: newUser.email, role: newUser.role },
      ipAddress: req.ip,
    });

    res.status(201).json({ user: newUser });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add team member: ' + err.message });
  }
});

/**
 * Update team member role
 */
router.put('/team/:memberId', authenticate, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const orgId = req.user!.org_id;
    const { role } = req.body;

    if (!role) {
      res.status(400).json({ error: 'Role is required.' });
      return;
    }

    // Security check: Prevent users from changing their own roles
    if (memberId === req.user!.id) {
      res.status(400).json({
        error: 'Security Safeguard: Users are prohibited from modifying their own roles. Another authorized administrator must perform this change.',
      });
      return;
    }

    const result = await db.query(
      `UPDATE users
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND org_id = $3
       RETURNING id, email, full_name, role, updated_at`,
      [role, memberId, orgId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Team member not found.' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update team member: ' + err.message });
  }
});

/**
 * Remove team member
 */
router.delete('/team/:memberId', authenticate, authorizeRoles('admin'), async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const orgId = req.user!.org_id;

    if (memberId === req.user!.id) {
      res.status(400).json({ error: 'You cannot remove your own account.' });
      return;
    }

    await db.query('DELETE FROM users WHERE id = $1 AND org_id = $2', [memberId, orgId]);
    res.json({ success: true, message: 'Team member removed.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove team member: ' + err.message });
  }
});

/**
 * One-click reset to pristine demonstration state
 */
router.post('/reset-demo', authenticate, authorizeRoles('admin'), async (_req: Request, res: Response) => {
  try {
    await seedDatabase(true);
    res.json({ success: true, message: 'Demonstration data successfully reset.' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset demo data: ' + err.message });
  }
});

export default router;
