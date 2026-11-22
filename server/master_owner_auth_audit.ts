/**
 * MOVILOG — SUÍTE DE AUDITORIA CRÍTICA DO MASTER OWNER (MODO ISOLADO)
 *
 * Blindagem obrigatória:
 * - Recusa execução caso PERSISTENCE_MODE=postgres.
 * - Exige MOVILOG_DATA_DIR explícito apontando para um subdiretório temporário dentro de os.tmpdir().
 * - Falha imediatamente com mensagem clara se apontar para ./data ou qualquer diretório fora de os.tmpdir().
 * - Nunca faz requisições ao servidor ativo na porta 3000; sobe servidor HTTP efêmero em 127.0.0.1:0
 *   ligado exclusivamente à cópia isolada em MOVILOG_DATA_DIR.
 */
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';

function resolvePathSafely(targetPath: string): string {
  const abs = path.resolve(targetPath);
  if (fs.existsSync(abs)) {
    return fs.realpathSync(abs);
  }
  const parent = path.dirname(abs);
  if (fs.existsSync(parent)) {
    return path.join(fs.realpathSync(parent), path.basename(abs));
  }
  return abs;
}

function assertIsolatedTempDataDir(): string {
  const persistenceMode = (process.env.PERSISTENCE_MODE || 'json').trim().toLowerCase();
  if (persistenceMode === 'postgres') {
    throw new Error(
      'BLOQUEADO: server/master_owner_auth_audit.ts não pode executar com PERSISTENCE_MODE=postgres. Utilize persistência JSON em diretório temporário isolado.'
    );
  }

  const rawDataDir = (process.env.MOVILOG_DATA_DIR || '').trim();
  if (!rawDataDir) {
    throw new Error(
      'BLOQUEADO: MOVILOG_DATA_DIR não definido. Esta suíte recusa operar sobre os dados reais (./data). Informe um diretório temporário isolado dentro do diretório temporário do sistema.'
    );
  }

  const resolvedTarget = resolvePathSafely(rawDataDir);
  const realDataDir = resolvePathSafely(path.resolve(process.cwd(), 'data'));
  const tmpRoot = fs.realpathSync(os.tmpdir());

  if (
    resolvedTarget === realDataDir ||
    resolvedTarget.startsWith(realDataDir + path.sep) ||
    realDataDir.startsWith(resolvedTarget + path.sep)
  ) {
    throw new Error(
      `BLOQUEADO: MOVILOG_DATA_DIR (${resolvedTarget}) aponta para o diretório de dados reais (${realDataDir}). Execução abortada para proteger o banco ativo.`
    );
  }

  if (!resolvedTarget.startsWith(tmpRoot + path.sep)) {
    throw new Error(
      `BLOQUEADO: MOVILOG_DATA_DIR (${resolvedTarget}) deve estar estritamente dentro do diretório temporário isolado (${tmpRoot}).`
    );
  }

  const isolatedDbFile = path.join(resolvedTarget, 'db.json');
  if (!fs.existsSync(isolatedDbFile)) {
    throw new Error(
      `BLOQUEADO: Arquivo db.json não encontrado no diretório temporário isolado (${isolatedDbFile}). Copie uma massa de teste antes de executar.`
    );
  }

  return resolvedTarget;
}

interface TestResult {
  testId: string;
  name: string;
  success: boolean;
  details: string;
}

async function runMasterAuthAudit() {
  const isolatedDir = assertIsolatedTempDataDir();

  // Configurar chave de recuperação efêmera exclusivamente em memória para este processo isolado
  const ephemeralRecoveryKey = `TestAuditKey-${crypto.randomBytes(16).toString('hex')}`;
  process.env.MASTER_RECOVERY_KEY = ephemeralRecoveryKey;

  const {
    db,
    createSession,
    destroySession,
    ORIGINAL_MASTER_OWNER_ID,
    ORIGINAL_MASTER_OWNER_EMAIL,
    assertMasterOwnerSingleton,
  } = await import('./db.ts');
  const { apiRouter, _resetMasterRecoveryRateLimitForTesting } = await import('./api.ts');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Falha ao inicializar servidor HTTP isolado para auditoria.');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  console.log('================================================================');
  console.log(`🛡️ INICIANDO AUDITORIA CRÍTICA ISOLADA — MASTER OWNER (${isolatedDir})`);
  console.log('================================================================\n');

  const secondaryEmailGoogle = 'alifergael76@gmail.com';
  const ephemeralPasswordA = `AuditTmp#${crypto.randomBytes(8).toString('hex')}!1a`;
  const ephemeralPasswordB = `AuditTmp#${crypto.randomBytes(8).toString('hex')}!2b`;
  const results: TestResult[] = [];

  let masterSessionToken = '';
  let normalUserSessionToken = '';
  const initialUsersCount = db.users.length;
  const initialCompaniesCount = db.companies.length;

  try {
    // Preparar senha temporária somente na cópia isolada via fluxo oficial de recuperação
    {
      _resetMasterRecoveryRateLimitForTesting();
      const prepRes = await fetch(`${baseUrl}/api/auth/master-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ORIGINAL_MASTER_OWNER_EMAIL,
          recoveryKey: ephemeralRecoveryKey,
          newPassword: ephemeralPasswordA,
          confirmPassword: ephemeralPasswordA,
        }),
      });
      if (!prepRes.ok) {
        throw new Error(`Falha ao preparar credencial efêmera na cópia isolada: HTTP ${prepRes.status}`);
      }
    }

    // ------------------------------------------------------------------------
    // TESTE 1: Login com credencial válida do Master Owner oficial
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ORIGINAL_MASTER_OWNER_EMAIL,
          password: ephemeralPasswordA,
        }),
      });
      const data = await res.json();
      const pass =
        res.ok &&
        Boolean(data.token) &&
        data.user?.role === 'master_owner' &&
        data.user?.id === ORIGINAL_MASTER_OWNER_ID;
      if (pass) masterSessionToken = data.token;

      results.push({
        testId: 'TESTE 1',
        name: 'Login com credencial válida do Master Owner oficial',
        success: pass,
        details: pass
          ? `Autenticado via POST /api/auth/login na cópia isolada. ID: ${data.user.id}, Role: ${data.user.role}.`
          : `Falha no login: HTTP ${res.status}`,
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 2: Login com senha incorreta
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ORIGINAL_MASTER_OWNER_EMAIL,
          password: 'SenhaTotalmenteIncorreta123!',
        }),
      });
      const data = await res.json();
      const pass = res.status === 401 && data.error === 'Credenciais inválidas';

      results.push({
        testId: 'TESTE 2',
        name: 'Login com senha incorreta',
        success: pass,
        details: pass
          ? `Senha incorreta rejeitada com HTTP 401: "${data.error}".`
          : `Status esperado 401, obtido ${res.status}.`,
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 3: Persistência da sessão
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${masterSessionToken}` },
      });
      const data = await res.json();
      const pass =
        res.ok &&
        data.user?.role === 'master_owner' &&
        data.user?.id === ORIGINAL_MASTER_OWNER_ID;

      results.push({
        testId: 'TESTE 3',
        name: 'Persistência da sessão',
        success: pass,
        details: pass
          ? `Sessão validada em GET /api/auth/me para Master Owner ID: ${data.user.id}.`
          : `Falha ao validar sessão: HTTP ${res.status}`,
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 4: Atualização da página mantendo autenticação válida
    // ------------------------------------------------------------------------
    {
      const req1 = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${masterSessionToken}` },
      });
      const req2 = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${masterSessionToken}` },
      });
      const data1 = await req1.json();
      const data2 = await req2.json();
      const pass =
        req1.ok &&
        req2.ok &&
        data1.user?.id === data2.user?.id &&
        data1.user?.role === 'master_owner';

      results.push({
        testId: 'TESTE 4',
        name: 'Atualização da página mantendo autenticação válida',
        success: pass,
        details: pass
          ? 'Sessão sobrevive a consultas consecutivas sem invalidar.'
          : 'Falha no refresh de sessão.',
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 5: Logout e invalidação da sessão
    // ------------------------------------------------------------------------
    {
      const tempRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ORIGINAL_MASTER_OWNER_EMAIL,
          password: ephemeralPasswordA,
        }),
      });
      const tempData = await tempRes.json();
      const tempToken = tempData.token;

      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tempToken}` },
      });

      const afterLogoutRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tempToken}` },
      });
      const pass = logoutRes.ok && afterLogoutRes.status === 401;

      results.push({
        testId: 'TESTE 5',
        name: 'Logout e invalidação da sessão',
        success: pass,
        details: pass
          ? 'Logout executado e token invalidado definitivamente (HTTP 401 pós-logout).'
          : 'Token não foi invalidado após logout.',
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 6: Acesso ao painel Master Owner (/master/stats)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/master/stats`, {
        headers: { Authorization: `Bearer ${masterSessionToken}` },
      });
      const data = await res.json();
      const pass =
        res.ok &&
        (typeof data.totalCompanies === 'number' || typeof data.totalEmpresas === 'number') &&
        (typeof data.totalUsers === 'number' || typeof data.totalUsuarios === 'number');

      results.push({
        testId: 'TESTE 6',
        name: 'Acesso ao painel Master Owner',
        success: pass,
        details: pass
          ? `Painel Master liberado (HTTP 200). Empresas: ${data.totalCompanies ?? data.totalEmpresas}, Usuários: ${data.totalUsers ?? data.totalUsuarios}.`
          : `Falha ao acessar painel Master: HTTP ${res.status}`,
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 7: Autorização para visualizar todas as empresas (/master/companies)
    // ------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/master/companies`, {
        headers: { Authorization: `Bearer ${masterSessionToken}` },
      });
      const data = await res.json();
      const pass = res.ok && Array.isArray(data.companies) && data.companies.length >= 1;

      results.push({
        testId: 'TESTE 7',
        name: 'Autorização para visualizar empresas',
        success: pass,
        details: pass
          ? `Master Owner visualiza todas as ${data.companies.length} empresas na cópia isolada.`
          : `Falha ao consultar empresas: HTTP ${res.status}`,
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 8: Bloqueio de acesso administrativo para usuário comum
    // ------------------------------------------------------------------------
    {
      const normalUser = db.users.find((u) => u.role === 'driver' || u.role === 'operator');
      if (normalUser) {
        normalUserSessionToken = createSession(normalUser.id);
        const res = await fetch(`${baseUrl}/api/master/stats`, {
          headers: { Authorization: `Bearer ${normalUserSessionToken}` },
        });
        const data = await res.json();
        const pass = res.status === 403 && Boolean(data.error?.includes('Acesso restrito'));

        results.push({
          testId: 'TESTE 8',
          name: 'Bloqueio de acesso administrativo para usuário comum',
          success: pass,
          details: pass
            ? `Usuário comum (${normalUser.role}) bloqueado com HTTP 403.`
            : `Falha: usuário comum recebeu status ${res.status}.`,
        });
      }
    }

    // ------------------------------------------------------------------------
    // TESTE 9: Isolamento multiempresa preservado
    // ------------------------------------------------------------------------
    {
      if (normalUserSessionToken) {
        const res = await fetch(`${baseUrl}/api/master/companies`, {
          headers: { Authorization: `Bearer ${normalUserSessionToken}` },
        });
        const pass = res.status === 403;

        results.push({
          testId: 'TESTE 9',
          name: 'Isolamento multiempresa preservado',
          success: pass,
          details: pass
            ? 'Usuário comum barrado com HTTP 403 em /api/master/companies.'
            : `Falha: status inesperado ${res.status}.`,
        });
      }
    }

    // ------------------------------------------------------------------------
    // TESTE 10: Recuperação oficial exclusiva da conta principal + revogação de sessões
    // ------------------------------------------------------------------------
    {
      _resetMasterRecoveryRateLimitForTesting();
      const res = await fetch(`${baseUrl}/api/auth/master-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ORIGINAL_MASTER_OWNER_EMAIL,
          recoveryKey: ephemeralRecoveryKey,
          newPassword: ephemeralPasswordB,
          confirmPassword: ephemeralPasswordB,
        }),
      });
      const data = await res.json();
      const recoveryOk = res.ok && data.success === true && !('token' in data);

      const oldSessionCheck = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${masterSessionToken}` },
      });
      const oldSessionRevoked = oldSessionCheck.status === 401;

      const loginNew = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: ORIGINAL_MASTER_OWNER_EMAIL,
          password: ephemeralPasswordB,
        }),
      });
      const loginData = await loginNew.json();
      const loginOk =
        loginNew.ok &&
        loginData.user?.role === 'master_owner' &&
        loginData.user?.id === ORIGINAL_MASTER_OWNER_ID;

      const pass = recoveryOk && oldSessionRevoked && loginOk;
      results.push({
        testId: 'TESTE 10',
        name: 'Recuperação oficial exclusiva para conta principal e revogação de sessões',
        success: pass,
        details: pass
          ? 'Recuperação oficial atualizou somente a conta principal, revogou sessões antigas e validou login subsequente.'
          : `Falha na recuperação isolada (recovery=${res.status}, oldSession=${oldSessionCheck.status}, login=${loginNew.status}).`,
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 11: Bloqueio de recuperação para contas secundárias e não autorizadas
    // ------------------------------------------------------------------------
    {
      _resetMasterRecoveryRateLimitForTesting();
      const secondaryRes = await fetch(`${baseUrl}/api/auth/master-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: secondaryEmailGoogle,
          recoveryKey: ephemeralRecoveryKey,
          newPassword: ephemeralPasswordB,
          confirmPassword: ephemeralPasswordB,
        }),
      });

      const fakeRes = await fetch(`${baseUrl}/api/auth/master-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'hacker.invasor@qualquer.com',
          recoveryKey: ephemeralRecoveryKey,
          newPassword: ephemeralPasswordB,
          confirmPassword: ephemeralPasswordB,
        }),
      });

      const pass = secondaryRes.status === 403 && fakeRes.status === 403;
      results.push({
        testId: 'TESTE 11',
        name: 'Bloqueio de recuperação para contas secundárias e não autorizadas',
        success: pass,
        details: pass
          ? 'Conta secundária e e-mail não autorizado barrados com HTTP 403.'
          : `Falha de bloqueio: secondary=${secondaryRes.status}, fake=${fakeRes.status}.`,
      });
    }

    // ------------------------------------------------------------------------
    // TESTE 12: Preservação do Singleton Master Owner e demais contas
    // ------------------------------------------------------------------------
    {
      assertMasterOwnerSingleton(db.users, db.systemConfig);
      const driverUser = db.users.find((u) => u.role === 'driver');
      const operatorUser = db.users.find((u) => u.role === 'operator');
      const secondaryUser = db.users.find(
        (u) => u.email.trim().toLowerCase() === secondaryEmailGoogle
      );
      const pass = Boolean(
        driverUser?.active &&
          operatorUser?.active &&
          secondaryUser?.role === 'viewer' &&
          db.users.length === initialUsersCount &&
          db.companies.length === initialCompaniesCount
      );

      results.push({
        testId: 'TESTE 12',
        name: 'Preservação do Singleton Master Owner e integridade operacional',
        success: pass,
        details: pass
          ? `Singleton preservado, conta secundária mantida como viewer, ${db.users.length} usuários e ${db.companies.length} empresas íntegros.`
          : 'Divergência detectada na integridade dos dados após a auditoria.',
      });
    }
  } finally {
    if (normalUserSessionToken) destroySession(normalUserSessionToken);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('\n================================================================');
  console.log('📊 RESULTADOS DA AUDITORIA ISOLADA DO MASTER OWNER:');
  console.log('================================================================\n');

  let passed = 0;
  results.forEach((r) => {
    const symbol = r.success ? '✅ [APROVADO]' : '❌ [FALHA]';
    console.log(`${symbol} ${r.testId} — ${r.name}`);
    console.log(`   └─ ${r.details}\n`);
    if (r.success) passed++;
  });

  console.log(
    `TOTAL: ${passed}/${results.length} testes aprovados (${Math.round((passed / results.length) * 100)}%)\n`
  );

  if (passed !== results.length) {
    process.exit(1);
  }
}

runMasterAuthAudit().catch((err) => {
  console.error('Erro fatal durante a auditoria isolada do Master Owner:', err.message || err);
  process.exit(1);
});
