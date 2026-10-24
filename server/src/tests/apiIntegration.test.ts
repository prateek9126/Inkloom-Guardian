import { app, initializeServices } from '../index.js';
import http from 'http';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

async function runApiIntegrationTests() {
  console.log('====================================================');
  console.log(' Inkloom Guardian: Full API Integration Test Suite');
  console.log('====================================================\n');

  await initializeServices();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Test server running on ${baseUrl}\n`);

  const results: TestResult[] = [];

  function assert(condition: boolean, name: string, details?: string) {
    if (condition) {
      console.log(`[PASS] ${name}`);
      results.push({ name, passed: true });
    } else {
      console.error(`[FAIL] ${name} - Details: ${details || 'None'}`);
      results.push({ name, passed: false, details });
    }
  }

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === 'healthy', 'GET /api/health returns 200 healthy');

    // 2. Demo Walkthrough Steps
    const stepsRes = await fetch(`${baseUrl}/api/demo/walkthrough-steps`);
    const stepsData = await stepsRes.json();
    assert(stepsRes.status === 200 && stepsData.steps?.length === 12, 'GET /api/demo/walkthrough-steps returns 12 steps');

    // 3. Demo Snippets
    const snipRes = await fetch(`${baseUrl}/api/demo/snippets`);
    const snipData = await snipRes.json();
    assert(snipRes.status === 200 && snipData.snippets?.volterra_ad, 'GET /api/demo/snippets returns sample snippets');

    // 4. Demo Status
    const statusRes = await fetch(`${baseUrl}/api/demo/status`);
    const statusData = await statusRes.json();
    assert(statusRes.status === 200 && statusData.status === 'success', 'GET /api/demo/status returns demo status');

    // 5. Registration
    const registerPayload = {
      orgName: 'Acme Test Corp',
      fullName: 'Alice Test',
      email: `alice_${Date.now()}@acme.test`,
      password: 'SecurePassword123!',
      role: 'admin',
    };
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload),
    });
    const regData = await regRes.json();
    assert(regRes.status === 201 && Boolean(regData.token), 'POST /api/auth/register creates user and returns JWT token');

    // 6. Login with registered user
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: registerPayload.email, password: registerPayload.password }),
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && Boolean(loginData.token), 'POST /api/auth/login succeeds with valid credentials');

    // 7. Test All 4 Demo Roles via /api/auth/demo-login
    const demoRoles = ['compliance_officer', 'brand_manager', 'content_creator', 'admin'];
    for (const role of demoRoles) {
      const demoRes = await fetch(`${baseUrl}/api/auth/demo-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const demoData = await demoRes.json();
      assert(
        demoRes.status === 200 && demoData.token && demoData.user?.role === role,
        `POST /api/auth/demo-login for role "${role}" authenticates with valid token and role`
      );
    }

    // 8. Test All 4 Demo Roles via /api/demo/switch-user
    for (const role of demoRoles) {
      const switchRes = await fetch(`${baseUrl}/api/demo/switch-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      const switchData = await switchRes.json();
      assert(
        switchRes.status === 200 && switchData.token && switchData.user?.role === role,
        `POST /api/demo/switch-user for role "${role}" returns valid token and role`
      );
    }

    // Use compliance officer token for authenticated feature tests
    const complianceAuth = await (await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'compliance_officer' }),
    })).json();
    const token = complianceAuth.token;

    // 9. Authenticated /api/auth/me
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user?.email === 'compliance@volterra.demo', 'GET /api/auth/me returns authenticated user profile');

    // 10. Dashboard Stats
    const dashRes = await fetch(`${baseUrl}/api/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(dashRes.status === 200, 'GET /api/dashboard/stats returns 200 with metrics');

    // 11. Guidelines
    const guideRes = await fetch(`${baseUrl}/api/guidelines`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const guideData = await guideRes.json();
    assert(guideRes.status === 200 && guideData.guidelines?.length > 0, 'GET /api/guidelines returns active guidelines');

    // 12. Claims
    const claimsRes = await fetch(`${baseUrl}/api/claims`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const claimsData = await claimsRes.json();
    assert(claimsRes.status === 200 && Array.isArray(claimsData.claims), 'GET /api/claims returns approved claims list');

    // 13. Audit logs
    const auditRes = await fetch(`${baseUrl}/api/audit`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const auditData = await auditRes.json();
    assert(auditRes.status === 200 && Array.isArray(auditData.logs), 'GET /api/audit returns audit events');

    // 14. Audit CSV Export
    const csvRes = await fetch(`${baseUrl}/api/audit/export?format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const csvText = await csvRes.text();
    assert(csvRes.status === 200 && csvText.includes('Log ID'), 'GET /api/audit/export?format=csv returns CSV content');

    // 15. CORS Preflight & Vercel Origins
    const corsRes = await fetch(`${baseUrl}/api/health`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://inkloom-guardian.vercel.app',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert(
      corsRes.status === 204 && corsRes.headers.get('access-control-allow-origin') === 'https://inkloom-guardian.vercel.app',
      'CORS preflight allows https://inkloom-guardian.vercel.app origin with 204 status'
    );

    const corsWalkthrough = await fetch(`${baseUrl}/api/demo/walkthrough-steps`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://inkloom-guardian.vercel.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization, Content-Type',
      },
    });
    assert(
      corsWalkthrough.status === 204 && corsWalkthrough.headers.get('access-control-allow-origin') === 'https://inkloom-guardian.vercel.app',
      'CORS preflight allows OPTIONS /api/demo/walkthrough-steps from https://inkloom-guardian.vercel.app'
    );

    // 16. Vercel Path Normalization (simulating x-matched-path rewrite)
    const normRes = await fetch(`${baseUrl}/src/index.js`, {
      headers: {
        'x-matched-path': '/api/health',
      },
    });
    const normData = await normRes.json();
    assert(normRes.status === 200 && normData.status === 'healthy', 'Vercel path normalization correctly restores /api/health from x-matched-path');

    // 17. Unknown API Route returns JSON 404 instead of HTML
    const notFoundRes = await fetch(`${baseUrl}/api/nonexistent-endpoint`);
    const notFoundData = await notFoundRes.json();
    assert(notFoundRes.status === 404 && notFoundData.error?.includes('API endpoint not found'), 'Unknown /api/* route returns clean JSON 404');

  } catch (err: any) {
    console.error('Test execution error:', err);
    assert(false, 'Test execution completed without crash', err.message);
  } finally {
    server.close();
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`\n====================================================`);
  console.log(` INTEGRATION SUITE COMPLETE: ${passedCount} Passed, ${failedCount} Failed`);
  console.log(`====================================================`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

runApiIntegrationTests();
