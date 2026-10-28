import { app, initializeServices } from '../index.js';
import http from 'http';
import fs from 'fs';
import path from 'path';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

async function runSubmissionAndAuthRegressionTests() {
  console.log('================================================================');
  console.log(' Inkloom Guardian: Content Submission & Auth Regression Tests');
  console.log('================================================================\n');

  await initializeServices();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`Regression test server active at: ${baseUrl}\n`);

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
    // -------------------------------------------------------------
    // Test 1: Successful Login with Seeded Admin User
    // -------------------------------------------------------------
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@inkloom.enterprise',
        password: 'Password123!',
      }),
    });
    const loginData = await loginRes.json();
    assert(
      loginRes.status === 200 && !!loginData.token && loginData.user?.email === 'admin@inkloom.enterprise',
      'Successful login with standard admin credentials',
      JSON.stringify(loginData)
    );
    const adminToken = loginData.token;

    // -------------------------------------------------------------
    // Test 2: Successful Login with Volterra Demo User via Standard /login
    // -------------------------------------------------------------
    const volterraLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'compliance@volterra.demo',
        password: 'Password123!',
      }),
    });
    const volterraLoginData = await volterraLoginRes.json();
    assert(
      volterraLoginRes.status === 200 && !!volterraLoginData.token && volterraLoginData.user?.role === 'compliance_officer',
      'Successful login with Volterra demo credentials via standard /login',
      JSON.stringify(volterraLoginData)
    );
    const volterraToken = volterraLoginData.token;

    // -------------------------------------------------------------
    // Test 3: Demo Login Endpoint (/api/auth/demo-login)
    // -------------------------------------------------------------
    const demoLoginRes = await fetch(`${baseUrl}/api/auth/demo-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'content_creator' }),
    });
    const demoLoginData = await demoLoginRes.json();
    assert(
      demoLoginRes.status === 200 && !!demoLoginData.token && demoLoginData.user?.role === 'content_creator',
      'Successful authentication via /api/auth/demo-login',
      JSON.stringify(demoLoginData)
    );
    const creatorToken = demoLoginData.token;

    // -------------------------------------------------------------
    // Test 4: Session Validation & Profile Lookup (GET /api/auth/me)
    // -------------------------------------------------------------
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${volterraToken}` },
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 && meData.user?.email === 'compliance@volterra.demo',
      'Session validation (GET /api/auth/me) resolves active user profile',
      JSON.stringify(meData)
    );

    // -------------------------------------------------------------
    // Test 5: Invalid Session Token Rejection (401)
    // -------------------------------------------------------------
    const invalidTokenRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' },
    });
    const invalidTokenData = await invalidTokenRes.json();
    assert(
      invalidTokenRes.status === 401 && invalidTokenData.error?.includes('Invalid or expired'),
      'Invalid session token returns HTTP 401',
      JSON.stringify(invalidTokenData)
    );

    // -------------------------------------------------------------
    // Test 6: Missing Authorization Header (401)
    // -------------------------------------------------------------
    const noTokenRes = await fetch(`${baseUrl}/api/auth/me`);
    const noTokenData = await noTokenRes.json();
    assert(
      noTokenRes.status === 401 && noTokenData.error?.includes('Authentication required'),
      'Missing token returns HTTP 401',
      JSON.stringify(noTokenData)
    );

    // -------------------------------------------------------------
    // Test 7: Valid Content Submission via JSON
    // -------------------------------------------------------------
    const jsonSubRes = await fetch(`${baseUrl}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        title: 'Q4 Product Showcase Article',
        channel: 'Website & Landing Page',
        content_body: 'Volterra energy systems deliver reliable solid-state battery storage with zero compromise.',
        auto_scan: 'false',
      }),
    });
    const jsonSubData = await jsonSubRes.json();
    assert(
      jsonSubRes.status === 201 && !!jsonSubData.submission?.id && jsonSubData.submission.title === 'Q4 Product Showcase Article',
      'Valid content submission via JSON returns 201 with created record',
      JSON.stringify(jsonSubData)
    );

    // -------------------------------------------------------------
    // Test 8: Content Submission with camelCase parameters (contentBody, autoScan, campaignId)
    // -------------------------------------------------------------
    const camelSubRes = await fetch(`${baseUrl}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        title: 'Campaign Social Announcement',
        channel: 'Social Media',
        contentBody: 'Volterra UltimaCell power cells are engineered for next-generation transport fleets.',
        autoScan: 'false',
        campaignId: 'none',
      }),
    });
    const camelSubData = await camelSubRes.json();
    assert(
      camelSubRes.status === 201 && camelSubData.submission?.content_body?.includes('Volterra UltimaCell'),
      'Submission correctly normalizes camelCase fields (contentBody, autoScan, campaignId)',
      JSON.stringify(camelSubData)
    );

    // -------------------------------------------------------------
    // Test 9: Missing Required Fields Rejection (HTTP 400)
    // -------------------------------------------------------------
    const missingFieldsRes = await fetch(`${baseUrl}/api/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creatorToken}`,
      },
      body: JSON.stringify({
        title: 'Only Title Given',
      }),
    });
    const missingFieldsData = await missingFieldsRes.json();
    assert(
      missingFieldsRes.status === 400 && missingFieldsData.code === 'VALIDATION_FAILED',
      'Missing required fields returns HTTP 400 with VALIDATION_FAILED error code',
      JSON.stringify(missingFieldsData)
    );

    // -------------------------------------------------------------
    // Test 10: Multipart Form Submission with 'file' field name (Frontend Bug Fix)
    // -------------------------------------------------------------
    const formWithFile = new FormData();
    formWithFile.append('title', 'Volterra Battery Spec Sheet');
    formWithFile.append('channel', 'Product Whitepaper');
    formWithFile.append('contentBody', 'Technical specifications for solid-state battery architecture.');
    formWithFile.append('autoScan', 'false');
    const txtBlob = new Blob(['Validated specification data for Volterra battery.'], { type: 'text/plain' });
    formWithFile.append('file', txtBlob, 'specs.txt');

    const fileSubRes = await fetch(`${baseUrl}/api/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creatorToken}`,
      },
      body: formWithFile,
    });
    const fileSubData = await fileSubRes.json();
    assert(
      fileSubRes.status === 201 && !!fileSubData.submission?.file_attachment_url,
      'Multipart upload accepting field name "file" succeeds without MulterError',
      JSON.stringify(fileSubData)
    );

    // -------------------------------------------------------------
    // Test 11: Multipart Form Submission with 'attachment' field name
    // -------------------------------------------------------------
    const formWithAttachment = new FormData();
    formWithAttachment.append('title', 'Volterra Ad Creative Asset');
    formWithAttachment.append('channel', 'Print & Billboard Ad');
    formWithAttachment.append('content_body', 'Print advertisement creative text.');
    formWithAttachment.append('auto_scan', 'false');
    const pngBlob = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: 'image/png' });
    formWithAttachment.append('attachment', pngBlob, 'creative.png');

    const attachSubRes = await fetch(`${baseUrl}/api/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creatorToken}`,
      },
      body: formWithAttachment,
    });
    const attachSubData = await attachSubRes.json();
    assert(
      attachSubRes.status === 201 && attachSubData.submission?.file_type === 'image/png',
      'Multipart upload accepting field name "attachment" succeeds with PNG file',
      JSON.stringify(attachSubData)
    );

    // -------------------------------------------------------------
    // Test 12: DOCX Attachment and Content Extraction
    // -------------------------------------------------------------
    const formWithDocx = new FormData();
    formWithDocx.append('title', 'Docx Policy Document');
    formWithDocx.append('channel', 'Product Whitepaper');
    const docxBlob = new Blob(['<w:t>Volterra Verified Policy Statement</w:t>'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    formWithDocx.append('file', docxBlob, 'policy.docx');

    const docxSubRes = await fetch(`${baseUrl}/api/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creatorToken}`,
      },
      body: formWithDocx,
    });
    const docxSubData = await docxSubRes.json();
    assert(
      docxSubRes.status === 201 && !!docxSubData.submission?.content_body,
      'DOCX attachment upload succeeds and extracts text content when body is omitted',
      JSON.stringify(docxSubData)
    );

    // -------------------------------------------------------------
    // Test 13: Unsupported File Type Rejection (HTTP 400)
    // -------------------------------------------------------------
    const formWithBadFile = new FormData();
    formWithBadFile.append('title', 'Executable Test');
    formWithBadFile.append('channel', 'Website & Landing Page');
    formWithBadFile.append('content_body', 'Valid text copy.');
    const exeBlob = new Blob(['binary data'], { type: 'application/octet-stream' });
    formWithBadFile.append('file', exeBlob, 'malicious.exe');

    const badFileRes = await fetch(`${baseUrl}/api/content`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creatorToken}`,
      },
      body: formWithBadFile,
    });
    const badFileData = await badFileRes.json();
    assert(
      badFileRes.status === 400 && badFileData.error?.includes('Unsupported file format'),
      'Unsupported file format (.exe) returns HTTP 400 with descriptive error',
      JSON.stringify(badFileData)
    );

    // -------------------------------------------------------------
    // Test 14: Correlation ID and Diagnostic Header Tracking
    // -------------------------------------------------------------
    const customReqId = 'test-corr-id-9988';
    const traceRes = await fetch(`${baseUrl}/api/health`, {
      headers: { 'X-Request-Id': customReqId },
    });
    const echoReqId = traceRes.headers.get('x-request-id');
    assert(
      echoReqId === customReqId,
      'Request correlation ID is echoed in response headers (X-Request-Id)',
      `Expected ${customReqId}, received ${echoReqId}`
    );

  } catch (err: any) {
    console.error('Regression suite execution error:', err);
    assert(false, 'Regression suite completed without crash', err.message);
  } finally {
    server.close();
  }

  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;
  console.log(`\n================================================================`);
  console.log(` REGRESSION SUITE COMPLETE: ${passedCount} Passed, ${failedCount} Failed`);
  console.log(`================================================================\n`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSubmissionAndAuthRegressionTests();
