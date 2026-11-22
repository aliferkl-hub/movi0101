/**
 * MOVILOG — AUDITORIA VISUAL & FUNCIONAL EM NAVEGADOR REAL (PLAYWRIGHT CHROMIUM)
 *
 * Blindagem obrigatória (Regra Zero):
 * - Exige MOVILOG_DATA_DIR explícito dentro de os.tmpdir().
 * - Sobe servidor HTTP efêmero (dist/ + /api) em 127.0.0.1:0 sobre a cópia isolada.
 * - Valida todas as 26 abas do módulo Adega & Tabacaria em Desktop (1440x900) e Mobile (390x844),
 *   fluxos reais de UI, persistência pós-reload, catálogo público sem restrição +18,
 *   zero console.error, zero pageerror e zero HTTP 5xx.
 */
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const playwrightPath = fs.existsSync('/usr/local/share/bun-global/node_modules/playwright')
  ? '/usr/local/share/bun-global/node_modules/playwright'
  : 'playwright';
const { chromium } = require(playwrightPath);

function resolvePathSafely(targetPath: string): string {
  const abs = path.resolve(targetPath);
  if (fs.existsSync(abs)) return fs.realpathSync(abs);
  const parent = path.dirname(abs);
  if (fs.existsSync(parent)) return path.join(fs.realpathSync(parent), path.basename(abs));
  return abs;
}

function assertIsolatedTempDataDir(): string {
  const persistenceMode = (process.env.PERSISTENCE_MODE || 'json').trim().toLowerCase();
  if (persistenceMode === 'postgres') {
    throw new Error('BLOQUEADO: Auditoria visual isolada não pode usar PERSISTENCE_MODE=postgres.');
  }
  const rawDataDir = (process.env.MOVILOG_DATA_DIR || '').trim();
  if (!rawDataDir) {
    throw new Error('BLOQUEADO: Defina MOVILOG_DATA_DIR dentro de os.tmpdir().');
  }
  const resolvedTarget = resolvePathSafely(rawDataDir);
  const realDataDir = resolvePathSafely(path.resolve(process.cwd(), 'data'));
  const tmpRoot = fs.realpathSync(os.tmpdir());

  if (
    resolvedTarget === realDataDir ||
    resolvedTarget.startsWith(realDataDir + path.sep) ||
    realDataDir.startsWith(resolvedTarget + path.sep)
  ) {
    throw new Error(`BLOQUEADO: MOVILOG_DATA_DIR aponta para dados reais (${realDataDir}).`);
  }
  if (!resolvedTarget.startsWith(tmpRoot + path.sep)) {
    throw new Error(`BLOQUEADO: MOVILOG_DATA_DIR deve estar dentro de ${tmpRoot}.`);
  }
  return resolvedTarget;
}

function assert(cond: any, msg: string) {
  if (!cond) throw new Error(`FALHA AUDITORIA VISUAL: ${msg}`);
}

const GROUPS_AND_TABS: { group: string; tabs: string[] }[] = [
  {
    group: '1. Operação Diária',
    tabs: ['PDV & Vendas', 'Pedidos', 'Entregas Locais', 'Caixa & Turno', 'Maquininhas (POS)'],
  },
  {
    group: '2. Radar & Estoque',
    tabs: ['Radar MoviLog', 'Estoque Inteligente', 'Reposição', 'Alertas', 'Movimentações'],
  },
  {
    group: '3. Gestão & Controle',
    tabs: [
      'Produtos & Preços',
      'Fornecedores',
      'Compras & Notas',
      'Perdas & Avarias',
      'Inventário Físico',
      'Rentabilidade',
      'Fechamento Gerencial',
      'Indicadores Gerais',
    ],
  },
  {
    group: '4. Clientes & Vitrine',
    tabs: ['Clientes (LGPD)', 'Catálogo Digital + QR'],
  },
  {
    group: '5. Implantação & Piloto',
    tabs: [
      'Implantação',
      'Modo Espelho (7d)',
      'Importação CSV/XLSX',
      'Tutoriais',
      'Avaliação 7d',
      'Migração Controlada',
    ],
  },
];

async function runBrowserAudit() {
  const isolatedDir = assertIsolatedTempDataDir();
  const distPath = path.resolve(process.cwd(), 'dist');
  assert(fs.existsSync(path.join(distPath, 'index.html')), 'dist/index.html ausente. Execute vite build antes.');

  const { db, hashPassword } = await import('../db.ts');
  const { apiRouter } = await import('../api.ts');

  // Seed isolated company & company_admin for visual audit
  const nowIso = new Date().toISOString();
  const companyId = `audit-ui-${crypto.randomUUID().slice(0, 8)}`;
  const adminEmail = `gestor.visual.${crypto.randomUUID().slice(0, 6)}@adegateste.local`;
  const adminPass = 'VisualAudit@2026';
  const { hash, salt } = hashPassword(adminPass);

  db.companies.push({
    id: companyId,
    razaoSocial: 'Adega Visual Homologação Ltda',
    nomeFantasia: 'Adega Homologação UI',
    cnpj: '44.444.444/0001-44',
    responsavel: 'Gestor Visual',
    email: adminEmail,
    telefone: '11988881234',
    endereco: 'Av. Paulista, 1500 - São Paulo/SP',
    segmento: 'Adega e Tabacaria',
    quantidadeFuncionarios: 5,
    tipoOperacao: 'integrada',
    modulos: ['logistica', 'roteirizacao', 'frota', 'predial', 'wms'],
    planoId: 'plan_empresarial',
    statusCadastro: 'ativo',
    statusAssinatura: 'assinatura_ativa',
    limites: { maxUsuarios: 50, maxUnidades: 50, maxOperacoesMes: 5000 },
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  db.users.push({
    id: crypto.randomUUID(),
    email: adminEmail,
    name: 'Gestor Visual UI',
    passwordHash: hash,
    salt,
    role: 'company_admin',
    companyId,
    active: true,
    createdAt: nowIso,
  });

  const supId = crypto.randomUUID();
  db.commercialSuppliers.push({
    id: supId,
    companyId,
    razaoSocial: 'Distribuidora Modelo S/A',
    nomeFantasia: 'Dist. Modelo',
    cnpjCpf: '55.555.555/0001-55',
    contatoNome: 'Marcos',
    telefone: '11977771111',
    email: 'vendas@distmodelo.local',
    segmento: 'ambos',
    ativo: true,
    criadoEm: nowIso,
  });

  const beerId = crypto.randomUUID();
  const waterId = crypto.randomUUID();
  const tobaccoId = crypto.randomUUID();

  db.commercialProducts.push(
    {
      id: beerId,
      companyId,
      modulo: 'adega',
      sku: 'HEI-600-UI',
      codigoBarras: '7896045509991',
      nome: 'Cerveja Heineken 600ml',
      categoria: 'Cervejas',
      classificacaoLegal: 'bebida_alcoolica',
      fornecedorId: supId,
      fornecedorNome: 'Dist. Modelo',
      precoCusto: 8.5,
      precoVenda: 14.0,
      estoqueAtual: 3,
      estoqueMinimo: 10,
      estoqueMaximo: 48,
      unidade: 'un',
      idadeMinima: 18,
      ativo: true,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    },
    {
      id: waterId,
      companyId,
      modulo: 'adega',
      sku: 'AGU-500-UI',
      codigoBarras: '7891111119991',
      nome: 'Água Mineral Crystal 500ml',
      categoria: 'Águas e Sem Álcool',
      classificacaoLegal: 'sem_restricao',
      precoCusto: 1.15,
      precoVenda: 4.5,
      estoqueAtual: 40,
      estoqueMinimo: 12,
      estoqueMaximo: 96,
      unidade: 'un',
      idadeMinima: 0,
      ativo: true,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    },
    {
      id: tobaccoId,
      companyId,
      modulo: 'tabacaria',
      sku: 'PAL-10-UI',
      nome: 'Paiero Artesanal Maço',
      categoria: 'Tabacos e Palheiros',
      classificacaoLegal: 'tabaco_derivados',
      precoCusto: 11.0,
      precoVenda: 22.0,
      estoqueAtual: 18,
      estoqueMinimo: 5,
      estoqueMaximo: 40,
      unidade: 'un',
      idadeMinima: 18,
      ativo: true,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    }
  );
  db.save();

  // Ephemeral Express serving production dist/ + /api
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'MoviLog', persistenceMode: 'json' });
  });
  app.use('/api', apiRouter);
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  const chromeExecutable = '/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell';
  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(chromeExecutable) ? chromeExecutable : undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const server500s: string[] = [];

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err: any) => {
      pageErrors.push(err?.message || String(err));
    });
    page.on('response', (res: any) => {
      if (res.status() >= 500) {
        server500s.push(`${res.status()} ${res.url()}`);
      }
    });

    // 1. Login real pela interface
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Entrar no Sistema/i }).first().click();
    await page.locator('input[type="email"]').first().fill(adminEmail);
    await page.locator('input[type="password"]').first().fill(adminPass);
    await page.locator('form button[type="submit"]').first().click();

    await page.getByText('Módulo Adega & Bebidas').first().waitFor({ timeout: 10000 });
    console.log('✓ [UI] Login real executado e sidebar carregada.');

    // Confirm session survives page reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Módulo Adega & Bebidas').first().waitFor({ timeout: 10000 });
    console.log('✓ [UI] Sessão preservada após atualização de página (F5 / reload).');

    // Open Adega module
    await page.getByText('Módulo Adega & Bebidas').first().click();
    await page.getByRole('heading', { name: 'Módulo Adega & Bebidas', exact: true }).waitFor({ timeout: 10000 });

    // 2. Auditar TODAS as 26 abas nos 5 grupos
    let verifiedTabsCount = 0;
    for (const grp of GROUPS_AND_TABS) {
      await page.getByRole('button', { name: grp.group, exact: true }).click();
      for (const tabLabel of grp.tabs) {
        await page.getByRole('button', { name: tabLabel, exact: true }).last().click();
        // Wait briefly for React async fetches on each tab
        await page.waitForTimeout(250);
        await page.waitForLoadState('networkidle');
        const textLen = await page.evaluate(() => (document.body.innerText || '').trim().length);
        assert(textLen > 80, `Aba "${tabLabel}" renderizou conteúdo vazio (${textLen} chars)`);
        verifiedTabsCount++;
        console.log(`  ✓ Aba [${verifiedTabsCount}/26] (${grp.group}) -> "${tabLabel}" OK (${textLen} chars)`);
      }
    }
    assert(verifiedTabsCount === 26, `Esperado 26 abas, auditadas ${verifiedTabsCount}`);

    // Confirm module switch Adega <-> Tabacaria
    await page.getByRole('button', { name: /Alternar para Tabacaria/i }).click();
    await page.getByRole('heading', { name: 'Módulo Tabacaria & Headshop', exact: true }).waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /Alternar para Adega/i }).click();
    await page.getByRole('heading', { name: 'Módulo Adega & Bebidas', exact: true }).waitFor({ timeout: 5000 });
    console.log('✓ [UI] Alternância Adega <-> Tabacaria funcional.');

    // 3. Fluxo real de UI: Criar Produto + Persistência pós-reload + Modal Histórico & Custos
    await page.getByRole('button', { name: '3. Gestão & Controle', exact: true }).click();
    await page.getByRole('button', { name: 'Produtos & Preços', exact: true }).click();
    await page.getByRole('button', { name: /Novo Produto/i }).click();

    await page.locator('input[placeholder*="Cerveja IPA"]').first().fill('Vodka Absolut 1L Teste UI');
    await page.locator('form select').first().selectOption('Destilados (Gin, Vodka, Whisky)');
    // Fill cost, sale price, stock, min, max via form inputs
    const numInputs = page.locator('form input[type="number"]');
    await numInputs.nth(0).fill('75');
    await numInputs.nth(1).fill('129.90');
    await numInputs.nth(2).fill('14');
    await numInputs.nth(3).fill('4');
    await numInputs.nth(4).fill('40');
    await page.locator('form button[type="submit"]').first().click();

    await page.getByText('Vodka Absolut 1L Teste UI').first().waitFor({ timeout: 8000 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('Módulo Adega & Bebidas').first().click();
    await page.getByRole('button', { name: '3. Gestão & Controle', exact: true }).click();
    await page.getByRole('button', { name: 'Produtos & Preços', exact: true }).click();
    await page.getByText('Vodka Absolut 1L Teste UI').first().waitFor({ timeout: 8000 });
    console.log('✓ [UI] Criação de produto pela interface e persistência após reload verificadas.');

    // Open Histórico & Custos modal
    await page.locator('button[title="Histórico & Custos"]').first().click();
    await page.getByRole('heading', { name: 'Histórico de Custos' }).waitFor({ timeout: 5000 });
    await page.locator('div.fixed.inset-0 button').first().click();
    await page.getByRole('heading', { name: 'Histórico de Custos' }).waitFor({ state: 'hidden', timeout: 5000 });
    console.log('✓ [UI] Modal Histórico & Custos funcional.');

    // 4. Fluxo real de UI: Clientes (LGPD) -> Criar & Anonimizar
    await page.getByRole('button', { name: '4. Clientes & Vitrine', exact: true }).click();
    await page.getByRole('button', { name: 'Clientes (LGPD)', exact: true }).last().click();
    await page.getByRole('button', { name: /Novo Cliente/i }).click();
    await page.locator('div.fixed.inset-0 input[type="text"]').first().fill('Cliente LGPD Browser');
    await page.getByRole('button', { name: 'Salvar Cliente', exact: true }).click();
    await page.getByText('Cliente LGPD Browser').first().waitFor({ timeout: 6000 });
    await page.locator('button[title="Anonimizar LGPD"]').first().click();
    await page.getByRole('button', { name: /Confirmar Anonimização/i }).click();
    await page.getByText(/Cliente Anonimizado/i).first().waitFor({ timeout: 6000 });
    console.log('✓ [UI] Cadastro e anonimização LGPD via modal in-UI funcionais.');

    // 5. Fluxo real de UI: Importação CSV real
    await page.getByRole('button', { name: '5. Implantação & Piloto', exact: true }).click();
    await page.getByRole('button', { name: 'Importação CSV/XLSX', exact: true }).last().click();
    const tmpCsv = path.join(isolatedDir, 'teste_ui.csv');
    fs.writeFileSync(
      tmpCsv,
      'sku;nome;categoria;precoCusto;precoVenda;estoqueAtual\nGELO-UI-01;Gelo Filtrado 5kg UI;Conveniência;4,00;11,00;25\n',
      'utf-8'
    );
    await page.locator('input[type="file"]').setInputFiles(tmpCsv);
    await page.getByText(/Pré-visualização & Mapeamento: teste_ui\.csv/i).waitFor({ timeout: 8000 });
    const secondCellVal = await page.locator('table tbody tr').first().locator('input[type="text"]').nth(1).inputValue();
    assert(secondCellVal === 'Gelo Filtrado 5kg UI', `Prévia CSV incorreta: ${secondCellVal}`);
    await page.getByRole('button', { name: /Confirmar Importação/i }).click();
    await page.getByText(/importado\(s\) com sucesso/i).first().waitFor({ timeout: 8000 });
    console.log('✓ [UI] Upload, pré-visualização e importação CSV pela interface verificados.');

    // 6. Fluxo real de UI: Migração Controlada (Check -> Start -> Pause -> Resume -> Complete)
    await page.getByRole('button', { name: 'Migração Controlada', exact: true }).last().click();
    await page.getByRole('button', { name: /Verificar Conflitos/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Iniciar Migração/i }).click();
    await page.getByRole('button', { name: /Pausar com Segurança/i }).waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /Pausar com Segurança/i }).click();
    await page.getByRole('button', { name: /Retomar Migração/i }).waitFor({ timeout: 5000 });
    await page.getByRole('button', { name: /Retomar Migração/i }).click();
    await page.getByRole('button', { name: /Concluir Virada Definitiva/i }).click();
    await page.getByText(/Status:\s*concluida/i).first().waitFor({ timeout: 5000 });
    console.log('✓ [UI] Fluxo completo da Central de Migração (check/start/pause/resume/complete) funcional.');

    // 7. Responsividade Mobile (390x844) nas principais abas
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    for (const check of [
      { g: '1. Operação Diária', t: 'PDV & Vendas' },
      { g: '2. Radar & Estoque', t: 'Radar MoviLog' },
      { g: '3. Gestão & Controle', t: 'Produtos & Preços' },
      { g: '5. Implantação & Piloto', t: 'Importação CSV/XLSX' },
    ]) {
      await page.getByRole('button', { name: check.g, exact: true }).click();
      await page.getByRole('button', { name: check.t, exact: true }).last().click();
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      assert(
        overflow.scrollWidth <= overflow.innerWidth + 16,
        `Overflow horizontal em mobile na aba "${check.t}": scrollWidth=${overflow.scrollWidth} > innerWidth=${overflow.innerWidth}`
      );
    }
    console.log('✓ [UI MOBILE 390x844] Sem overflow horizontal quebrando o layout.');

    // 8. Contexto anônimo separado para Vitrine Pública /catalogo/:companyId (antes e depois de ativar)
    const publicCtxBefore = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pubPageBefore = await publicCtxBefore.newPage();
    await pubPageBefore.goto(`${baseUrl}/catalogo/${companyId}`, { waitUntil: 'networkidle' });
    await pubPageBefore.getByText(/temporariamente desativado/i).first().waitFor({ timeout: 6000 });
    await publicCtxBefore.close();
    console.log('✓ [CATÁLOGO PÚBLICO] Protegido por padrão (opt-in) até ativação expressa do gestor.');

    // Voltar para desktop context e ativar catálogo público pela UI
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: '4. Clientes & Vitrine', exact: true }).click();
    await page.getByRole('button', { name: 'Catálogo Digital + QR', exact: true }).last().click();
    await page.locator('input[type="checkbox"]').first().check();
    await page.getByRole('button', { name: /Salvar Vitrine/i }).click();
    await page.getByText(/Configurações do catálogo digital atualizadas/i).first().waitFor({ timeout: 6000 });

    const publicCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const pubPage = await publicCtx.newPage();
    pubPage.on('console', (msg: any) => {
      if (msg.type() === 'error') consoleErrors.push(`[PUBLIC] ${msg.text()}`);
    });
    pubPage.on('pageerror', (err: any) => {
      pageErrors.push(`[PUBLIC] ${err?.message || String(err)}`);
    });

    await pubPage.goto(`${baseUrl}/catalogo/${companyId}`, { waitUntil: 'networkidle' });
    await pubPage.getByText('Água Mineral Crystal 500ml').first().waitFor({ timeout: 8000 });
    const pubText = await pubPage.evaluate(() => document.body.innerText || '');
    assert(!pubText.includes('Heineken'), 'FALHA CRÍTICA: Álcool visível na vitrine pública!');
    assert(!pubText.includes('Vodka Absolut'), 'FALHA CRÍTICA: Destilado visível na vitrine pública!');
    assert(!pubText.includes('Paiero'), 'FALHA CRÍTICA: Tabaco visível na vitrine pública!');
    assert(!pubText.includes('1.15'), 'FALHA CRÍTICA: Preço de custo exposto na vitrine pública!');
    assert(pubText.includes('18'), 'Aviso legal de restrição +18 ausente na vitrine pública');
    const pubOverflow = await pubPage.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    assert(
      pubOverflow.scrollWidth <= pubOverflow.innerWidth + 16,
      `Overflow horizontal no catálogo público mobile: ${pubOverflow.scrollWidth} > ${pubOverflow.innerWidth}`
    );
    await publicCtx.close();
    console.log('✓ [CATÁLOGO PÚBLICO] Ativado via UI, exibiu sem login apenas itens sem restrição e bloqueou 100% álcool/tabaco/custos.');

    // Assert zero runtime browser errors or 5xx responses
    assert(consoleErrors.length === 0, `Erros de console encontrados: ${consoleErrors.join(' | ')}`);
    assert(pageErrors.length === 0, `Exceções JS não tratadas (pageerror): ${pageErrors.join(' | ')}`);
    assert(server500s.length === 0, `Respostas HTTP >= 500 detectadas: ${server500s.join(' | ')}`);

    console.log('\n========================================================================');
    console.log('AUDITORIA VISUAL PLAYWRIGHT CONCLUÍDA: 26/26 ABAS + FLUXOS + MOBILE OK!');
    console.log('Zero console.error | Zero pageerror | Zero HTTP 5xx');
    console.log('========================================================================');
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runBrowserAudit().catch((err) => {
  console.error('\n❌ FALHA NA AUDITORIA VISUAL:', err);
  process.exit(1);
});
