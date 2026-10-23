import { Router, Request, Response } from 'express';
import { demoService } from '../services/demoService.js';
import { auditService } from '../services/auditService.js';

const router = Router();

/**
 * GET /api/demo/status
 * Check if the VOLTERRA demo workspace is initialized and return summary statistics
 */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await demoService.getDemoStatus();
    res.json({
      status: 'success',
      data: status,
    });
  } catch (err: any) {
    console.error('[Demo Status Error]:', err);
    res.status(500).json({ error: 'Failed to retrieve demo status: ' + err.message });
  }
});

/**
 * POST /api/demo/seed
 * Seed the complete VOLTERRA Energy Dynamics demo workspace
 */
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const { force = false } = req.body || {};
    const orgId = await demoService.seedVolterraDemo(Boolean(force));
    const status = await demoService.getDemoStatus();

    // Default to compliance officer token for instant judge role
    const complianceAuth = await demoService.getDemoUserToken('compliance_officer');

    res.json({
      status: 'success',
      message: 'VOLTERRA demo environment initialized successfully.',
      orgId,
      demoStatus: status,
      auth: complianceAuth,
    });
  } catch (err: any) {
    console.error('[Demo Seed Error]:', err);
    res.status(500).json({ error: 'Failed to seed demo data: ' + err.message });
  }
});

/**
 * POST /api/demo/reset
 * Securely reset ONLY the demo organization back to its initial pristine demonstration state
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    const orgId = await demoService.resetVolterraDemo();
    const status = await demoService.getDemoStatus();
    const complianceAuth = await demoService.getDemoUserToken('compliance_officer');

    await auditService.logEvent({
      orgId,
      action: 'DEMO_DATA_RESET',
      resourceType: 'demo_environment',
      resourceId: orgId,
      details: { trigger: 'Judge / User interactive demo reset' },
      ipAddress: req.ip,
    });

    res.json({
      status: 'success',
      message: 'VOLTERRA demonstration environment has been restored to pristine baseline state.',
      orgId,
      demoStatus: status,
      auth: complianceAuth,
    });
  } catch (err: any) {
    console.error('[Demo Reset Error]:', err);
    res.status(500).json({ error: 'Failed to reset demo data: ' + err.message });
  }
});

/**
 * POST /api/demo/switch-user
 * Switch persona directly without password re-entry for hackathon judges
 */
router.post('/switch-user', async (req: Request, res: Response) => {
  try {
    const { role = 'compliance_officer' } = req.body || {};
    const validRoles = ['compliance_officer', 'brand_manager', 'content_creator', 'admin'];
    
    if (!validRoles.includes(role)) {
      res.status(400).json({
        error: `Invalid role "${role}". Must be one of: ${validRoles.join(', ')}`,
      });
      return;
    }

    const auth = await demoService.getDemoUserToken(role);

    await auditService.logEvent({
      orgId: auth.org.id,
      userId: auth.user.id,
      action: 'DEMO_USER_SWITCH',
      resourceType: 'user',
      resourceId: auth.user.id,
      details: { role, email: auth.user.email },
      ipAddress: req.ip,
    });

    res.json({
      status: 'success',
      message: `Switched active persona to ${auth.user.full_name} (${auth.user.role}).`,
      token: auth.token,
      user: auth.user,
      organization: auth.org,
    });
  } catch (err: any) {
    console.error('[Demo Switch User Error]:', err);
    res.status(500).json({ error: 'Failed to switch demo user: ' + err.message });
  }
});

/**
 * GET /api/demo/snippets
 * Retrieve pre-written test content snippets to auto-fill submission forms
 */
router.get('/snippets', (_req: Request, res: Response) => {
  try {
    const snippets = demoService.getSampleSnippets();
    res.json({
      status: 'success',
      snippets,
    });
  } catch (err: any) {
    console.error('[Demo Snippets Error]:', err);
    res.status(500).json({ error: 'Failed to fetch demo snippets: ' + err.message });
  }
});

/**
 * GET /api/demo/walkthrough-steps
 * Retrieve the 12-step guided judge tour sequence with deliberate contradictions and evidence sources
 */
router.get('/walkthrough-steps', (_req: Request, res: Response) => {
  try {
    const steps = demoService.getWalkthroughSteps();
    res.json({
      status: 'success',
      steps,
    });
  } catch (err: any) {
    console.error('[Demo Walkthrough Steps Error]:', err);
    res.status(500).json({ error: 'Failed to fetch walkthrough steps: ' + err.message });
  }
});

export default router;
