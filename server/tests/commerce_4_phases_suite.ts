/**
 * MOVILOG — SUÍTE DE HOMOLOGAÇÃO COMPLETA DO MÓDULO ADEGA & TABACARIA (4 FASES)
 *
 * Blindagem obrigatória (Regra Zero):
 * - Exige MOVILOG_DATA_DIR explícito apontando para subdiretório dentro de os.tmpdir().
 * - Recusa executar contra ./data ou com PERSISTENCE_MODE=postgres.
 * - Sobe servidor HTTP efêmero em 127.0.0.1:0 conectado apenas à cópia isolada em /tmp.
 * - Preserva integralmente os dados originais de ./data/db.json (80 usuários, 24 empresas, Master Owner).
 */
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import * as XLSX from 'xlsx';

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
      'BLOQUEADO: Esta suíte não pode executar com PERSISTENCE_MODE=postgres. Use JSON em /tmp.'
    );
  }

  const rawDataDir = (process.env.MOVILOG_DATA_DIR || '').trim();
  if (!rawDataDir) {
    throw new Error(
      'BLOQUEADO: MOVILOG_DATA_DIR não definido. Informe um diretório temporário isolado em os.tmpdir().'
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
      `BLOQUEADO: MOVILOG_DATA_DIR (${resolvedTarget}) aponta para o diretório real (${realDataDir}).`
    );
  }

  if (!resolvedTarget.startsWith(tmpRoot + path.sep)) {
    throw new Error(
      `BLOQUEADO: MOVILOG_DATA_DIR (${resolvedTarget}) deve estar dentro de ${tmpRoot}.`
    );
  }

  const isolatedDbFile = path.join(resolvedTarget, 'db.json');
  if (!fs.existsSync(isolatedDbFile)) {
    throw new Error(
      `BLOQUEADO: Arquivo db.json não encontrado na cópia isolada (${isolatedDbFile}).`
    );
  }

  return resolvedTarget;
}

function assertCondition(cond: any, message: string) {
  if (!cond) {
    throw new Error(`FALHA NA ASSERÇÃO: ${message}`);
  }
}

async function httpJson(
  port: number,
  method: string,
  urlPath: string,
  body?: any,
  token?: string
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = String(Buffer.byteLength(payload));

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let data: any = raw;
          try {
            data = JSON.parse(raw);
          } catch {
            // keep text if non-JSON
          }
          resolve({ status: res.statusCode || 0, data });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSuite() {
  const isolatedDir = assertIsolatedTempDataDir();
  console.log('========================================================================');
  console.log('MOVILOG — HOMOLOGAÇÃO ISOLADA ADEGA & TABACARIA (4 FASES)');
  console.log(`Diretório isolado: ${isolatedDir}`);
  console.log('========================================================================\n');

  const {
    db,
    createSession,
    hashPassword,
    ORIGINAL_MASTER_OWNER_ID,
    ORIGINAL_MASTER_OWNER_EMAIL,
  } = await import('../db.ts');
  const { apiRouter } = await import('../api.ts');

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api', apiRouter);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  assertCondition(port > 0, 'Servidor efêmero não iniciou em 127.0.0.1');

  const results: { id: string; fase: string; name: string; status: 'OK' }[] = [];
  const pass = (id: string, fase: string, name: string) => {
    results.push({ id, fase, name, status: 'OK' });
    console.log(`✓ [${fase}] ${id} — ${name}`);
  };

  try {
    // ---------------------------------------------------------------------
    // PRÉ-CHECK: PRESERVAÇÃO DA BASE COPIADA (USUÁRIOS / EMPRESAS / MASTER)
    // ---------------------------------------------------------------------
    const initialUsersCount = db.users.length;
    const initialCompaniesCount = db.companies.length;
    const masterOwner = db.users.find((u) => u.id === ORIGINAL_MASTER_OWNER_ID);
    assertCondition(masterOwner, 'Master Owner oficial não encontrado na cópia');
    assertCondition(
      masterOwner!.email.trim().toLowerCase() === ORIGINAL_MASTER_OWNER_EMAIL.toLowerCase(),
      'E-mail do Master Owner divergente'
    );
    pass('T00', 'PRE-CHECK', `Base isolada íntegra (${initialUsersCount} usuários, ${initialCompaniesCount} empresas, Master Owner preservado)`);

    // Criar 2 empresas isoladas em /tmp para testar multi-tenant e RBAC sem afetar registros reais
    const nowIso = new Date().toISOString();
    const companyAId = `test-adega-a-${crypto.randomUUID().slice(0, 8)}`;
    const companyBId = `test-adega-b-${crypto.randomUUID().slice(0, 8)}`;

    db.companies.push(
      {
        id: companyAId,
        razaoSocial: 'Adega Teste A Ltda',
        nomeFantasia: 'Adega & Tabacaria Alpha',
        cnpj: '11.111.111/0001-11',
        responsavel: 'Gestor Alpha',
        email: 'alpha@adegateste.local',
        telefone: '11999990001',
        endereco: 'Rua A, 100 - São Paulo/SP',
        segmento: 'Adega e Tabacaria',
        quantidadeFuncionarios: 6,
        tipoOperacao: 'integrada',
        modulos: ['logistica'],
        planoId: 'plan_empresarial',
        statusCadastro: 'ativo',
        statusAssinatura: 'assinatura_ativa',
        limites: { maxUsuarios: 50, maxUnidades: 50, maxOperacoesMes: 5000 },
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: companyBId,
        razaoSocial: 'Adega Teste B Ltda',
        nomeFantasia: 'Adega & Tabacaria Beta',
        cnpj: '22.222.222/0001-22',
        responsavel: 'Gestor Beta',
        email: 'beta@adegateste.local',
        telefone: '11999990002',
        endereco: 'Rua B, 200 - São Paulo/SP',
        segmento: 'Adega e Tabacaria',
        quantidadeFuncionarios: 4,
        tipoOperacao: 'integrada',
        modulos: ['logistica'],
        planoId: 'plan_empresarial',
        statusCadastro: 'ativo',
        statusAssinatura: 'assinatura_ativa',
        limites: { maxUsuarios: 50, maxUnidades: 50, maxOperacoesMes: 5000 },
        createdAt: nowIso,
        updatedAt: nowIso,
      }
    );

    const { hash, salt } = hashPassword('SenhaTeste@2026');
    const adminAId = crypto.randomUUID();
    const driverAId = crypto.randomUUID();
    const adminBId = crypto.randomUUID();

    db.users.push(
      {
        id: adminAId,
        email: 'admin.alpha@adegateste.local',
        name: 'Admin Alpha',
        passwordHash: hash,
        salt,
        role: 'company_admin',
        companyId: companyAId,
        active: true,
        createdAt: nowIso,
      },
      {
        id: driverAId,
        email: 'driver.alpha@adegateste.local',
        name: 'Motorista Alpha',
        passwordHash: hash,
        salt,
        role: 'driver',
        companyId: companyAId,
        active: true,
        createdAt: nowIso,
      },
      {
        id: adminBId,
        email: 'admin.beta@adegateste.local',
        name: 'Admin Beta',
        passwordHash: hash,
        salt,
        role: 'company_admin',
        companyId: companyBId,
        active: true,
        createdAt: nowIso,
      }
    );
    db.save();

    const tokenA = createSession(adminAId);
    const tokenDriverA = createSession(driverAId);
    const tokenB = createSession(adminBId);

    // ---------------------------------------------------------------------
    // FASE 1 — RADAR, ESTOQUE INTELIGENTE, REPOSIÇÃO E ALERTAS
    // ---------------------------------------------------------------------
    const supRes = await httpJson(
      port,
      'POST',
      '/api/commerce/suppliers',
      {
        razaoSocial: 'Distribuidora Paulista de Bebidas Ltda',
        nomeFantasia: 'Dist. Paulista',
        cnpjCpf: '33.333.333/0001-33',
        contatoNome: 'Carlos',
        telefone: '11988887777',
        segmento: 'ambos',
      },
      tokenA
    );
    assertCondition(supRes.status === 201 && supRes.data.supplier?.id, 'Falha ao criar fornecedor');
    const supplierId = supRes.data.supplier.id;

    // Produto 1: Álcool com estoque baixo para disparar reposição e alerta
    const prodBeerRes = await httpJson(
      port,
      'POST',
      '/api/commerce/products',
      {
        modulo: 'adega',
        sku: 'CER-HEI-600',
        codigoBarras: '7896045501234',
        nome: 'Cerveja Heineken 600ml',
        categoria: 'Cervejas',
        classificacaoLegal: 'bebida_alcoolica',
        fornecedorId: supplierId,
        fornecedorNome: 'Dist. Paulista',
        precoCusto: 8.5,
        precoVenda: 14.0,
        estoqueAtual: 4,
        estoqueMinimo: 10,
        estoqueMaximo: 48,
        unidade: 'un',
      },
      tokenA
    );
    assertCondition(prodBeerRes.status === 201 && prodBeerRes.data.product?.id, 'Falha ao criar Cerveja');
    const beerId = prodBeerRes.data.product.id;

    // Produto 2: Sem restrição (para vitrine pública e testes de vendas)
    const prodWaterRes = await httpJson(
      port,
      'POST',
      '/api/commerce/products',
      {
        modulo: 'adega',
        sku: 'AGU-CRY-500',
        codigoBarras: '7891111111111',
        nome: 'Água Mineral Crystal 500ml',
        categoria: 'Águas e Sem Álcool',
        classificacaoLegal: 'sem_restricao',
        precoCusto: 1.2,
        precoVenda: 4.0,
        estoqueAtual: 50,
        estoqueMinimo: 15,
        estoqueMaximo: 100,
        unidade: 'un',
      },
      tokenA
    );
    assertCondition(prodWaterRes.status === 201 && prodWaterRes.data.product?.id, 'Falha ao criar Água');
    const waterId = prodWaterRes.data.product.id;

    // Produto 3: Tabaco (+18)
    const prodTobaccoRes = await httpJson(
      port,
      'POST',
      '/api/commerce/products',
      {
        modulo: 'tabacaria',
        sku: 'TAB-PAL-10',
        nome: 'Paiero Artesanal Maço 10un',
        categoria: 'Tabacos e Palheiros',
        classificacaoLegal: 'tabaco_derivados',
        precoCusto: 12.0,
        precoVenda: 22.0,
        estoqueAtual: 20,
        estoqueMinimo: 5,
        estoqueMaximo: 40,
        unidade: 'un',
      },
      tokenA
    );
    assertCondition(prodTobaccoRes.status === 201 && prodTobaccoRes.data.product?.id, 'Falha ao criar Tabaco');
    const tobaccoId = prodTobaccoRes.data.product.id;

    // Smart stock antes de qualquer venda (deve indicar falta de histórico sem inventar giro)
    const smartBefore = await httpJson(port, 'GET', '/api/commerce/smart-stock', undefined, tokenA);
    assertCondition(smartBefore.status === 200, 'GET /smart-stock falhou');
    const beerSmartBefore = smartBefore.data.items.find((i: any) => i.product?.id === beerId);
    assertCondition(beerSmartBefore, 'Item cerveja ausente no smart-stock');
    assertCondition(
      beerSmartBefore.historicoSuficiente === false &&
        beerSmartBefore.consumoMedioDiario === null &&
        beerSmartBefore.diasCoberturaEstimada === null,
      'Smart Stock inventou consumo médio sem histórico de vendas!'
    );
    pass('T01', 'FASE 1', 'Estoque Inteligente não inventa números sem histórico (historicoSuficiente=false / null)');

    // Registrar venda real no PDV de Água para gerar histórico real de consumo
    const cashOpenRes = await httpJson(
      port,
      'POST',
      '/api/commerce/cash/open',
      { modulo: 'adega', saldoInicial: 100 },
      tokenA
    );
    assertCondition(cashOpenRes.status === 201, `Falha ao abrir caixa PDV: ${JSON.stringify(cashOpenRes.data)}`);

    for (let sIdx = 0; sIdx < 3; sIdx++) {
      const saleRes = await httpJson(
        port,
        'POST',
        '/api/commerce/sales',
        {
          modulo: 'adega',
          formaPagamento: 'dinheiro',
          maioridadeConfirmada: true,
          valorRecebidoDinheiro: 20,
          itens: [{ productId: waterId, quantidade: 2 }],
        },
        tokenA
      );
      assertCondition(saleRes.status === 201, `Falha ao registrar venda PDV ${sIdx + 1}: ${JSON.stringify(saleRes.data)}`);
    }

    const smartAfter = await httpJson(port, 'GET', '/api/commerce/smart-stock', undefined, tokenA);
    const waterSmartAfter = smartAfter.data.items.find((i: any) => i.product?.id === waterId);
    assertCondition(
      waterSmartAfter &&
        waterSmartAfter.historicoSuficiente === true &&
        typeof waterSmartAfter.consumoMedioDiario === 'number' &&
        waterSmartAfter.consumoMedioDiario > 0,
      'Smart Stock não calculou consumo real após 3 vendas registradas'
    );
    pass('T02', 'FASE 1', 'Estoque Inteligente calcula giro e cobertura reais após vendas no PDV (>= 3 registros reais)');

    // Radar MoviLog
    const radarRes = await httpJson(port, 'GET', '/api/commerce/radar', undefined, tokenA);
    assertCondition(radarRes.status === 200 && radarRes.data.resumo, 'GET /radar falhou');
    assertCondition(radarRes.data.resumo.itensCriticosCount >= 1, 'Radar não detectou cerveja abaixo do mínimo');
    pass('T03', 'FASE 1', 'Radar MoviLog consolida indicadores reais de saúde de estoque e margem');

    // Alertas & Resolução
    const alertsRes = await httpJson(port, 'GET', '/api/commerce/alerts', undefined, tokenA);
    assertCondition(alertsRes.status === 200 && alertsRes.data.alerts.length >= 1, 'Alertas não gerados automaticamente');
    const targetAlert = alertsRes.data.alerts[0];
    const resolveRes = await httpJson(
      port,
      'POST',
      `/api/commerce/alerts/${targetAlert.id}/resolve`,
      { motivoResolucao: 'Compra programada com fornecedor' },
      tokenA
    );
    assertCondition(resolveRes.status === 200 && resolveRes.data.alert.status === 'resolvido', 'Falha ao resolver alerta');
    pass('T04', 'FASE 1', 'Central de Alertas sincroniza alertas reais e registra resolução auditada');

    // Reposição -> gerar pedido de compra
    const repListRes = await httpJson(port, 'GET', '/api/commerce/replenishments', undefined, tokenA);
    assertCondition(repListRes.status === 200 && repListRes.data.replenishments.length >= 1, 'Sugestões de reposição não geradas');
    const beerRep = repListRes.data.replenishments.find((r: any) => r.productId === beerId);
    assertCondition(beerRep && beerRep.quantidadeSugerida > 0, 'Sugestão de reposição para Cerveja não calculada');

    const repReviewRes = await httpJson(
      port,
      'POST',
      `/api/commerce/replenishments/${beerRep.id}/review`,
      {
        acao: 'aprovar',
        quantidadeAprovada: 24,
        fornecedorId: supplierId,
        gerarPedidoCompra: true,
        observacoes: 'Reposição homologada',
      },
      tokenA
    );
    assertCondition(
      repReviewRes.status === 200 &&
        repReviewRes.data.replenishment.status === 'pedido_gerado' &&
        repReviewRes.data.purchase?.id,
      'Falha ao aprovar reposição e gerar pedido de compra'
    );
    const generatedPurchaseId = repReviewRes.data.purchase.id;
    pass('T05', 'FASE 1', 'Central de Reposição aprova sugestão e cria pedido de compra vinculado');

    // ---------------------------------------------------------------------
    // FASE 2 — RENTABILIDADE, RECEBIMENTO DE COMPRA, PERDAS, INVENTÁRIO E FECHAMENTO
    // ---------------------------------------------------------------------
    // Confirmar recebimento da compra gerada -> credita estoque (4 + 24 = 28)
    const recvRes = await httpJson(
      port,
      'PATCH',
      `/api/commerce/purchases/${generatedPurchaseId}/status`,
      { status: 'recebido', numeroNota: 'NF-998811' },
      tokenA
    );
    assertCondition(recvRes.status === 200 && recvRes.data.purchase.status === 'recebido', 'Falha ao receber compra');
    const prodHistRes = await httpJson(port, 'GET', `/api/commerce/products/${beerId}/history`, undefined, tokenA);
    assertCondition(prodHistRes.status === 200 && prodHistRes.data.product.estoqueAtual === 28, 'Estoque da cerveja não creditado no recebimento');
    assertCondition(prodHistRes.data.movements.length >= 1, 'Movimento de entrada_compra não registrado');
    pass('T06', 'FASE 2', 'Recebimento de compra credita estoque e grava rastreabilidade no produto');

    // Atualizar fornecedor e consultar histórico
    const supUpdRes = await httpJson(
      port,
      'PUT',
      `/api/commerce/suppliers/${supplierId}`,
      { prazoEntregaDias: 2, condicaoPagamento: '28 dias' },
      tokenA
    );
    assertCondition(supUpdRes.status === 200 && supUpdRes.data.supplier.prazoEntregaDias === 2, 'Falha ao atualizar fornecedor');
    const supHistRes = await httpJson(port, 'GET', `/api/commerce/suppliers/${supplierId}/history`, undefined, tokenA);
    assertCondition(supHistRes.status === 200 && supHistRes.data.totalCompras >= 1, 'Histórico do fornecedor não retornou compras');
    pass('T07', 'FASE 2', 'Fornecedor atualizado e histórico de compras auditado');

    // Perdas: rejeitar perda maior que estoque e aceitar perda válida
    const badLossRes = await httpJson(
      port,
      'POST',
      '/api/commerce/losses',
      { productId: beerId, tipo: 'avaria', quantidade: 9999, motivo: 'Teste negativo' },
      tokenA
    );
    assertCondition(badLossRes.status === 400, 'Sistema permitiu perda maior que o estoque disponível');

    const lossRes = await httpJson(
      port,
      'POST',
      '/api/commerce/losses',
      { productId: beerId, tipo: 'avaria', quantidade: 2, motivo: 'Garrafa quebrada no estoque' },
      tokenA
    );
    assertCondition(lossRes.status === 201 && lossRes.data.product.estoqueAtual === 26, 'Perda válida não abateu estoque corretamente');
    pass('T08', 'FASE 2', 'Controle de Perdas impede saldo negativo e apura impacto financeiro real');

    // Inventário Físico: criar -> registrar divergência -> aprovar ajuste
    const invCreateRes = await httpJson(
      port,
      'POST',
      '/api/commerce/inventories',
      { modulo: 'adega', observacoes: 'Contagem de homologação' },
      tokenA
    );
    assertCondition(invCreateRes.status === 201 && invCreateRes.data.inventory?.id, 'Falha ao abrir inventário');
    const invId = invCreateRes.data.inventory.id;

    const invCountRes = await httpJson(
      port,
      'PUT',
      `/api/commerce/inventories/${invId}/count`,
      {
        counts: [{ productId: beerId, saldoContado: 25, justificativa: '1 garrafa faltante na contagem física' }],
        finalizarConferencia: true,
      },
      tokenA
    );
    assertCondition(invCountRes.status === 200 && invCountRes.data.inventory.totalDivergencias === 1, 'Divergência no inventário não apurada');

    const invApproveRes = await httpJson(
      port,
      'POST',
      `/api/commerce/inventories/${invId}/approve`,
      { observacoes: 'Ajuste aprovado pela gerência' },
      tokenA
    );
    assertCondition(invApproveRes.status === 200 && invApproveRes.data.inventory.status === 'aprovado_ajustado', 'Falha ao aprovar inventário');
    const beerCheckAfterInv = await httpJson(port, 'GET', `/api/commerce/products/${beerId}/history`, undefined, tokenA);
    assertCondition(beerCheckAfterInv.data.product.estoqueAtual === 25, 'Saldo após aprovação de inventário não ajustado para 25');
    pass('T09', 'FASE 2', 'Inventário Físico calcula divergências e aplica ajuste auditado na aprovação');

    // Rentabilidade & Fechamento Gerencial (sem despesas cadastradas -> lucroLiquidoObservado === null)
    const today = nowIso.slice(0, 10);
    const profRes = await httpJson(
      port,
      'GET',
      `/api/commerce/profitability?dataInicio=${today}&dataFim=${today}`,
      undefined,
      tokenA
    );
    assertCondition(profRes.status === 200 && profRes.data.metrics, 'GET /profitability falhou');
    assertCondition(
      profRes.data.metrics.receitaTotal === 24 &&
        profRes.data.metrics.lucroLiquidoObservado === null &&
        typeof profRes.data.metrics.notaLucroLiquido === 'string',
      'Rentabilidade não respeitou transparência de lucroLiquidoObservado null sem despesas cadastradas'
    );

    const closingRes = await httpJson(
      port,
      'POST',
      '/api/commerce/closings',
      { modulo: 'ambos', dataInicio: today, dataFim: today, observacoes: 'Fechamento diário teste' },
      tokenA
    );
    assertCondition(
      closingRes.status === 201 &&
        closingRes.data.closing.vendasValor === 24 &&
        closingRes.data.closing.lucroLiquidoObservado === null,
      'Fechamento gerencial falhou ou inventou lucro líquido'
    );
    pass('T10', 'FASE 2', 'Rentabilidade & Fechamento Gerencial consolidam CMV/Lucro Bruto reais e mantêm Lucro Líquido null sem despesas');

    // ---------------------------------------------------------------------
    // FASE 3 — PEDIDOS, CONFORMIDADE +18, ENTREGAS, CLIENTES LGPD E CATÁLOGO
    // ---------------------------------------------------------------------
    // Pedido com item restrito SEM confirmação de maioridade -> 403
    const orderBlockedRes = await httpJson(
      port,
      'POST',
      '/api/commerce/orders',
      {
        clienteNome: 'João Teste',
        enderecoEntrega: 'Rua das Flores, 50',
        tipoAtendimento: 'entrega',
        verificacaoMaioridadeSolicitada: false,
        itens: [{ productId: beerId, quantidade: 2 }],
      },
      tokenA
    );
    assertCondition(orderBlockedRes.status === 403, `Pedido +18 sem confirmação deveria retornar 403 (retornou ${orderBlockedRes.status})`);

    // Pedido com item restrito COM confirmação de maioridade -> 201 + reserva estoque (25 - 2 = 23)
    const orderOkRes = await httpJson(
      port,
      'POST',
      '/api/commerce/orders',
      {
        clienteNome: 'João Maior',
        enderecoEntrega: 'Rua das Flores, 50',
        tipoAtendimento: 'entrega',
        verificacaoMaioridadeSolicitada: true,
        itens: [{ productId: beerId, quantidade: 2 }],
      },
      tokenA
    );
    assertCondition(orderOkRes.status === 201 && orderOkRes.data.order?.id, 'Pedido +18 válido falhou');
    const orderRestrictedId = orderOkRes.data.order.id;

    // Tentar marcar como entregue SEM verificação presencial na entrega -> 403
    const deliverBlockedRes = await httpJson(
      port,
      'PATCH',
      `/api/commerce/orders/${orderRestrictedId}/status`,
      { status: 'entregue', verificacaoMaioridadeEntrega: false },
      tokenA
    );
    assertCondition(deliverBlockedRes.status === 403, 'Entrega de item +18 sem conferência presencial não foi bloqueada (esperado 403)');

    // Marcar como entregue COM verificação presencial -> 200
    const deliverOkRes = await httpJson(
      port,
      'PATCH',
      `/api/commerce/orders/${orderRestrictedId}/status`,
      { status: 'entregue', verificacaoMaioridadeEntrega: true, entregadorNome: 'Motoboy Zé' },
      tokenA
    );
    assertCondition(deliverOkRes.status === 200 && deliverOkRes.data.order.status === 'entregue', 'Falha ao concluir entrega +18');
    pass('T11', 'FASE 3', 'Compliance +18 bloqueia criação e conclusão de entrega sem confirmação de maioridade (HTTP 403)');

    // Cancelamento de pedido devolve estoque reservado
    const orderCancelTargetRes = await httpJson(
      port,
      'POST',
      '/api/commerce/orders',
      {
        clienteNome: 'Maria Retira',
        tipoAtendimento: 'retirada',
        verificacaoMaioridadeSolicitada: true,
        itens: [{ productId: tobaccoId, quantidade: 3 }],
      },
      tokenA
    );
    assertCondition(orderCancelTargetRes.status === 201, 'Falha ao criar pedido de tabaco para estorno');
    const cancelTargetId = orderCancelTargetRes.data.order.id;

    const cancelOrderRes = await httpJson(
      port,
      'PATCH',
      `/api/commerce/orders/${cancelTargetId}/status`,
      { status: 'cancelado', motivoCancelamento: 'Desistência do cliente' },
      tokenA
    );
    assertCondition(cancelOrderRes.status === 200 && cancelOrderRes.data.order.status === 'cancelado', 'Falha ao cancelar pedido');
    const tobaccoAfterCancel = await httpJson(port, 'GET', `/api/commerce/products/${tobaccoId}/history`, undefined, tokenA);
    assertCondition(tobaccoAfterCancel.data.product.estoqueAtual === 20, 'Cancelamento de pedido não devolveu estoque reservado');
    pass('T12', 'FASE 3', 'Cancelamento de pedido estorna integralmente o estoque reservado');

    // Clientes LGPD + Anonimização
    const custCreateRes = await httpJson(
      port,
      'POST',
      '/api/commerce/customers',
      {
        nome: 'Carlos Silva LGPD',
        telefone: '11977776666',
        email: 'carlos.lgpd@exemplo.com',
        documento: '123.456.789-00',
        endereco: 'Av. Brasil, 500',
        maioridadeVerificada: true,
        consentimentoLgpd: true,
      },
      tokenA
    );
    assertCondition(custCreateRes.status === 201 && custCreateRes.data.customer?.id, 'Falha ao cadastrar cliente');
    const customerId = custCreateRes.data.customer.id;

    const anonRes = await httpJson(port, 'POST', `/api/commerce/customers/${customerId}/anonymize`, {}, tokenA);
    assertCondition(
      anonRes.status === 200 &&
        anonRes.data.customer.anonimizado === true &&
        !anonRes.data.customer.telefone &&
        !anonRes.data.customer.documento &&
        !anonRes.data.customer.email,
      'Anonimização LGPD não removeu PII do cliente'
    );
    pass('T13', 'FASE 3', 'Gestão de Clientes realiza anonimização LGPD completa dos dados pessoais');

    // Catálogo Digital Público (sem autenticação): ZERO álcool, ZERO tabaco, ZERO custos/PII
    const pubCatalogRes = await httpJson(port, 'GET', `/api/commerce/catalog/public/${companyAId}`);
    assertCondition(pubCatalogRes.status === 200, `Catálogo público retornou ${pubCatalogRes.status}`);
    const publicNames = (pubCatalogRes.data.items || []).map((i: any) => i.nome);
    assertCondition(publicNames.includes('Água Mineral Crystal 500ml'), 'Item sem restrição deveria estar no catálogo público');
    assertCondition(
      !publicNames.some((n: string) => n.includes('Heineken') || n.includes('Paiero')),
      'FALHA GRAVE LEGAL: Item +18 apareceu no catálogo público!'
    );
    const waterPubItem = pubCatalogRes.data.items.find((i: any) => i.nome.includes('Crystal'));
    assertCondition(waterPubItem.precoCusto === undefined, 'Catálogo público expôs preço de custo');
    pass('T14', 'FASE 3', 'Catálogo Digital Público oculta 100% dos itens +18 (álcool/tabaco) e omite custos internos');

    // ---------------------------------------------------------------------
    // FASE 4 — MODO ESPELHO, IMPORTAÇÃO REAL CSV/XLSX, AVALIAÇÃO E MIGRAÇÃO
    // ---------------------------------------------------------------------
    const mirrorRes = await httpJson(
      port,
      'POST',
      '/api/commerce/pilot/mirror-mode',
      { action: 'start', sistemaAnteriorNome: 'Planilha Excel Antiga' },
      tokenA
    );
    assertCondition(
      mirrorRes.status === 200 && mirrorRes.data.pilot.modoEspelho.ativo === true,
      'Falha ao ativar Modo Espelho 7 dias'
    );

    // Gerar arquivo XLSX real em memória e testar /imports/parse
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        SKU: 'XLS-GIN-750',
        Nome: 'Gin Tanqueray 750ml',
        Categoria: 'Destilados',
        'Preço Custo': 89.9,
        'Preço Venda': 139.9,
        Estoque: 12,
        'Estoque Mínimo': 4,
      },
      {
        SKU: 'CER-HEI-600', // duplicado proposital para validar deduplicação
        Nome: 'Cerveja Heineken 600ml Duplicada',
        Categoria: 'Cervejas',
        'Preço Custo': 8.5,
        'Preço Venda': 14.0,
        Estoque: 5,
        'Estoque Mínimo': 2,
      },
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos');
    const xlsxBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    const parseXlsxRes = await httpJson(
      port,
      'POST',
      '/api/commerce/imports/parse',
      { fileName: 'produtos_adega.xlsx', contentBase64: xlsxBase64, tipoAlvo: 'produtos' },
      tokenA
    );
    assertCondition(
      parseXlsxRes.status === 200 &&
        parseXlsxRes.data.formato === 'xlsx' &&
        parseXlsxRes.data.rows.length === 2 &&
        parseXlsxRes.data.suggestedMapping.nome === 'Nome',
      'Falha no parsing real de XLSX ou detecção de colunas'
    );

    // Testar também CSV real
    const csvSample = 'sku;nome;categoria;precoCusto;precoVenda;estoqueAtual\nGEL-SCO-01;Saco de Gelo 5kg;Conveniência;4,50;12,00;30\n';
    const parseCsvRes = await httpJson(
      port,
      'POST',
      '/api/commerce/imports/parse',
      { fileName: 'gelo.csv', csvText: csvSample, tipoAlvo: 'produtos' },
      tokenA
    );
    assertCondition(parseCsvRes.status === 200 && parseCsvRes.data.formato === 'csv' && parseCsvRes.data.rows.length === 1, 'Falha no parsing CSV');

    // Commit XLSX no modo espelho
    const commitRes = await httpJson(
      port,
      'POST',
      '/api/commerce/imports/commit',
      {
        fileName: 'produtos_adega.xlsx',
        formato: 'xlsx',
        tipoAlvo: 'produtos',
        modulo: 'adega',
        modoEspelho: true,
        mapeamentoColunas: parseXlsxRes.data.suggestedMapping,
        rows: parseXlsxRes.data.rows,
      },
      tokenA
    );
    assertCondition(
      commitRes.status === 201 &&
        commitRes.data.batch.importadosQtd === 1 &&
        commitRes.data.batch.ignoradosDuplicadosQtd === 1,
      `Commit de importação divergente: ${JSON.stringify(commitRes.data)}`
    );
    pass('T15', 'FASE 4', 'Central de Importação processa XLSX e CSV reais, previne duplicação de SKU e grava lote espelho');

    // Avaliação Real do Período
    const evalRes = await httpJson(port, 'GET', '/api/commerce/pilot/evaluation', undefined, tokenA);
    assertCondition(
      evalRes.status === 200 &&
        evalRes.data.metricasReais.vendasPdvQtd >= 1 &&
        evalRes.data.metricasReais.importacoesRealizadasQtd >= 1,
      'Avaliação do piloto não refletiu dados reais operados'
    );

    // Central de Migração: check_conflicts -> start -> pause -> resume -> complete
    const migCheck = await httpJson(port, 'POST', '/api/commerce/migration/action', { action: 'check_conflicts' }, tokenA);
    assertCondition(migCheck.status === 200 && migCheck.data.checklistResumo.conflicts === 0, 'Conflito inesperado na migração');

    const migStart = await httpJson(port, 'POST', '/api/commerce/migration/action', { action: 'start' }, tokenA);
    assertCondition(migStart.status === 200 && migStart.data.pilot.migracao.status === 'em_execucao', 'Falha ao iniciar migração');

    const migPause = await httpJson(port, 'POST', '/api/commerce/migration/action', { action: 'pause' }, tokenA);
    assertCondition(migPause.status === 200 && migPause.data.pilot.migracao.status === 'pausada', 'Falha ao pausar migração');

    const migResume = await httpJson(port, 'POST', '/api/commerce/migration/action', { action: 'resume' }, tokenA);
    assertCondition(migResume.status === 200 && migResume.data.pilot.migracao.status === 'em_execucao', 'Falha ao retomar migração');

    const migComplete = await httpJson(port, 'POST', '/api/commerce/migration/action', { action: 'complete' }, tokenA);
    assertCondition(
      migComplete.status === 200 &&
        migComplete.data.pilot.migracao.status === 'concluida' &&
        migComplete.data.pilot.modoEspelho.ativo === false,
      'Falha ao concluir virada definitiva da migração'
    );
    pass('T16', 'FASE 4', 'Avaliação Real e Migração Controlada (check/start/pause/resume/complete) executadas com integridade');

    // ---------------------------------------------------------------------
    // SEGURANÇA — ISOLAMENTO MULTI-TENANT E RBAC
    // ---------------------------------------------------------------------
    const unauthRes = await httpJson(port, 'GET', '/api/commerce/radar');
    assertCondition(unauthRes.status === 401, `Rota protegida aceitou requisição sem token (${unauthRes.status})`);

    const driverRbacRes = await httpJson(port, 'GET', '/api/commerce/radar', undefined, tokenDriverA);
    assertCondition(driverRbacRes.status === 403, `Perfil motorista não recebeu 403 no módulo comercial (${driverRbacRes.status})`);

    const crossTenantAlerts = await httpJson(port, 'GET', '/api/commerce/alerts', undefined, tokenB);
    assertCondition(crossTenantAlerts.status === 200 && crossTenantAlerts.data.alerts.length === 0, 'Empresa B visualizou alertas da Empresa A');

    const crossTenantProdHist = await httpJson(port, 'GET', `/api/commerce/products/${beerId}/history`, undefined, tokenB);
    assertCondition(crossTenantProdHist.status === 404, 'Empresa B acessou histórico de produto da Empresa A');

    const crossTenantOrderPatch = await httpJson(
      port,
      'PATCH',
      `/api/commerce/orders/${orderRestrictedId}/status`,
      { status: 'cancelado', motivoCancelamento: 'Invasão' },
      tokenB
    );
    assertCondition(crossTenantOrderPatch.status === 404, 'Empresa B conseguiu alterar pedido da Empresa A');
    pass('T17', 'SEGURANÇA', 'Multi-tenant e RBAC validados (401 sem sessão, 403 driver, 404 cross-tenant)');

    console.log('\n========================================================================');
    console.log(`RESULTADO FINAL: ${results.length}/${results.length} CENÁRIOS APROVADOS EM MODO ISOLADO!`);
    console.log('========================================================================');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

runSuite().catch((err) => {
  console.error('\n❌ FALHA NA SUÍTE DE HOMOLOGAÇÃO:', err);
  process.exit(1);
});
