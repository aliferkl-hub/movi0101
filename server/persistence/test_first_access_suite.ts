import assert from 'assert';
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

const NEW_MASTER_EMAIL = 'aliferkl@icloud.com';
const NEW_MASTER_NAME = 'Alifer Madeiro';
const TEST_ACTIVATION_KEY = 'TestFirstAccessKey#MoviLog2026!';
const TEST_STRONG_PASS = 'AliferMaster#2026!';

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function startIsolatedServer() {
  const { apiRouter, _resetMasterRecoveryRateLimitForTesting } = await import('../api.ts');
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    resetRateLimit: _resetMasterRecoveryRateLimitForTesting,
  };
}

async function postJson(
  url: string,
  body: Record<string, any>,
  headers: Record<string, string> = {}
) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, headers: res.headers, data };
}

async function runWorker() {
  const dataDir = process.env.MOVILOG_DATA_DIR!;
  const dbPath = path.join(dataDir, 'db.json');
  const beforeData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  const { provisionMasterOwnerInJson } = await import('../scripts/provision_master_owner.ts');
  const { verifyPassword } = await import('../db.ts');

  // 1. Provision new master_owner without duplicating
  const firstRun = provisionMasterOwnerInJson({
    name: NEW_MASTER_NAME,
    email: NEW_MASTER_EMAIL,
  });
  assert.strictEqual(firstRun.created, true);
  assert.strictEqual(firstRun.user.email, NEW_MASTER_EMAIL);
  assert.strictEqual(firstRun.user.name, NEW_MASTER_NAME);
  assert.strictEqual(firstRun.user.role, 'master_owner');
  assert.strictEqual(firstRun.user.active, true);
  assert.strictEqual(firstRun.user.companyId, null);
  assert.strictEqual(firstRun.user.mustSetPassword, true);

  // 2. Re-running with different casing must NOT duplicate
  const secondRun = provisionMasterOwnerInJson({
    name: NEW_MASTER_NAME,
    email: 'ALIFERKL@ICLOUD.COM',
  });
  assert.strictEqual(secondRun.created, false);
  assert.strictEqual(secondRun.user.id, firstRun.user.id);

  // 3. Verify existing accounts/companies/deliveries untouched
  const afterProvision = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  assert.strictEqual(afterProvision.users.length, beforeData.users.length + 1);
  assert.strictEqual(afterProvision.companies.length, beforeData.companies.length);
  assert.strictEqual(afterProvision.deliveries.length, beforeData.deliveries.length);
  for (const oldUser of beforeData.users) {
    const kept = afterProvision.users.find((u: any) => u.id === oldUser.id);
    assert.deepStrictEqual(kept, oldUser, `Existing user ${oldUser.email} was modified!`);
  }
  assert(
    afterProvision.auditLogs.some((a: any) => a.acao === 'CRIACAO_MASTER_OWNER'),
    'Creation must be logged in auditLogs'
  );

  // 4. verifyPassword must never throw on uninitialized empty hash/salt
  assert.strictEqual(verifyPassword('anything', '', ''), false);

  delete process.env.MASTER_FIRST_ACCESS_KEY;
  delete process.env.MASTER_RECOVERY_KEY;
  const srv = await startIsolatedServer();
  try {
    // 5. Login before setting password -> 403 FIRST_ACCESS_REQUIRED
    const loginPending = await postJson(`${srv.baseUrl}/api/auth/login`, {
      email: NEW_MASTER_EMAIL,
      password: 'AnyAttemptedPassword1!',
    });
    assert.strictEqual(loginPending.status, 403);
    assert.strictEqual(loginPending.data.code, 'FIRST_ACCESS_REQUIRED');

    // 6. First-access fails closed (503) when no server activation secret configured
    const faNoKey = await postJson(`${srv.baseUrl}/api/auth/first-access`, {
      email: NEW_MASTER_EMAIL,
      activationKey: TEST_ACTIVATION_KEY,
      newPassword: TEST_STRONG_PASS,
      confirmPassword: TEST_STRONG_PASS,
    });
    assert.strictEqual(faNoKey.status, 503);

    process.env.MASTER_FIRST_ACCESS_KEY = TEST_ACTIVATION_KEY;

    // 7. Invalid Origin -> 403
    const faBadOrigin = await postJson(
      `${srv.baseUrl}/api/auth/first-access`,
      {
        email: NEW_MASTER_EMAIL,
        activationKey: TEST_ACTIVATION_KEY,
        newPassword: TEST_STRONG_PASS,
        confirmPassword: TEST_STRONG_PASS,
      },
      { Origin: 'https://evil.example.com' }
    );
    assert.strictEqual(faBadOrigin.status, 403);

    srv.resetRateLimit();

    // 8. Wrong activation key -> 401; after 5 fails -> 429
    for (let i = 0; i < 5; i++) {
      const bad = await postJson(`${srv.baseUrl}/api/auth/first-access`, {
        email: NEW_MASTER_EMAIL,
        activationKey: `wrong-${i}`,
        newPassword: TEST_STRONG_PASS,
        confirmPassword: TEST_STRONG_PASS,
      });
      assert.strictEqual(bad.status, 401);
    }
    const locked = await postJson(`${srv.baseUrl}/api/auth/first-access`, {
      email: NEW_MASTER_EMAIL,
      activationKey: TEST_ACTIVATION_KEY,
      newPassword: TEST_STRONG_PASS,
      confirmPassword: TEST_STRONG_PASS,
    });
    assert.strictEqual(locked.status, 429);

    srv.resetRateLimit();

    // 9. Weak password & mismatch -> 400
    const weak = await postJson(`${srv.baseUrl}/api/auth/first-access`, {
      email: NEW_MASTER_EMAIL,
      activationKey: TEST_ACTIVATION_KEY,
      newPassword: 'weak',
      confirmPassword: 'weak',
    });
    assert.strictEqual(weak.status, 400);

    // 10. Existing user that already has a password cannot use first-access -> 403
    const existingAccount = await postJson(`${srv.baseUrl}/api/auth/first-access`, {
      email: 'Alifermadeiro@hotmail.com',
      activationKey: TEST_ACTIVATION_KEY,
      newPassword: TEST_STRONG_PASS,
      confirmPassword: TEST_STRONG_PASS,
    });
    assert.strictEqual(existingAccount.status, 403);

    // 11. Valid first-access setup
    const ok = await postJson(
      `${srv.baseUrl}/api/auth/first-access`,
      {
        email: NEW_MASTER_EMAIL,
        activationKey: TEST_ACTIVATION_KEY,
        newPassword: TEST_STRONG_PASS,
        confirmPassword: TEST_STRONG_PASS,
      },
      { Origin: srv.baseUrl }
    );
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.data.success, true);

    // 12. One-time: second call to first-access must be rejected (403)
    const replay = await postJson(`${srv.baseUrl}/api/auth/first-access`, {
      email: NEW_MASTER_EMAIL,
      activationKey: TEST_ACTIVATION_KEY,
      newPassword: 'Another#Password2026!',
      confirmPassword: 'Another#Password2026!',
    });
    assert.strictEqual(replay.status, 403);

    // 13. Login with newly set scrypt password succeeds & grants full master_owner permissions
    const loginOk = await postJson(`${srv.baseUrl}/api/auth/login`, {
      email: NEW_MASTER_EMAIL,
      password: TEST_STRONG_PASS,
    });
    assert.strictEqual(loginOk.status, 200);
    assert.strictEqual(loginOk.data.user.role, 'master_owner');
    assert.strictEqual(loginOk.data.user.companyId, null);
    assert(loginOk.data.token);

    const masterStats = await fetch(`${srv.baseUrl}/api/master/stats`, {
      headers: { Authorization: `Bearer ${loginOk.data.token}` },
    });
    assert.strictEqual(masterStats.status, 200, 'New master_owner must have full /api/master/stats access');

    const masterCompanies = await fetch(`${srv.baseUrl}/api/master/companies`, {
      headers: { Authorization: `Bearer ${loginOk.data.token}` },
    });
    assert.strictEqual(
      masterCompanies.status,
      200,
      'New master_owner must have full /api/master/companies access'
    );

    // 14. Verify scrypt hash & sanitized audit log on disk
    const finalDisk = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const createdUser = finalDisk.users.find((u: any) => u.email === NEW_MASTER_EMAIL);
    assert(createdUser);
    assert.strictEqual(createdUser.mustSetPassword, false);
    assert(/^[0-9a-f]{128}$/i.test(createdUser.passwordHash));
    assert(/^[0-9a-f]{32}$/i.test(createdUser.salt));
    const auditBlob = JSON.stringify(finalDisk.auditLogs);
    assert(!auditBlob.includes(TEST_ACTIVATION_KEY));
    assert(!auditBlob.includes(TEST_STRONG_PASS));
    assert(!auditBlob.includes(createdUser.passwordHash));
    assert(!auditBlob.includes(createdUser.salt));
  } finally {
    await srv.close();
  }
}

async function runOrchestrator() {
  const realDb = path.resolve('data/db.json');
  const realSessions = path.resolve('data/sessions.json');
  const shaDbBefore = sha256File(realDb);
  const shaSessBefore = sha256File(realSessions);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'movilog-first-access-'));
  try {
    fs.copyFileSync(realDb, path.join(tmpDir, 'db.json'));
    fs.copyFileSync(realSessions, path.join(tmpDir, 'sessions.json'));
    const tsxBin = path.resolve('node_modules/.bin/tsx');
    const selfFile = path.resolve('server/persistence/test_first_access_suite.ts');

    execFileSync(tsxBin, [selfFile], {
      stdio: 'inherit',
      env: {
        ...process.env,
        FIRST_ACCESS_WORKER: '1',
        MOVILOG_DATA_DIR: tmpDir,
        PERSISTENCE_MODE: 'json',
      },
    });
    console.log('[OK] Isolated first-access & master_owner provisioning test suite passed');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    assert.strictEqual(sha256File(realDb), shaDbBefore, 'Test must not alter real data/db.json');
    assert.strictEqual(
      sha256File(realSessions),
      shaSessBefore,
      'Test must not alter real data/sessions.json'
    );
  }
}

if (process.env.FIRST_ACCESS_WORKER === '1') {
  runWorker().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  runOrchestrator().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
