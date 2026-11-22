import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

function sha256File(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

async function httpJson(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT',
  body?: Record<string, any>,
  headers: Record<string, string> = {}
) {
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as any;
  return { status: res.status, data };
}

async function startEphemeralServer() {
  const { apiRouter } = await import('../api.ts');
  const dbMod = await import('../db.ts');
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  assert(addr && typeof addr !== 'string');
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    dbMod,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function runPhase1Worker() {
  const dataDir = process.env.MOVILOG_DATA_DIR!;
  const dbPath = path.join(dataDir, 'db.json');
  const initialDisk = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  const originalMaster = initialDisk.users.find((u: any) => u.role === 'master_owner');
  assert(originalMaster, 'Clean DB must contain official Master Owner');
  assert.strictEqual(initialDisk.companies.length, 0, 'Clean DB must start with 0 companies');
  assert.strictEqual(initialDisk.plans.length, 5, 'Clean DB must contain 5 commercial plans');

  const srv = await startEphemeralServer();
  const { db, hashPassword, createSessionAsync, ORIGINAL_MASTER_OWNER_ID, assertMasterOwnerSingleton } =
    srv.dbMod;

  try {
    // 1. Clean initial status: onboardingPending=true, hasCompanies=false
    const pubStatus0 = await httpJson(`${srv.baseUrl}/api/onboarding/status`, 'GET');
    assert.strictEqual(pubStatus0.status, 200);
    assert.strictEqual(pubStatus0.data.onboardingCompleted, false);
    assert.strictEqual(pubStatus0.data.onboardingPending, true);
    assert.strictEqual(pubStatus0.data.hasCompanies, false);

    // Issue isolated Master Owner session without touching Master hash/salt/password
    const masterToken = await createSessionAsync(ORIGINAL_MASTER_OWNER_ID);
    const masterHeaders = { Authorization: `Bearer ${masterToken}` };

    // 2. Calling auth/me, notifications, master endpoints must NOT silently fabricate a company
    const meRes = await httpJson(`${srv.baseUrl}/api/auth/me`, 'GET', undefined, masterHeaders);
    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.data.user.role, 'master_owner');
    assert.strictEqual(meRes.data.company, null);

    const notifRes = await httpJson(`${srv.baseUrl}/api/notifications`, 'GET', undefined, masterHeaders);
    assert.strictEqual(notifRes.status, 200);

    const statsRes0 = await httpJson(`${srv.baseUrl}/api/master/stats`, 'GET', undefined, masterHeaders);
    assert.strictEqual(statsRes0.status, 200);
    assert.strictEqual(statsRes0.data.totalCompanies, 0);

    const masterOnb0 = await httpJson(
      `${srv.baseUrl}/api/master/onboarding`,
      'GET',
      undefined,
      masterHeaders
    );
    assert.strictEqual(masterOnb0.status, 200);
    assert.strictEqual(masterOnb0.data.onboardingCompleted, false);
    assert.strictEqual(masterOnb0.data.hasCompanies, false);
    assert.strictEqual(db.companies.length, 0, 'No default company may be auto-created on login/master load');

    // 3. Flow A: Master Owner creates first company & new company_admin (even using Master email as companyEmail)
    const createPayload = {
      nomeFantasia: 'Alfa Logística Integrada',
      razaoSocial: 'Alfa Logística Integrada Ltda',
      cnpj: '11.222.333/0001-81',
      companyEmail: originalMaster.email,
      telefone: '(11) 98888-7777',
      endereco: 'Av. Brasil, 500 - São Paulo/SP',
      segmento: 'Logística e Portaria',
      tipoOperacao: 'integrada',
      modulos: ['logistica', 'predial'],
      nomePlataforma: 'MoviLog Operações',
      adminMode: 'create',
      adminName: 'Carlos Administrador',
      adminEmail: 'carlos.admin@alfalog.com.br',
      adminPhone: '(11) 97777-6666',
      adminPassword: 'AlfaAdmin#2026!',
      confirmPassword: 'AlfaAdmin#2026!',
    };
    const createRes = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      createPayload,
      masterHeaders
    );
    assert.strictEqual(createRes.status, 201, `Expected 201, got ${createRes.status}: ${JSON.stringify(createRes.data)}`);
    assert.strictEqual(createRes.data.success, true);
    assert.strictEqual(createRes.data.keepMasterSession, true);
    assert.strictEqual(createRes.data.user.role, 'company_admin');
    assert.strictEqual(createRes.data.user.email, 'carlos.admin@alfalog.com.br');
    assert.strictEqual(createRes.data.user.companyId, createRes.data.company.id);
    assert.strictEqual(createRes.data.onboardingCompleted, true);

    const alfaCompanyId = createRes.data.company.id;

    // Master Owner identity, hash, salt, singleton and session must remain intact
    const currentMaster = db.users.find((u) => u.id === ORIGINAL_MASTER_OWNER_ID)!;
    assert.strictEqual(currentMaster.email, originalMaster.email);
    assert.strictEqual(currentMaster.passwordHash, originalMaster.passwordHash);
    assert.strictEqual(currentMaster.salt, originalMaster.salt);
    assert.strictEqual(currentMaster.role, 'master_owner');
    assert.strictEqual(currentMaster.companyId, null);
    assertMasterOwnerSingleton(db.users, db.systemConfig);

    // 4. Unauthorized & privilege-escalation attempts must be blocked cleanly
    // 4a. Public call after completion -> 403 ONBOARDING_ALREADY_COMPLETED
    const pubBlocked = await httpJson(`${srv.baseUrl}/api/onboarding/complete`, 'POST', {
      ...createPayload,
      nomeFantasia: 'Empresa Indevida',
      cnpj: '22.333.444/0001-09',
      adminEmail: 'intruso@indevida.com',
    });
    assert.strictEqual(pubBlocked.status, 403);
    assert.strictEqual(pubBlocked.data.code, 'ONBOARDING_ALREADY_COMPLETED');

    // 4b. Authenticated company_admin cannot run onboarding -> 403
    const alfaLogin = await httpJson(`${srv.baseUrl}/api/auth/login`, 'POST', {
      email: 'carlos.admin@alfalog.com.br',
      password: 'AlfaAdmin#2026!',
    });
    assert.strictEqual(alfaLogin.status, 200);
    const alfaHeaders = { Authorization: `Bearer ${alfaLogin.data.token}` };

    const adminBlocked = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        ...createPayload,
        nomeFantasia: 'Empresa Por Admin',
        cnpj: '33.444.555/0001-27',
        adminEmail: 'outro@empresa.com',
      },
      alfaHeaders
    );
    assert.strictEqual(adminBlocked.status, 403);

    // 4c. Master cannot grant master_owner or other role via onboarding -> 403
    const roleEscalation = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        ...createPayload,
        nomeFantasia: 'Empresa Escalacao',
        cnpj: '44.555.666/0001-45',
        adminEmail: 'escalado@empresa.com',
        role: 'master_owner',
      },
      masterHeaders
    );
    assert.strictEqual(roleEscalation.status, 403);

    // 4d. Cannot target Master Owner email as adminEmail -> 403
    const targetMaster = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        ...createPayload,
        nomeFantasia: 'Empresa Target Master',
        cnpj: '55.666.777/0001-63',
        adminEmail: originalMaster.email,
      },
      masterHeaders
    );
    assert.strictEqual(targetMaster.status, 403);

    // 4e. Invalid token -> 401
    const badTokenRes = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      createPayload,
      { Authorization: 'Bearer invalid-token-123' }
    );
    assert.strictEqual(badTokenRes.status, 401);

    // 5. Setup candidate users in isolated DB to verify Flow B ("Vincular Administrador Existente")
    const eligible1Pass = 'EligibleOne#2026!';
    const h1 = hashPassword(eligible1Pass);
    const eligible2Pass = 'EligibleTwo#2026!';
    const h2 = hashPassword(eligible2Pass);
    const inactivePass = 'Inactive#2026!';
    const hInact = hashPassword(inactivePass);

    db.users.push(
      {
        id: crypto.randomUUID(),
        email: 'elegivel1@movilog.test',
        name: 'Mariana Elegível',
        passwordHash: h1.hash,
        salt: h1.salt,
        role: 'viewer',
        companyId: null,
        active: true,
        createdAt: new Date().toISOString(),
        mustSetPassword: false,
      },
      {
        id: crypto.randomUUID(),
        email: 'elegivel2@movilog.test',
        name: 'Roberto Elegível',
        passwordHash: h2.hash,
        salt: h2.salt,
        role: 'viewer',
        companyId: null,
        active: true,
        createdAt: new Date().toISOString(),
        mustSetPassword: false,
      },
      {
        id: crypto.randomUUID(),
        email: 'pendente@movilog.test',
        name: 'Pendente Sem Senha',
        passwordHash: '',
        salt: '',
        role: 'viewer',
        companyId: null,
        active: true,
        createdAt: new Date().toISOString(),
        mustSetPassword: true,
      },
      {
        id: crypto.randomUUID(),
        email: 'inativo@movilog.test',
        name: 'Usuário Inativo',
        passwordHash: hInact.hash,
        salt: hInact.salt,
        role: 'viewer',
        companyId: null,
        active: false,
        createdAt: new Date().toISOString(),
        mustSetPassword: false,
      }
    );
    await db.save();

    const masterOnbEligible = await httpJson(
      `${srv.baseUrl}/api/master/onboarding`,
      'GET',
      undefined,
      masterHeaders
    );
    assert.strictEqual(masterOnbEligible.status, 200);
    const eligibleEmails = (masterOnbEligible.data.eligibleAdmins || []).map((u: any) => u.email);
    assert.deepStrictEqual(
      eligibleEmails.sort(),
      ['elegivel1@movilog.test', 'elegivel2@movilog.test'],
      'eligibleAdmins must only expose active, password-activated, unlinked non-master users'
    );

    // Reopen onboarding as Master to test public link-mode ownership proof too
    const resetRes = await httpJson(
      `${srv.baseUrl}/api/master/onboarding/reset`,
      'POST',
      {},
      masterHeaders
    );
    assert.strictEqual(resetRes.status, 200);
    assert.strictEqual(resetRes.data.status.onboardingCompleted, false);

    // 5a. Public link mode without password -> 401
    const pubLinkNoPass = await httpJson(`${srv.baseUrl}/api/onboarding/complete`, 'POST', {
      nomeFantasia: 'Beta Predial',
      telefone: '(11) 95555-4444',
      adminMode: 'link',
      adminEmail: 'elegivel1@movilog.test',
    });
    assert.strictEqual(pubLinkNoPass.status, 401);

    // 5b. Public link mode with wrong password -> 401
    const pubLinkWrongPass = await httpJson(`${srv.baseUrl}/api/onboarding/complete`, 'POST', {
      nomeFantasia: 'Beta Predial',
      telefone: '(11) 95555-4444',
      adminMode: 'link',
      adminEmail: 'elegivel1@movilog.test',
      adminPassword: 'WrongPassword!123',
    });
    assert.strictEqual(pubLinkWrongPass.status, 401);

    // 5c. Ineligible targets blocked even for Master Owner
    const linkPending = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        nomeFantasia: 'Beta Predial',
        telefone: '(11) 95555-4444',
        adminMode: 'link',
        adminEmail: 'pendente@movilog.test',
      },
      masterHeaders
    );
    assert.strictEqual(linkPending.status, 403);

    const linkInactive = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        nomeFantasia: 'Beta Predial',
        telefone: '(11) 95555-4444',
        adminMode: 'link',
        adminEmail: 'inativo@movilog.test',
      },
      masterHeaders
    );
    assert.strictEqual(linkInactive.status, 403);

    const linkAlreadyBound = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        nomeFantasia: 'Beta Predial',
        telefone: '(11) 95555-4444',
        adminMode: 'link',
        adminEmail: 'carlos.admin@alfalog.com.br',
      },
      masterHeaders
    );
    assert.strictEqual(linkAlreadyBound.status, 409);

    const linkMasterEmail = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        nomeFantasia: 'Beta Predial',
        telefone: '(11) 95555-4444',
        adminMode: 'link',
        adminEmail: originalMaster.email,
      },
      masterHeaders
    );
    assert.strictEqual(linkMasterEmail.status, 403);

    // 5d. Master linking eligible user WITH wrong password -> 401
    const masterLinkWrongPass = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        nomeFantasia: 'Beta Predial',
        telefone: '(11) 95555-4444',
        adminMode: 'link',
        adminEmail: 'elegivel1@movilog.test',
        adminPassword: 'WrongPassword!123',
      },
      masterHeaders
    );
    assert.strictEqual(masterLinkWrongPass.status, 401);

    // 5e. Public link mode WITH valid password proof -> 201
    const pubLinkOk = await httpJson(`${srv.baseUrl}/api/onboarding/complete`, 'POST', {
      nomeFantasia: 'Beta Predial',
      telefone: '(11) 95555-4444',
      adminMode: 'link',
      adminEmail: 'elegivel1@movilog.test',
      adminPassword: eligible1Pass,
    });
    assert.strictEqual(pubLinkOk.status, 201, `Expected 201, got ${pubLinkOk.status}: ${JSON.stringify(pubLinkOk.data)}`);
    assert.strictEqual(pubLinkOk.data.keepMasterSession, false);
    assert(pubLinkOk.data.token);
    assert.strictEqual(pubLinkOk.data.user.role, 'company_admin');
    assert.strictEqual(pubLinkOk.data.user.companyId, pubLinkOk.data.company.id);

    const betaCompanyId = pubLinkOk.data.company.id;
    assert.notStrictEqual(betaCompanyId, alfaCompanyId);

    // 5f. Master Owner linking eligible2 EVEN AFTER public onboarding is completed -> 201
    const masterLinkOk = await httpJson(
      `${srv.baseUrl}/api/onboarding/complete`,
      'POST',
      {
        nomeFantasia: 'Gamma Transportes',
        telefone: '(11) 94444-3333',
        adminMode: 'link',
        adminEmail: 'elegivel2@movilog.test',
      },
      masterHeaders
    );
    assert.strictEqual(masterLinkOk.status, 201);
    assert.strictEqual(masterLinkOk.data.keepMasterSession, true);
    assert.strictEqual(masterLinkOk.data.user.role, 'company_admin');
    assert.strictEqual(masterLinkOk.data.user.companyId, masterLinkOk.data.company.id);

    // 6. Cross-company isolation checks
    const masterForbiddenToAlfa = await httpJson(
      `${srv.baseUrl}/api/master/companies`,
      'GET',
      undefined,
      alfaHeaders
    );
    assert.strictEqual(masterForbiddenToAlfa.status, 403);

    // Alfa admin listing users with spoofed x-company-id or query companyId of Beta must ONLY see Alfa users
    const alfaUsersRes = await httpJson(
      `${srv.baseUrl}/api/company/users?companyId=${encodeURIComponent(betaCompanyId)}`,
      'GET',
      undefined,
      {
        ...alfaHeaders,
        'x-company-id': betaCompanyId,
      }
    );
    assert.strictEqual(alfaUsersRes.status, 200);
    const returnedUsers = alfaUsersRes.data.users || [];
    assert.strictEqual(returnedUsers.length, 1);
    assert.strictEqual(returnedUsers[0].email, 'carlos.admin@alfalog.com.br');
    assert.notStrictEqual(returnedUsers[0].email, 'elegivel1@movilog.test');
  } finally {
    await srv.close();
  }
}

async function runPhase2RestartWorker() {
  const dataDir = process.env.MOVILOG_DATA_DIR!;
  const dbPath = path.join(dataDir, 'db.json');
  const diskData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));

  assert.strictEqual(diskData.companies.length, 3, 'All 3 onboarded companies must persist on disk');
  assert.strictEqual(diskData.plans.length, 5, 'All 5 commercial plans must remain preserved');
  assert.strictEqual(diskData.systemConfig.onboardingCompleted, true);

  const srv = await startEphemeralServer();
  const { assertMasterOwnerSingleton, ORIGINAL_MASTER_OWNER_ID } = srv.dbMod;
  try {
    assertMasterOwnerSingleton(srv.dbMod.db.users, srv.dbMod.db.systemConfig);

    // Verify Master Owner never gained a companyId
    const master = srv.dbMod.db.users.find((u) => u.id === ORIGINAL_MASTER_OWNER_ID)!;
    assert.strictEqual(master.companyId, null);
    assert.strictEqual(master.role, 'master_owner');

    // Verify created & linked company_admins can authenticate after restart
    const loginAlfa = await httpJson(`${srv.baseUrl}/api/auth/login`, 'POST', {
      email: 'carlos.admin@alfalog.com.br',
      password: 'AlfaAdmin#2026!',
    });
    assert.strictEqual(loginAlfa.status, 200);
    assert.strictEqual(loginAlfa.data.user.role, 'company_admin');
    assert.strictEqual(loginAlfa.data.company.nomeFantasia, 'Alfa Logística Integrada');

    const loginBeta = await httpJson(`${srv.baseUrl}/api/auth/login`, 'POST', {
      email: 'elegivel1@movilog.test',
      password: 'EligibleOne#2026!',
    });
    assert.strictEqual(loginBeta.status, 200);
    assert.strictEqual(loginBeta.data.user.role, 'company_admin');
    assert.strictEqual(loginBeta.data.company.nomeFantasia, 'Beta Predial');

    // Public onboarding remains locked after restart
    const pubStatusAfter = await httpJson(`${srv.baseUrl}/api/onboarding/status`, 'GET');
    assert.strictEqual(pubStatusAfter.status, 200);
    assert.strictEqual(pubStatusAfter.data.onboardingCompleted, true);
    assert.strictEqual(pubStatusAfter.data.onboardingPending, false);
  } finally {
    await srv.close();
  }
}

if (process.env.ONBOARDING_WORKER === 'phase1') {
  runPhase1Worker().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (process.env.ONBOARDING_WORKER === 'phase2') {
  runPhase2RestartWorker().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  test('Onboarding 403 fix: Master create, link eligibility + ownership proof, isolation, and restart persistence', () => {
    const realDb = path.resolve('data/db.json');
    const realSessions = path.resolve('data/sessions.json');
    const shaDbBefore = sha256File(realDb);
    const shaSessBefore = sha256File(realSessions);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'movilog-onboarding-fix-'));
    try {
      fs.copyFileSync(realDb, path.join(tmpDir, 'db.json'));
      fs.copyFileSync(realSessions, path.join(tmpDir, 'sessions.json'));

      const tsxBin = path.resolve('node_modules/.bin/tsx');
      const selfFile = path.resolve('server/tests/onboarding_fix_suite.ts');

      execFileSync(tsxBin, [selfFile], {
        stdio: 'inherit',
        env: {
          ...process.env,
          ONBOARDING_WORKER: 'phase1',
          MOVILOG_DATA_DIR: tmpDir,
          PERSISTENCE_MODE: 'json',
        },
      });

      execFileSync(tsxBin, [selfFile], {
        stdio: 'inherit',
        env: {
          ...process.env,
          ONBOARDING_WORKER: 'phase2',
          MOVILOG_DATA_DIR: tmpDir,
          PERSISTENCE_MODE: 'json',
        },
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      assert.strictEqual(sha256File(realDb), shaDbBefore, 'Test must NEVER modify real data/db.json');
      assert.strictEqual(
        sha256File(realSessions),
        shaSessBefore,
        'Test must NEVER modify real data/sessions.json'
      );
    }
  });
}
