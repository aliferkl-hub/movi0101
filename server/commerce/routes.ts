import express from 'express';
import type { NextFunction, Request, Response, RequestHandler } from 'express';
import crypto from 'crypto';
import {
  db,
  type CommercialCustomer,
  type CommercialImportBatch,
  type CommercialInventory,
  type CommercialInventoryItem,
  type CommercialLoss,
  type CommercialLossReason,
  type CommercialOrder,
  type CommercialOrderStatus,
  type CommercialPeriodClosing,
  type CommercialProduct,
  type CommercialPurchase,
  type CommercialSupplier,
} from '../db.ts';
import {
  computeProfitabilityMetrics,
  computeSmartStockForCompany,
  evaluateAndSyncAlerts,
  getEffectiveMaxStock,
  getOrCreatePilotConfig,
  isRestrictedProduct,
  parseSpreadsheetBuffer,
  suggestImportColumnMapping,
  syncReplenishmentSuggestions,
} from './intelligence.ts';

interface AuthRequest extends Request {
  user?: any;
  company?: any;
}

const ALLOWED_COMMERCE_ROLES = ['master_owner', 'company_admin', 'operator', 'dispatcher', 'financial'];
const MANAGER_COMMERCE_ROLES = ['master_owner', 'company_admin', 'financial', 'dispatcher'];

export function createCommerceEvolutionRouter(deps: {
  authenticate: RequestHandler;
  checkSubscription: RequestHandler;
  getEffectiveCompanyId: (req: AuthRequest) => string;
}) {
  const router = express.Router();
  const { authenticate, checkSubscription, getEffectiveCompanyId } = deps;

  const ensureCollections = () => {
    if (!(db as any).data) return;
    const d = (db as any).data;
    if (!Array.isArray(d.commercialAlerts)) d.commercialAlerts = [];
    if (!Array.isArray(d.commercialReplenishments)) d.commercialReplenishments = [];
    if (!Array.isArray(d.commercialLosses)) d.commercialLosses = [];
    if (!Array.isArray(d.commercialInventories)) d.commercialInventories = [];
    if (!Array.isArray(d.commercialPeriodClosings)) d.commercialPeriodClosings = [];
    if (!Array.isArray(d.commercialOrders)) d.commercialOrders = [];
    if (!Array.isArray(d.commercialCustomers)) d.commercialCustomers = [];
    if (!Array.isArray(d.commercialImportBatches)) d.commercialImportBatches = [];
    if (!Array.isArray(d.commercialPilotConfigs)) d.commercialPilotConfigs = [];
  };

  const requireCommerceRole = (allowed: string[] = ALLOWED_COMMERCE_ROLES): RequestHandler => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({ error: 'Autenticação necessária.' });
        return;
      }
      if (!allowed.includes(req.user.role)) {
        res.status(403).json({
          error: 'Seu perfil não possui permissão para acessar esta funcionalidade do módulo comercial.',
        });
        return;
      }
      next();
    };
  };

  // =========================================================================
  // FASE 3 PUBLIC ROUTE — CATÁLOGO DIGITAL PÚBLICO (SOMENTE ITENS SEM RESTRIÇÃO)
  // =========================================================================
  router.get('/catalog/public/:companyId', (req: Request, res: Response) => {
    ensureCollections();
    const { companyId } = req.params;
    const { modulo, categoria, search } = req.query;

    const company = db.companies.find((c) => c.id === companyId);
    if (!company || company.statusCadastro === 'suspenso' || company.statusCadastro === 'encerrado') {
      res.status(404).json({ error: 'Estabelecimento não encontrado ou catálogo indisponível.' });
      return;
    }

    const pilot = db.commercialPilotConfigs.find((p) => p.companyId === companyId);
    if (pilot && pilot.catalogoPublicoAtivo === false) {
      res.status(403).json({ error: 'O catálogo digital público deste estabelecimento está temporariamente desativado.' });
      return;
    }

    // STRICT LEGAL FILTER: Never expose alcohol, tobacco, restricted items, or items with idadeMinima >= 18
    let publicProducts = db.commercialProducts.filter((p) => {
      if (p.companyId !== companyId || !p.ativo) return false;
      if (p.classificacaoLegal !== 'sem_restricao') return false;
      if ((p.idadeMinima || 0) > 0) return false;
      return true;
    });

    if (modulo && (modulo === 'adega' || modulo === 'tabacaria')) {
      publicProducts = publicProducts.filter((p) => p.modulo === modulo);
    }

    if (categoria && typeof categoria === 'string' && categoria !== 'todas') {
      publicProducts = publicProducts.filter(
        (p) => p.categoria.toLowerCase() === categoria.toLowerCase()
      );
    }

    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().toLowerCase();
      publicProducts = publicProducts.filter(
        (p) =>
          p.nome.toLowerCase().includes(term) ||
          (p.marca && p.marca.toLowerCase().includes(term)) ||
          p.categoria.toLowerCase().includes(term)
      );
    }

    const categories = Array.from(new Set(publicProducts.map((p) => p.categoria))).sort();

    // Return ONLY safe public showcase attributes (no cost prices, no supplier info, no internal stock figures)
    const items = publicProducts
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((p) => ({
        id: p.id,
        modulo: p.modulo,
        sku: p.sku,
        nome: p.nome,
        categoria: p.categoria,
        marca: p.marca || null,
        descricao: p.descricao || null,
        precoVenda: p.precoVenda,
        unidade: p.unidade,
        disponivel: p.estoqueAtual > 0,
        fotoUrl: p.fotoUrl || null,
        classificacaoLegal: 'sem_restricao',
      }));

    res.json({
      success: true,
      store: {
        companyId: company.id,
        nome: pilot?.estabelecimentoNome || company.nomeFantasia,
        titulo: pilot?.catalogoTitulo || `${company.nomeFantasia} — Catálogo Digital`,
        whatsapp: pilot?.whatsappPedidos || company.telefone || null,
        avisoLegal:
          'Conformidade Legal: Bebidas alcoólicas, tabaco e derivados (+18) não são exibidos ou promovidos neste catálogo público.',
      },
      categories,
      items,
      total: items.length,
    });
  });

  // All remaining routes require authentication + active subscription + commercial role
  router.use(authenticate, checkSubscription, requireCommerceRole(ALLOWED_COMMERCE_ROLES));

  // =========================================================================
  // FASE 1 — RADAR MOVILOG, ESTOQUE INTELIGENTE, REPOSIÇÃO E ALERTAS
  // =========================================================================

  router.get('/radar', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const modulo =
      req.query.modulo === 'adega' || req.query.modulo === 'tabacaria'
        ? req.query.modulo
        : undefined;

    const { alerts, smartStock } = evaluateAndSyncAlerts(companyId, modulo);
    const replenishments = syncReplenishmentSuggestions(companyId, modulo);

    const activeAlerts = alerts.filter((a) => a.status === 'ativo');
    const resolvedAlerts = alerts.filter((a) => a.status === 'resolvido');
    const ruptureItems = smartStock.filter((s) => s.statusEstoque === 'ruptura');
    const criticalItems = smartStock.filter((s) => s.statusEstoque === 'critico');
    const attentionItems = smartStock.filter((s) => s.statusEstoque === 'atencao');
    const stagnantItems = smartStock.filter((s) => s.statusEstoque === 'parado');

    const totalCapitalCusto = Number(
      smartStock.reduce((acc, s) => acc + s.product.estoqueAtual * s.product.precoCusto, 0).toFixed(2)
    );
    const capitalParadoCusto = Number(
      stagnantItems.reduce((acc, s) => acc + s.product.estoqueAtual * s.product.precoCusto, 0).toFixed(2)
    );

    const pendingOrdersCount = db.commercialOrders.filter(
      (o) =>
        o.companyId === companyId &&
        (o.status === 'recebido' || o.status === 'em_separacao' || o.status === 'saiu_entrega') &&
        (!modulo || o.modulo === modulo || o.modulo === 'misto')
    ).length;

    const pendingReplenishments = replenishments.filter(
      (r) => r.status === 'pendente' || r.status === 'aprovada'
    );

    // Build honest explained recommendations directly from detected facts
    const recomendacoes: {
      id: string;
      prioridade: 'critica' | 'alta' | 'media';
      titulo: string;
      justificativa: string;
      rotaSugerida: string;
      acaoLabel: string;
    }[] = [];

    if (ruptureItems.length > 0) {
      recomendacoes.push({
        id: 'rec-ruptura',
        prioridade: 'critica',
        titulo: `${ruptureItems.length} produto(s) com estoque zerado`,
        justificativa: `Itens como ${ruptureItems.slice(0, 2).map((i) => i.product.nome).join(', ')} estão indisponíveis no PDV e catálogo.`,
        rotaSugerida: 'replenishment',
        acaoLabel: 'Revisar Reposição Imediata',
      });
    }
    if (criticalItems.length > 0) {
      recomendacoes.push({
        id: 'rec-critico',
        prioridade: 'alta',
        titulo: `${criticalItems.length} item(ns) abaixo ou no limite mínimo`,
        justificativa: `Estoque abaixo da margem de segurança configurada (${criticalItems.slice(0, 2).map((i) => `${i.product.nome}: ${i.product.estoqueAtual}/${i.product.estoqueMinimo}`).join('; ')}).`,
        rotaSugerida: 'smart_stock',
        acaoLabel: 'Abrir Estoque Inteligente',
      });
    }
    if (stagnantItems.length > 0) {
      recomendacoes.push({
        id: 'rec-parado',
        prioridade: 'media',
        titulo: `R$ ${capitalParadoCusto.toFixed(2)} imobilizados em itens sem giro`,
        justificativa: `${stagnantItems.length} produto(s) sem venda há 30+ dias. Evite novas compras até girar o saldo atual.`,
        rotaSugerida: 'smart_stock',
        acaoLabel: 'Analisar Itens Parados',
      });
    }
    const costAlerts = activeAlerts.filter((a) => a.categoria === 'alta_custo_fornecedor');
    if (costAlerts.length > 0) {
      recomendacoes.push({
        id: 'rec-custo',
        prioridade: 'alta',
        titulo: `${costAlerts.length} produto(s) com aumento recente de custo`,
        justificativa: costAlerts[0].descricao,
        rotaSugerida: 'profitability',
        acaoLabel: 'Verificar Margens',
      });
    }

    res.json({
      success: true,
      resumo: {
        totalProdutosAtivos: smartStock.length,
        alertasAtivosCount: activeAlerts.length,
        alertasCriticosCount: activeAlerts.filter((a) => a.prioridade === 'critica').length,
        alertasResolvidosCount: resolvedAlerts.length,
        itensEmRupturaCount: ruptureItems.length,
        itensCriticosCount: criticalItems.length,
        itensEmAtencaoCount: attentionItems.length,
        itensParadosCount: stagnantItems.length,
        reposicoesPendentesCount: pendingReplenishments.length,
        pedidosEmAndamentoCount: pendingOrdersCount,
        totalCapitalCusto,
        capitalParadoCusto,
      },
      alertasPrioritarios: activeAlerts.slice(0, 8),
      itensRiscoRuptura: [...ruptureItems, ...criticalItems, ...attentionItems].slice(0, 8),
      itensParados: stagnantItems.slice(0, 6),
      recomendacoes,
    });
  });

  router.get('/smart-stock', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const modulo =
      req.query.modulo === 'adega' || req.query.modulo === 'tabacaria'
        ? req.query.modulo
        : undefined;
    const statusFilter = typeof req.query.status === 'string' ? req.query.status : 'todos';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';

    let items = computeSmartStockForCompany(companyId, modulo);

    if (statusFilter !== 'todos') {
      items = items.filter((i) => i.statusEstoque === statusFilter);
    }
    if (search) {
      items = items.filter(
        (i) =>
          i.product.nome.toLowerCase().includes(search) ||
          i.product.sku.toLowerCase().includes(search) ||
          i.product.categoria.toLowerCase().includes(search)
      );
    }

    const orderWeight = { ruptura: 1, critico: 2, atencao: 3, parado: 4, excesso: 5, saudavel: 6 };
    items.sort((a, b) => orderWeight[a.statusEstoque] - orderWeight[b.statusEstoque]);

    res.json({ success: true, items, total: items.length });
  });

  router.get('/replenishments', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const modulo =
      req.query.modulo === 'adega' || req.query.modulo === 'tabacaria'
        ? req.query.modulo
        : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : 'todos';

    let list = syncReplenishmentSuggestions(companyId, modulo);
    if (status !== 'todos') {
      list = list.filter((r) => r.status === status);
    }
    res.json({ success: true, replenishments: list, total: list.length });
  });

  router.post('/replenishments/:id/review', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const {
      acao,
      quantidadeAprovada,
      fornecedorId,
      gerarPedidoCompra,
      observacoes,
    } = req.body;

    const rep = db.commercialReplenishments.find((r) => r.id === id && r.companyId === companyId);
    if (!rep) {
      res.status(404).json({ error: 'Sugestão de reposição não encontrada.' });
      return;
    }

    if (!['aprovar', 'descartar'].includes(acao)) {
      res.status(400).json({ error: 'Ação inválida. Use "aprovar" ou "descartar".' });
      return;
    }

    const nowIso = new Date().toISOString();
    rep.revisadoPorId = req.user!.id;
    rep.revisadoPorNome = req.user!.name;
    rep.revisadoEm = nowIso;
    if (observacoes !== undefined) rep.observacoes = String(observacoes).trim();

    if (acao === 'descartar') {
      rep.status = 'descartada';
      db.save();
      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name,
        companyId,
        acao: 'DESCARTE_REPOSICAO_COMERCIAL',
        detalhes: `Sugestão de reposição para ${rep.productNome} (${rep.sku}) descartada.`,
        ip: req.ip,
      });
      res.json({ success: true, message: 'Sugestão descartada.', replenishment: rep });
      return;
    }

    const approvedQty =
      quantidadeAprovada && Number(quantidadeAprovada) > 0
        ? Math.floor(Number(quantidadeAprovada))
        : rep.quantidadeSugerida;
    rep.quantidadeAprovada = approvedQty;
    rep.custoTotalEstimado = Number((approvedQty * rep.custoUnitarioEstimado).toFixed(2));

    let createdPurchase: CommercialPurchase | null = null;
    if (gerarPedidoCompra) {
      const chosenSupId = fornecedorId || rep.fornecedorId || '';
      const supplier = db.commercialSuppliers.find(
        (s) => s.id === chosenSupId && s.companyId === companyId
      );
      const fornecedorNome = supplier ? supplier.nomeFantasia || supplier.razaoSocial : rep.fornecedorNome || 'A definir';

      createdPurchase = {
        id: crypto.randomUUID(),
        companyId,
        fornecedorId: chosenSupId,
        fornecedorNome,
        modulo: rep.modulo,
        dataCompra: nowIso.slice(0, 10),
        status: 'aprovada',
        sugestaoReposicaoId: rep.id,
        itens: [
          {
            productId: rep.productId,
            nome: rep.productNome,
            quantidade: approvedQty,
            custoUnitario: rep.custoUnitarioEstimado,
            total: Number((approvedQty * rep.custoUnitarioEstimado).toFixed(2)),
          },
        ],
        valorTotal: Number((approvedQty * rep.custoUnitarioEstimado).toFixed(2)),
        observacoes: observacoes
          ? String(observacoes).trim()
          : `Gerado pela Central de Reposição (${rep.justificativa})`,
        criadoEm: nowIso,
      };
      db.commercialPurchases.push(createdPurchase);
      rep.purchaseId = createdPurchase.id;
      rep.status = 'pedido_gerado';
    } else {
      rep.status = 'aprovada';
    }

    db.save();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      companyId,
      acao: 'APROVACAO_REPOSICAO_COMERCIAL',
      detalhes: `Reposição de ${approvedQty}x ${rep.productNome} aprovada.${createdPurchase ? ` Pedido de compra ${createdPurchase.id} criado.` : ''}`,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: createdPurchase
        ? 'Reposição aprovada e pedido de compra encaminhado para a Central de Compras!'
        : 'Reposição aprovada com sucesso!',
      replenishment: rep,
      purchase: createdPurchase,
    });
  });

  router.get('/alerts', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const modulo =
      req.query.modulo === 'adega' || req.query.modulo === 'tabacaria'
        ? req.query.modulo
        : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : 'todos';
    const prioridade = typeof req.query.prioridade === 'string' ? req.query.prioridade : 'todas';
    const categoria = typeof req.query.categoria === 'string' ? req.query.categoria : 'todas';

    const { alerts } = evaluateAndSyncAlerts(companyId, modulo);
    let filtered = alerts;
    if (status !== 'todos') filtered = filtered.filter((a) => a.status === status);
    if (prioridade !== 'todas') filtered = filtered.filter((a) => a.prioridade === prioridade);
    if (categoria !== 'todas') filtered = filtered.filter((a) => a.categoria === categoria);

    res.json({ success: true, alerts: filtered, total: filtered.length });
  });

  router.post('/alerts/:id/resolve', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const { motivoResolucao } = req.body;

    const alert = db.commercialAlerts.find((a) => a.id === id && a.companyId === companyId);
    if (!alert) {
      res.status(404).json({ error: 'Alerta não encontrado.' });
      return;
    }

    alert.status = 'resolvido';
    alert.resolvidoEm = new Date().toISOString();
    alert.resolvidoPorId = req.user!.id;
    alert.resolvidoPorNome = req.user!.name;
    alert.motivoResolucao = motivoResolucao ? String(motivoResolucao).trim() : 'Tratado pelo operador';

    db.save();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      companyId,
      acao: 'RESOLUCAO_ALERTA_COMERCIAL',
      detalhes: `Alerta "${alert.titulo}" marcado como resolvido. Motivo: ${alert.motivoResolucao}`,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Alerta marcado como resolvido.', alert });
  });

  // =========================================================================
  // FASE 2 — RENTABILIDADE, PRODUTO DETALHE, FORNECEDORES, COMPRAS, PERDAS, INVENTÁRIO E FECHAMENTO
  // =========================================================================

  router.get('/profitability', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const modulo =
      req.query.modulo === 'adega' || req.query.modulo === 'tabacaria'
        ? req.query.modulo
        : undefined;
    const dataInicio = typeof req.query.dataInicio === 'string' ? req.query.dataInicio : undefined;
    const dataFim = typeof req.query.dataFim === 'string' ? req.query.dataFim : undefined;

    const metrics = computeProfitabilityMetrics(companyId, { modulo, dataInicio, dataFim });
    res.json({ success: true, metrics });
  });

  router.get('/products/:id/history', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const product = db.commercialProducts.find((p) => p.id === id && p.companyId === companyId);
    if (!product) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    const movements = db.commercialStockMovements
      .filter((m) => m.companyId === companyId && m.productId === id)
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .slice(0, 50);

    const purchases = db.commercialPurchases
      .filter((pur) => pur.companyId === companyId && pur.itens.some((i) => i.productId === id))
      .map((pur) => {
        const line = pur.itens.find((i) => i.productId === id)!;
        return {
          purchaseId: pur.id,
          dataCompra: pur.dataCompra,
          fornecedorNome: pur.fornecedorNome,
          numeroNota: pur.numeroNota || 'S/N',
          quantidade: line.quantidade,
          custoUnitario: line.custoUnitario,
          status: pur.status,
        };
      });

    const lucroUnitario = Number((product.precoVenda - product.precoCusto).toFixed(2));
    const margemVendaPercentual =
      product.precoVenda > 0 ? Number(((lucroUnitario / product.precoVenda) * 100).toFixed(1)) : 0;
    const markupPercentual =
      product.precoCusto > 0 ? Number(((lucroUnitario / product.precoCusto) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      product,
      financeiro: { lucroUnitario, margemVendaPercentual, markupPercentual },
      custoHistorico: product.custoHistorico || [],
      movements,
      purchases,
    });
  });

  router.put('/suppliers/:id', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const supplier = db.commercialSuppliers.find((s) => s.id === id && s.companyId === companyId);
    if (!supplier) {
      res.status(404).json({ error: 'Fornecedor não encontrado.' });
      return;
    }

    const {
      razaoSocial,
      nomeFantasia,
      cnpjCpf,
      contatoNome,
      telefone,
      email,
      endereco,
      segmento,
      prazoEntregaDias,
      condicaoPagamento,
      observacoes,
      ativo,
    } = req.body;

    if (razaoSocial !== undefined) supplier.razaoSocial = String(razaoSocial).trim();
    if (nomeFantasia !== undefined) supplier.nomeFantasia = String(nomeFantasia).trim();
    if (cnpjCpf !== undefined) supplier.cnpjCpf = String(cnpjCpf).trim();
    if (contatoNome !== undefined) supplier.contatoNome = String(contatoNome).trim();
    if (telefone !== undefined) supplier.telefone = String(telefone).trim();
    if (email !== undefined) supplier.email = String(email).trim();
    if (endereco !== undefined) supplier.endereco = String(endereco).trim();
    if (segmento !== undefined && ['adega', 'tabacaria', 'ambos'].includes(segmento)) {
      supplier.segmento = segmento;
    }
    if (prazoEntregaDias !== undefined) supplier.prazoEntregaDias = Number(prazoEntregaDias) || 0;
    if (condicaoPagamento !== undefined) supplier.condicaoPagamento = String(condicaoPagamento).trim();
    if (observacoes !== undefined) supplier.observacoes = String(observacoes).trim();
    if (ativo !== undefined) supplier.ativo = Boolean(ativo);
    supplier.atualizadoEm = new Date().toISOString();

    db.save();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      companyId,
      acao: 'EDICAO_FORNECEDOR_COMERCIAL',
      detalhes: `Fornecedor ${supplier.nomeFantasia || supplier.razaoSocial} atualizado.`,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Fornecedor atualizado com sucesso!', supplier });
  });

  router.get('/suppliers/:id/history', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const supplier = db.commercialSuppliers.find((s) => s.id === id && s.companyId === companyId);
    if (!supplier) {
      res.status(404).json({ error: 'Fornecedor não encontrado.' });
      return;
    }

    const purchases = db.commercialPurchases
      .filter((p) => p.companyId === companyId && p.fornecedorId === id)
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

    const totalComprado = Number(
      purchases
        .filter((p) => p.status !== 'cancelado')
        .reduce((acc, p) => acc + Number(p.valorTotal || 0), 0)
        .toFixed(2)
    );

    res.json({
      success: true,
      supplier,
      purchases,
      totalCompras: purchases.length,
      totalComprado,
    });
  });

  router.patch('/purchases/:id/status', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const { status, numeroNota, observacoes } = req.body;

    if (!['rascunho', 'aprovada', 'pendente', 'recebido', 'cancelado'].includes(status)) {
      res.status(400).json({ error: 'Status de compra inválido.' });
      return;
    }

    const purchase = db.commercialPurchases.find((p) => p.id === id && p.companyId === companyId);
    if (!purchase) {
      res.status(404).json({ error: 'Pedido de compra não encontrado.' });
      return;
    }

    if (purchase.status === 'recebido' && status === 'recebido') {
      res.status(400).json({ error: 'Esta compra já teve seu estoque creditado anteriormente.' });
      return;
    }

    if (numeroNota !== undefined) purchase.numeroNota = String(numeroNota).trim();
    if (observacoes !== undefined) purchase.observacoes = String(observacoes).trim();

    const nowIso = new Date().toISOString();
    const shouldCreditStock = purchase.status !== 'recebido' && status === 'recebido';

    if (shouldCreditStock) {
      for (const item of purchase.itens) {
        const product = db.commercialProducts.find(
          (p) => p.id === item.productId && p.companyId === companyId
        );
        if (product) {
          const qtdAnt = product.estoqueAtual;
          product.estoqueAtual = qtdAnt + item.quantidade;
          if (item.custoUnitario > 0 && item.custoUnitario !== product.precoCusto) {
            product.custoAnterior = product.precoCusto;
            product.precoCusto = item.custoUnitario;
            if (!Array.isArray(product.custoHistorico)) product.custoHistorico = [];
            product.custoHistorico.push({
              custo: item.custoUnitario,
              data: nowIso,
              fornecedorId: purchase.fornecedorId,
              fornecedorNome: purchase.fornecedorNome,
              motivo: `Recebimento Compra NF ${purchase.numeroNota || 'S/N'}`,
            });
          }
          product.atualizadoEm = nowIso;

          db.commercialStockMovements.push({
            id: crypto.randomUUID(),
            companyId,
            productId: product.id,
            productNome: product.nome,
            modulo: product.modulo,
            tipo: 'entrada_compra',
            quantidade: item.quantidade,
            quantidadeAnterior: qtdAnt,
            quantidadeNova: product.estoqueAtual,
            custoUnitarioNoMovimento: item.custoUnitario,
            motivo: `Recebimento pedido de compra ${purchase.numeroNota || purchase.id.slice(0, 8)} (${purchase.fornecedorNome})`,
            usuarioId: req.user!.id,
            usuarioNome: req.user!.name,
            referenciaId: purchase.id,
            criadoEm: nowIso,
          });
        }
      }
      purchase.dataRecebimento = nowIso;
    }

    purchase.status = status;
    db.save();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      companyId,
      acao: 'ATUALIZACAO_STATUS_COMPRA_COMERCIAL',
      detalhes: `Pedido de compra ${purchase.id} atualizado para "${status}"${shouldCreditStock ? ' com entrada automática no estoque' : ''}.`,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: shouldCreditStock
        ? 'Recebimento confirmado e estoque atualizado com sucesso!'
        : `Status atualizado para ${status}.`,
      purchase,
    });
  });

  // --- CONTROLE DE PERDAS ---
  router.get('/losses', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { modulo, tipo, dataInicio, dataFim } = req.query;

    let list = db.commercialLosses.filter((l) => l.companyId === companyId);
    if (modulo && (modulo === 'adega' || modulo === 'tabacaria')) {
      list = list.filter((l) => l.modulo === modulo);
    }
    if (tipo && typeof tipo === 'string' && tipo !== 'todos') {
      list = list.filter((l) => l.tipo === tipo);
    }
    if (dataInicio && typeof dataInicio === 'string') {
      list = list.filter((l) => l.dataPerda >= dataInicio);
    }
    if (dataFim && typeof dataFim === 'string') {
      list = list.filter((l) => l.dataPerda <= dataFim);
    }

    list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());

    const totalQtd = list.reduce((acc, l) => acc + l.quantidade, 0);
    const totalImpactoFinanceiro = Number(
      list.reduce((acc, l) => acc + l.custoTotalImpacto, 0).toFixed(2)
    );

    res.json({ success: true, losses: list, totalQtd, totalImpactoFinanceiro });
  });

  router.post('/losses', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { productId, tipo, quantidade, motivo, dataPerda } = req.body;

    const validTypes: CommercialLossReason[] = [
      'avaria',
      'vencimento',
      'consumo_interno',
      'descarte',
      'extravio',
    ];
    if (!validTypes.includes(tipo)) {
      res.status(400).json({ error: 'Tipo de perda inválido.' });
      return;
    }

    const qty = parseInt(quantidade, 10);
    if (isNaN(qty) || qty <= 0) {
      res.status(400).json({ error: 'Informe uma quantidade positiva para a perda.' });
      return;
    }
    if (!motivo || !String(motivo).trim()) {
      res.status(400).json({ error: 'Justificativa/motivo da perda é obrigatório.' });
      return;
    }

    const product = db.commercialProducts.find((p) => p.id === productId && p.companyId === companyId);
    if (!product) {
      res.status(404).json({ error: 'Produto não encontrado.' });
      return;
    }

    if (product.estoqueAtual < qty) {
      res.status(400).json({
        error: `Estoque insuficiente (${product.estoqueAtual} ${product.unidade}) para registrar perda de ${qty} ${product.unidade}.`,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const qtdAnt = product.estoqueAtual;
    product.estoqueAtual = qtdAnt - qty;
    product.atualizadoEm = nowIso;

    const custoTotalImpacto = Number((qty * product.precoCusto).toFixed(2));
    const loss: CommercialLoss = {
      id: crypto.randomUUID(),
      companyId,
      modulo: product.modulo,
      productId: product.id,
      productNome: product.nome,
      sku: product.sku,
      tipo,
      quantidade: qty,
      custoUnitario: product.precoCusto,
      custoTotalImpacto,
      motivo: String(motivo).trim(),
      dataPerda: dataPerda ? String(dataPerda).slice(0, 10) : nowIso.slice(0, 10),
      responsavelId: req.user!.id,
      responsavelNome: req.user!.name,
      criadoEm: nowIso,
    };

    db.commercialLosses.push(loss);
    db.commercialStockMovements.push({
      id: crypto.randomUUID(),
      companyId,
      productId: product.id,
      productNome: product.nome,
      modulo: product.modulo,
      tipo: tipo === 'vencimento' ? 'vencimento' : 'perda_avaria',
      quantidade: qty,
      quantidadeAnterior: qtdAnt,
      quantidadeNova: product.estoqueAtual,
      custoUnitarioNoMovimento: product.precoCusto,
      motivo: `Perda (${tipo}): ${loss.motivo}`,
      usuarioId: req.user!.id,
      usuarioNome: req.user!.name,
      referenciaId: loss.id,
      criadoEm: nowIso,
    });

    db.save();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      companyId,
      acao: 'REGISTRO_PERDA_COMERCIAL',
      detalhes: `Perda (${tipo}) de ${qty}x ${product.nome}. Impacto: R$ ${custoTotalImpacto.toFixed(2)}. Motivo: ${loss.motivo}`,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Perda registrada, estoque atualizado e impacto apurado.',
      loss,
      product,
    });
  });

  // --- INVENTÁRIO FÍSICO ---
  router.get('/inventories', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const list = db.commercialInventories
      .filter((i) => i.companyId === companyId)
      .sort((a, b) => new Date(b.dataInicio).getTime() - new Date(a.dataInicio).getTime());
    res.json({ success: true, inventories: list });
  });

  router.post('/inventories', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { modulo = 'ambos', observacoes } = req.body;

    if (!['adega', 'tabacaria', 'ambos'].includes(modulo)) {
      res.status(400).json({ error: 'Módulo de inventário inválido.' });
      return;
    }

    const products = db.commercialProducts
      .filter((p) => p.companyId === companyId && p.ativo && (modulo === 'ambos' || p.modulo === modulo))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    if (products.length === 0) {
      res.status(400).json({ error: 'Não há produtos ativos cadastrados para iniciar inventário.' });
      return;
    }

    const count = db.commercialInventories.filter((i) => i.companyId === companyId).length + 1;
    const nowIso = new Date().toISOString();
    const itens: CommercialInventoryItem[] = products.map((p) => ({
      productId: p.id,
      sku: p.sku,
      nome: p.nome,
      modulo: p.modulo,
      unidade: p.unidade,
      saldoSistema: p.estoqueAtual,
      saldoContado: p.estoqueAtual,
      divergencia: 0,
      custoUnitario: p.precoCusto,
      impactoFinanceiro: 0,
    }));

    const inv: CommercialInventory = {
      id: crypto.randomUUID(),
      companyId,
      codigo: `INV-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`,
      modulo,
      status: 'em_contagem',
      itens,
      totalItens: itens.length,
      totalDivergencias: 0,
      impactoFinanceiroTotal: 0,
      responsavelId: req.user!.id,
      responsavelNome: req.user!.name,
      dataInicio: nowIso,
      observacoes: observacoes ? String(observacoes).trim() : undefined,
    };

    db.commercialInventories.push(inv);
    db.save();

    res.status(201).json({
      success: true,
      message: `Sessão de inventário ${inv.codigo} iniciada com ${inv.totalItens} itens.`,
      inventory: inv,
    });
  });

  router.put('/inventories/:id/count', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const { counts, finalizarConferencia } = req.body;

    const inv = db.commercialInventories.find((i) => i.id === id && i.companyId === companyId);
    if (!inv) {
      res.status(404).json({ error: 'Sessão de inventário não encontrada.' });
      return;
    }
    if (inv.status === 'aprovado_ajustado' || inv.status === 'cancelado') {
      res.status(400).json({ error: 'Este inventário já foi encerrado e não pode mais ser alterado.' });
      return;
    }

    if (Array.isArray(counts)) {
      for (const c of counts) {
        const item = inv.itens.find((i) => i.productId === c.productId);
        if (!item) continue;
        const parsedCount =
          c.saldoContado === null || c.saldoContado === '' || c.saldoContado === undefined
            ? null
            : Math.max(0, parseInt(c.saldoContado, 10));
        item.saldoContado = parsedCount;
        if (parsedCount !== null) {
          item.divergencia = parsedCount - item.saldoSistema;
          item.impactoFinanceiro = Number((item.divergencia * item.custoUnitario).toFixed(2));
        } else {
          item.divergencia = 0;
          item.impactoFinanceiro = 0;
        }
        if (c.justificativa !== undefined) item.justificativa = String(c.justificativa).trim();
      }
    }

    const divergentItems = inv.itens.filter((i) => i.saldoContado !== null && i.divergencia !== 0);
    inv.totalDivergencias = divergentItems.length;
    inv.impactoFinanceiroTotal = Number(
      divergentItems.reduce((acc, i) => acc + i.impactoFinanceiro, 0).toFixed(2)
    );

    if (finalizarConferencia) {
      inv.status = 'conferido';
    }

    db.save();
    res.json({
      success: true,
      message: finalizarConferencia
        ? `Conferência concluída: ${inv.totalDivergencias} divergência(s) localizada(s). Aguardando aprovação de ajuste.`
        : 'Contagem salva com sucesso.',
      inventory: inv,
    });
  });

  router.post(
    '/inventories/:id/approve',
    requireCommerceRole(MANAGER_COMMERCE_ROLES),
    (req: AuthRequest, res: Response) => {
      ensureCollections();
      const companyId = getEffectiveCompanyId(req);
      const { id } = req.params;
      const { observacoes } = req.body;

      const inv = db.commercialInventories.find((i) => i.id === id && i.companyId === companyId);
      if (!inv) {
        res.status(404).json({ error: 'Inventário não encontrado.' });
        return;
      }
      if (inv.status === 'aprovado_ajustado') {
        res.status(400).json({ error: 'Este inventário já foi aprovado e aplicado ao estoque.' });
        return;
      }

      const nowIso = new Date().toISOString();
      let adjustedCount = 0;

      for (const item of inv.itens) {
        if (item.saldoContado === null || item.divergencia === 0) continue;
        const product = db.commercialProducts.find(
          (p) => p.id === item.productId && p.companyId === companyId
        );
        if (!product) continue;

        const qtdAnt = product.estoqueAtual;
        product.estoqueAtual = item.saldoContado;
        product.atualizadoEm = nowIso;

        db.commercialStockMovements.push({
          id: crypto.randomUUID(),
          companyId,
          productId: product.id,
          productNome: product.nome,
          modulo: product.modulo,
          tipo: 'ajuste_manual',
          quantidade: Math.abs(item.saldoContado - qtdAnt),
          quantidadeAnterior: qtdAnt,
          quantidadeNova: item.saldoContado,
          custoUnitarioNoMovimento: product.precoCusto,
          motivo: `Ajuste de Inventário ${inv.codigo} (divergência ${item.divergencia >= 0 ? '+' : ''}${item.divergencia})${item.justificativa ? `: ${item.justificativa}` : ''}`,
          usuarioId: req.user!.id,
          usuarioNome: req.user!.name,
          referenciaId: inv.id,
          criadoEm: nowIso,
        });
        adjustedCount++;
      }

      inv.status = 'aprovado_ajustado';
      inv.aprovadoPorId = req.user!.id;
      inv.aprovadoPorNome = req.user!.name;
      inv.dataConclusao = nowIso;
      if (observacoes) inv.observacoes = String(observacoes).trim();

      db.save();
      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name,
        companyId,
        acao: 'APROVACAO_INVENTARIO_FISICO',
        detalhes: `Inventário ${inv.codigo} aprovado com ${adjustedCount} ajuste(s) aplicado(s). Impacto financeiro: R$ ${inv.impactoFinanceiroTotal.toFixed(2)}.`,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: `Inventário ${inv.codigo} aprovado e ${adjustedCount} ajuste(s) aplicado(s) com rastreabilidade!`,
        inventory: inv,
      });
    }
  );

  // --- FECHAMENTO GERENCIAL POR PERÍODO ---
  router.get('/closings', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const list = db.commercialPeriodClosings
      .filter((c) => c.companyId === companyId)
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
    res.json({ success: true, closings: list });
  });

  router.post(
    '/closings',
    requireCommerceRole(MANAGER_COMMERCE_ROLES),
    (req: AuthRequest, res: Response) => {
      ensureCollections();
      const companyId = getEffectiveCompanyId(req);
      const { modulo = 'ambos', dataInicio, dataFim, observacoes } = req.body;

      if (!dataInicio || !dataFim || dataInicio > dataFim) {
        res.status(400).json({ error: 'Informe um período válido (dataInicio <= dataFim).' });
        return;
      }

      const targetMod =
        modulo === 'adega' || modulo === 'tabacaria' ? modulo : undefined;

      const prof = computeProfitabilityMetrics(companyId, {
        modulo: targetMod,
        dataInicio,
        dataFim,
      });

      const movements = db.commercialStockMovements.filter((m) => {
        if (m.companyId !== companyId) return false;
        if (targetMod && m.modulo !== targetMod) return false;
        if (m.criadoEm < dataInicio || m.criadoEm > `${dataFim}T23:59:59.999Z`) return false;
        return true;
      });

      const entradasQtd = movements
        .filter((m) => m.tipo === 'entrada_compra' || m.tipo === 'devolucao')
        .reduce((acc, m) => acc + m.quantidade, 0);
      const saidasQtd = movements
        .filter((m) => m.tipo === 'saida_venda' || m.tipo === 'perda_avaria' || m.tipo === 'vencimento')
        .reduce((acc, m) => acc + m.quantidade, 0);

      const purchases = db.commercialPurchases.filter(
        (pur) =>
          pur.companyId === companyId &&
          pur.status !== 'cancelado' &&
          pur.dataCompra >= dataInicio &&
          pur.dataCompra <= dataFim
      );

      const count = db.commercialPeriodClosings.filter((c) => c.companyId === companyId).length + 1;
      const closing: CommercialPeriodClosing = {
        id: crypto.randomUUID(),
        companyId,
        codigo: `FEC-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`,
        modulo: targetMod || 'ambos',
        dataInicio,
        dataFim,
        entradasQtd,
        saidasQtd,
        vendasQtd: prof.vendasAnalisadasQtd,
        vendasValor: prof.receitaTotal,
        custoProdutosVendidos: prof.cmvTotal,
        lucroBrutoEstimado: prof.lucroBrutoEstimado,
        margemBrutaPercentual: prof.margemBrutaMediaPercentual,
        comprasQtd: purchases.length,
        comprasValor: Number(purchases.reduce((acc, p) => acc + p.valorTotal, 0).toFixed(2)),
        perdasQtd: prof.perdasQtd,
        perdasValor: prof.perdasValor,
        despesasOperacionaisRegistradas: prof.despesasOperacionaisRegistradas,
        lucroLiquidoObservado: prof.lucroLiquidoObservado,
        notaLucroLiquido: prof.notaLucroLiquido,
        observacoes: observacoes ? String(observacoes).trim() : undefined,
        fechadoPorId: req.user!.id,
        fechadoPorNome: req.user!.name,
        criadoEm: new Date().toISOString(),
      };

      db.commercialPeriodClosings.push(closing);
      db.save();

      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name,
        companyId,
        acao: 'FECHAMENTO_GERENCIAL_COMERCIAL',
        detalhes: `Fechamento ${closing.codigo} (${dataInicio} a ${dataFim}) gerado. Vendas: R$ ${closing.vendasValor.toFixed(2)}, Lucro Bruto Est.: R$ ${closing.lucroBrutoEstimado.toFixed(2)}.`,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: `Fechamento gerencial ${closing.codigo} consolidado e registrado!`,
        closing,
      });
    }
  );

  // =========================================================================
  // FASE 3 — PEDIDOS, ENTREGAS, CLIENTES (LGPD) & CATÁLOGO INTERNO
  // =========================================================================

  router.get('/orders', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { status, modulo, tipoAtendimento, search } = req.query;

    let list = db.commercialOrders.filter((o) => o.companyId === companyId);
    if (status && typeof status === 'string' && status !== 'todos') {
      list = list.filter((o) => o.status === status);
    }
    if (modulo && (modulo === 'adega' || modulo === 'tabacaria')) {
      list = list.filter((o) => o.modulo === modulo || o.modulo === 'misto');
    }
    if (tipoAtendimento && typeof tipoAtendimento === 'string' && tipoAtendimento !== 'todos') {
      list = list.filter((o) => o.tipoAtendimento === tipoAtendimento);
    }
    if (search && typeof search === 'string' && search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.codigoPedido.toLowerCase().includes(term) ||
          o.clienteNome.toLowerCase().includes(term) ||
          (o.entregadorNome && o.entregadorNome.toLowerCase().includes(term))
      );
    }

    list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
    res.json({ success: true, orders: list, total: list.length });
  });

  router.post('/orders', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const {
      customerId,
      clienteNome,
      clienteTelefone,
      enderecoEntrega,
      bairro,
      cidade,
      tipoAtendimento = 'entrega',
      itens,
      taxaEntrega = 0,
      desconto = 0,
      formaPagamento = 'pagamento_entrega',
      verificacaoMaioridadeSolicitada = false,
      entregadorNome,
      entregadorTelefone,
      observacoes,
    } = req.body;

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      res.status(400).json({ error: 'O pedido deve possuir ao menos um produto.' });
      return;
    }

    let resolvedNome = clienteNome ? String(clienteNome).trim() : '';
    let resolvedTelefone = clienteTelefone ? String(clienteTelefone).trim() : undefined;
    let resolvedEndereco = enderecoEntrega ? String(enderecoEntrega).trim() : undefined;
    let resolvedBairro = bairro ? String(bairro).trim() : undefined;
    let resolvedCidade = cidade ? String(cidade).trim() : undefined;

    if (customerId) {
      const cust = db.commercialCustomers.find((c) => c.id === customerId && c.companyId === companyId);
      if (cust && !cust.anonimizado) {
        if (!resolvedNome) resolvedNome = cust.nome;
        if (!resolvedTelefone) resolvedTelefone = cust.telefone;
        if (!resolvedEndereco) resolvedEndereco = cust.endereco;
        if (!resolvedBairro) resolvedBairro = cust.bairro;
        if (!resolvedCidade) resolvedCidade = cust.cidade;
      }
    }

    if (!resolvedNome) {
      res.status(400).json({ error: 'Nome do cliente é obrigatório no pedido.' });
      return;
    }

    if (tipoAtendimento === 'entrega' && !resolvedEndereco) {
      res.status(400).json({ error: 'Endereço de entrega é obrigatório para pedidos de delivery.' });
      return;
    }

    let contemItemRestrito = false;
    const restrictedNames: string[] = [];
    const mods = new Set<'adega' | 'tabacaria'>();
    let valorItens = 0;
    let custoTotalEstimado = 0;
    const orderItems: CommercialOrder['itens'] = [];

    for (const row of itens) {
      const product = db.commercialProducts.find(
        (p) => p.id === row.productId && p.companyId === companyId && p.ativo
      );
      if (!product) {
        res.status(404).json({ error: `Produto não encontrado ou inativo: ${row.productId}` });
        return;
      }
      const qty = parseInt(row.quantidade, 10);
      if (isNaN(qty) || qty <= 0) {
        res.status(400).json({ error: `Quantidade inválida para ${product.nome}.` });
        return;
      }
      if (product.estoqueAtual < qty) {
        res.status(400).json({
          error: `Estoque insuficiente de ${product.nome}. Disponível: ${product.estoqueAtual} ${product.unidade}.`,
        });
        return;
      }

      const restricted = isRestrictedProduct(product);
      if (restricted) {
        contemItemRestrito = true;
        restrictedNames.push(product.nome);
      }

      mods.add(product.modulo);
      const unitPrice = parseFloat(row.precoUnitario) >= 0 ? parseFloat(row.precoUnitario) : product.precoVenda;
      const totalLine = Number((unitPrice * qty).toFixed(2));
      valorItens += totalLine;
      custoTotalEstimado += Number((product.precoCusto * qty).toFixed(2));

      orderItems.push({
        productId: product.id,
        sku: product.sku,
        nome: product.nome,
        quantidade: qty,
        precoUnitario: unitPrice,
        precoCusto: product.precoCusto,
        total: totalLine,
        itemRestrito: restricted,
      });
    }

    if (contemItemRestrito && !verificacaoMaioridadeSolicitada) {
      res.status(403).json({
        error: `Pedido bloqueado por conformidade legal (+18): O pedido contém itens restritos (${restrictedNames.join(', ')}). É obrigatório confirmar a solicitação de documento de maioridade no recebimento e na entrega.`,
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const count = db.commercialOrders.filter((o) => o.companyId === companyId).length + 1;
    const codigoPedido = `PED-COM-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;

    // Reserve stock atomically
    for (const it of orderItems) {
      const prod = db.commercialProducts.find((p) => p.id === it.productId)!;
      const qtdAnt = prod.estoqueAtual;
      prod.estoqueAtual = qtdAnt - it.quantidade;
      prod.atualizadoEm = nowIso;

      db.commercialStockMovements.push({
        id: crypto.randomUUID(),
        companyId,
        productId: prod.id,
        productNome: prod.nome,
        modulo: prod.modulo,
        tipo: 'saida_venda',
        quantidade: it.quantidade,
        quantidadeAnterior: qtdAnt,
        quantidadeNova: prod.estoqueAtual,
        custoUnitarioNoMovimento: prod.precoCusto,
        motivo: `Reserva/Saída Pedido ${codigoPedido}`,
        usuarioId: req.user!.id,
        usuarioNome: req.user!.name,
        referenciaId: codigoPedido,
        criadoEm: nowIso,
      });
    }

    const taxa = Math.max(0, Number(taxaEntrega) || 0);
    const desc = Math.max(0, Number(desconto) || 0);
    const valorTotal = Number(Math.max(0, valorItens + taxa - desc).toFixed(2));
    const modOrder: 'adega' | 'tabacaria' | 'misto' =
      mods.size > 1 ? 'misto' : Array.from(mods)[0] || 'adega';

    const order: CommercialOrder = {
      id: crypto.randomUUID(),
      companyId,
      codigoPedido,
      modulo: modOrder,
      customerId: customerId || undefined,
      clienteNome: resolvedNome,
      clienteTelefone: resolvedTelefone,
      enderecoEntrega: resolvedEndereco,
      bairro: resolvedBairro,
      cidade: resolvedCidade,
      tipoAtendimento,
      itens: orderItems,
      valorItens: Number(valorItens.toFixed(2)),
      taxaEntrega: taxa,
      desconto: desc,
      valorTotal,
      custoTotalEstimado: Number(custoTotalEstimado.toFixed(2)),
      formaPagamento,
      contemItemRestrito,
      verificacaoMaioridadeSolicitada: Boolean(verificacaoMaioridadeSolicitada),
      status: 'recebido',
      entregadorNome: entregadorNome ? String(entregadorNome).trim() : undefined,
      entregadorTelefone: entregadorTelefone ? String(entregadorTelefone).trim() : undefined,
      ocorrencias: [],
      historicoStatus: [
        {
          status: 'recebido',
          dataHora: nowIso,
          autorId: req.user!.id,
          autorNome: req.user!.name,
          observacao: 'Pedido registrado no módulo comercial',
        },
      ],
      iniciadoEm: nowIso,
      observacoes: observacoes ? String(observacoes).trim() : undefined,
      criadoPorId: req.user!.id,
      criadoPorNome: req.user!.name,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    };

    db.commercialOrders.push(order);
    db.save();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      companyId,
      acao: 'CRIACAO_PEDIDO_COMERCIAL',
      detalhes: `Pedido ${order.codigoPedido} criado para ${order.clienteNome}. Total: R$ ${order.valorTotal.toFixed(2)}. Restrição +18: ${order.contemItemRestrito ? 'SIM' : 'NÃO'}`,
      ip: req.ip,
    });

    res.status(201).json({ success: true, message: `Pedido ${order.codigoPedido} criado!`, order });
  });

  router.patch('/orders/:id/status', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const {
      status,
      observacao,
      entregadorId,
      entregadorNome,
      entregadorTelefone,
      verificacaoMaioridadeEntrega,
      motivoCancelamento,
    } = req.body;

    const validStatuses: CommercialOrderStatus[] = [
      'recebido',
      'em_separacao',
      'saiu_entrega',
      'entregue',
      'cancelado',
    ];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Status de pedido inválido.' });
      return;
    }

    const order = db.commercialOrders.find((o) => o.id === id && o.companyId === companyId);
    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    if (order.status === 'cancelado') {
      res.status(400).json({ error: 'Pedido cancelado não pode ser reaberto.' });
      return;
    }
    if (order.status === 'entregue' && status !== 'entregue') {
      res.status(400).json({ error: 'Pedido já entregue não pode retroceder de etapa.' });
      return;
    }

    const nowIso = new Date().toISOString();

    if (entregadorId !== undefined) order.entregadorId = entregadorId;
    if (entregadorNome !== undefined) order.entregadorNome = String(entregadorNome).trim();
    if (entregadorTelefone !== undefined) order.entregadorTelefone = String(entregadorTelefone).trim();

    if (status === 'entregue') {
      if (order.contemItemRestrito && !verificacaoMaioridadeEntrega) {
        res.status(403).json({
          error: 'Entrega bloqueada: Este pedido possui item restrito (+18 anos). Confirme a conferência presencial de documento na entrega para concluir.',
        });
        return;
      }
      order.verificacaoMaioridadeEntrega = Boolean(verificacaoMaioridadeEntrega);
      order.entregueEm = nowIso;
      order.duracaoOperacaoMinutos = Math.max(
        1,
        Math.round((new Date(nowIso).getTime() - new Date(order.iniciadoEm).getTime()) / 60000)
      );
    }

    if (status === 'cancelado') {
      const reason = motivoCancelamento || observacao;
      if (!reason || !String(reason).trim()) {
        res.status(400).json({ error: 'Informe o motivo do cancelamento do pedido.' });
        return;
      }
      order.motivoCancelamento = String(reason).trim();
      order.canceladoEm = nowIso;

      // Return stock
      for (const it of order.itens) {
        const prod = db.commercialProducts.find(
          (p) => p.id === it.productId && p.companyId === companyId
        );
        if (prod) {
          const qtdAnt = prod.estoqueAtual;
          prod.estoqueAtual = qtdAnt + it.quantidade;
          prod.atualizadoEm = nowIso;
          db.commercialStockMovements.push({
            id: crypto.randomUUID(),
            companyId,
            productId: prod.id,
            productNome: prod.nome,
            modulo: prod.modulo,
            tipo: 'devolucao',
            quantidade: it.quantidade,
            quantidadeAnterior: qtdAnt,
            quantidadeNova: prod.estoqueAtual,
            motivo: `Estorno cancelamento Pedido ${order.codigoPedido}: ${order.motivoCancelamento}`,
            usuarioId: req.user!.id,
            usuarioNome: req.user!.name,
            referenciaId: order.codigoPedido,
            criadoEm: nowIso,
          });
        }
      }
    }

    order.status = status;
    order.atualizadoEm = nowIso;
    order.historicoStatus.push({
      status,
      dataHora: nowIso,
      autorId: req.user!.id,
      autorNome: req.user!.name,
      observacao: observacao ? String(observacao).trim() : order.motivoCancelamento,
    });

    db.save();
    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      companyId,
      acao: 'ATUALIZACAO_PEDIDO_COMERCIAL',
      detalhes: `Pedido ${order.codigoPedido} alterado para "${status}".`,
      ip: req.ip,
    });

    res.json({ success: true, message: `Pedido atualizado para ${status}.`, order });
  });

  router.post('/orders/:id/occurrences', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const { descricao } = req.body;

    if (!descricao || !String(descricao).trim()) {
      res.status(400).json({ error: 'Descrição da ocorrência é obrigatória.' });
      return;
    }

    const order = db.commercialOrders.find((o) => o.id === id && o.companyId === companyId);
    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado.' });
      return;
    }

    const occ = {
      id: crypto.randomUUID(),
      dataHora: new Date().toISOString(),
      descricao: String(descricao).trim(),
      autorNome: req.user!.name,
    };
    order.ocorrencias.push(occ);
    order.atualizadoEm = occ.dataHora;
    db.save();

    res.status(201).json({ success: true, message: 'Ocorrência registrada no pedido.', order });
  });

  // --- GESTÃO DE CLIENTES COM PRIVACIDADE E LGPD ---
  const maskDocument = (doc?: string) => {
    if (!doc) return undefined;
    const clean = doc.replace(/\s+/g, '');
    if (clean.length <= 4) return '****';
    return `***.***.*${clean.slice(-4)}`;
  };

  router.get('/customers', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const isManager = MANAGER_COMMERCE_ROLES.includes(req.user!.role);

    let list = db.commercialCustomers.filter((c) => c.companyId === companyId);
    if (search) {
      list = list.filter(
        (c) =>
          c.nome.toLowerCase().includes(search) ||
          (c.telefone && c.telefone.toLowerCase().includes(search)) ||
          (c.bairro && c.bairro.toLowerCase().includes(search))
      );
    }

    const enriched = list
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime())
      .map((c) => {
        const customerOrders = db.commercialOrders.filter(
          (o) => o.companyId === companyId && o.customerId === c.id
        );
        return {
          ...c,
          documento: isManager ? c.documento : maskDocument(c.documento),
          totalPedidos: customerOrders.length,
          ultimoPedidoEm: customerOrders[0]?.criadoEm || null,
        };
      });

    res.json({ success: true, customers: enriched });
  });

  router.post('/customers', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const {
      nome,
      telefone,
      email,
      documento,
      endereco,
      bairro,
      cidade,
      observacoes,
      maioridadeVerificada = false,
      consentimentoLgpd = true,
    } = req.body;

    if (!nome || !String(nome).trim()) {
      res.status(400).json({ error: 'Nome do cliente é obrigatório.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const customer: CommercialCustomer = {
      id: crypto.randomUUID(),
      companyId,
      nome: String(nome).trim(),
      telefone: telefone ? String(telefone).trim() : undefined,
      email: email ? String(email).trim() : undefined,
      documento: documento ? String(documento).trim() : undefined,
      endereco: endereco ? String(endereco).trim() : undefined,
      bairro: bairro ? String(bairro).trim() : undefined,
      cidade: cidade ? String(cidade).trim() : undefined,
      observacoes: observacoes ? String(observacoes).trim() : undefined,
      maioridadeVerificada: Boolean(maioridadeVerificada),
      consentimentoLgpd: Boolean(consentimentoLgpd),
      consentimentoLgpdEm: consentimentoLgpd ? nowIso : undefined,
      anonimizado: false,
      ativo: true,
      criadoEm: nowIso,
      atualizadoEm: nowIso,
    };

    db.commercialCustomers.push(customer);
    db.save();

    res.status(201).json({ success: true, message: 'Cliente cadastrado com sucesso!', customer });
  });

  router.put('/customers/:id', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { id } = req.params;
    const customer = db.commercialCustomers.find((c) => c.id === id && c.companyId === companyId);
    if (!customer) {
      res.status(404).json({ error: 'Cliente não encontrado.' });
      return;
    }
    if (customer.anonimizado) {
      res.status(403).json({ error: 'Registro anonimizado via LGPD não pode ser reativado.' });
      return;
    }

    const fields = ['nome', 'telefone', 'email', 'documento', 'endereco', 'bairro', 'cidade', 'observacoes'];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        (customer as any)[f] = String(req.body[f]).trim() || undefined;
      }
    }
    if (req.body.maioridadeVerificada !== undefined) {
      customer.maioridadeVerificada = Boolean(req.body.maioridadeVerificada);
    }
    if (req.body.ativo !== undefined) customer.ativo = Boolean(req.body.ativo);
    customer.atualizadoEm = new Date().toISOString();

    db.save();
    res.json({ success: true, message: 'Dados do cliente atualizados.', customer });
  });

  router.post(
    '/customers/:id/anonymize',
    requireCommerceRole(MANAGER_COMMERCE_ROLES),
    (req: AuthRequest, res: Response) => {
      ensureCollections();
      const companyId = getEffectiveCompanyId(req);
      const { id } = req.params;
      const customer = db.commercialCustomers.find((c) => c.id === id && c.companyId === companyId);
      if (!customer) {
        res.status(404).json({ error: 'Cliente não encontrado.' });
        return;
      }

      const nowIso = new Date().toISOString();
      customer.nome = `Cliente Anonimizado (${customer.id.slice(0, 6)})`;
      customer.telefone = undefined;
      customer.email = undefined;
      customer.documento = undefined;
      customer.endereco = undefined;
      customer.bairro = undefined;
      customer.cidade = undefined;
      customer.observacoes = 'Dados pessoais anonimizados por solicitação LGPD.';
      customer.anonimizado = true;
      customer.anonimizadoEm = nowIso;
      customer.ativo = false;
      customer.atualizadoEm = nowIso;

      // Also scrub direct PII from linked orders
      for (const ord of db.commercialOrders) {
        if (ord.companyId === companyId && ord.customerId === customer.id) {
          ord.clienteNome = customer.nome;
          ord.clienteTelefone = undefined;
          ord.enderecoEntrega = undefined;
        }
      }

      db.save();
      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name,
        companyId,
        acao: 'ANONIMIZACAO_LGPD_CLIENTE',
        detalhes: `Dados pessoais do cliente ${customer.id} anonimizados em conformidade com a LGPD.`,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Dados pessoais anonimizados com sucesso em conformidade com a LGPD.',
        customer,
      });
    }
  );

  // Authenticated Digital Catalog Preview (strictly enforces same non-restricted filter!)
  router.get('/catalog', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const pilot = getOrCreatePilotConfig(companyId);

    const allProducts = db.commercialProducts.filter((p) => p.companyId === companyId && p.ativo);
    const publicItems = allProducts
      .filter((p) => p.classificacaoLegal === 'sem_restricao' && (p.idadeMinima || 0) === 0)
      .map((p) => ({
        id: p.id,
        modulo: p.modulo,
        sku: p.sku,
        nome: p.nome,
        categoria: p.categoria,
        marca: p.marca || null,
        descricao: p.descricao || null,
        precoVenda: p.precoVenda,
        unidade: p.unidade,
        disponivel: p.estoqueAtual > 0,
        fotoUrl: p.fotoUrl || null,
      }));

    const blockedRestrictedCount = allProducts.length - publicItems.length;

    res.json({
      success: true,
      companyId,
      catalogoPublicoAtivo: pilot.catalogoPublicoAtivo,
      catalogoTitulo: pilot.catalogoTitulo,
      whatsappPedidos: pilot.whatsappPedidos,
      publicPath: `/catalogo/${companyId}`,
      items: publicItems,
      blockedRestrictedCount,
    });
  });

  // =========================================================================
  // FASE 4 — IMPLANTAÇÃO, MODO ESPELHO 7 DIAS, IMPORTAÇÃO XLSX/CSV, AVALIAÇÃO E MIGRAÇÃO
  // =========================================================================

  router.get('/pilot', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const pilot = getOrCreatePilotConfig(companyId);

    const products = db.commercialProducts.filter((p) => p.companyId === companyId);
    const suppliers = db.commercialSuppliers.filter((s) => s.companyId === companyId);
    const sales = db.commercialSales.filter((s) => s.companyId === companyId && s.status === 'concluida');
    const orders = db.commercialOrders.filter((o) => o.companyId === companyId);
    const imports = db.commercialImportBatches.filter((b) => b.companyId === companyId);

    const nowMs = Date.now();
    let diasRestantesEspelho: number | null = null;
    if (pilot.modoEspelho.ativo && pilot.modoEspelho.expiraEm) {
      const diffMs = new Date(pilot.modoEspelho.expiraEm).getTime() - nowMs;
      diasRestantesEspelho = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    }

    const totalChecklist = Object.keys(pilot.checklistPassos).length;
    const completedChecklist = Object.values(pilot.checklistPassos).filter((v) => v.concluido).length;

    res.json({
      success: true,
      pilot,
      diasRestantesEspelho,
      progressoChecklistPercentual:
        totalChecklist > 0 ? Math.round((completedChecklist / totalChecklist) * 100) : 0,
      estatisticasEspelho: {
        produtosImportadosEspelho: products.filter((p) => p.origemRegistro === 'importado_espelho').length,
        produtosCadastradosMovilog: products.filter((p) => p.origemRegistro !== 'importado_espelho').length,
        fornecedoresImportadosEspelho: suppliers.filter((s) => s.origemRegistro === 'importado_espelho').length,
        fornecedoresMovilog: suppliers.filter((s) => s.origemRegistro !== 'importado_espelho').length,
        vendasRegistradasMovilog: sales.length,
        pedidosRegistradosMovilog: orders.length,
        lotesImportacao: imports.length,
      },
    });
  });

  router.put('/pilot', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const pilot = getOrCreatePilotConfig(companyId);

    const {
      estabelecimentoNome,
      estabelecimentoCnpj,
      estabelecimentoEndereco,
      whatsappPedidos,
      catalogoPublicoAtivo,
      catalogoTitulo,
      toggleChecklistPasso,
    } = req.body;

    if (estabelecimentoNome !== undefined) pilot.estabelecimentoNome = String(estabelecimentoNome).trim();
    if (estabelecimentoCnpj !== undefined) pilot.estabelecimentoCnpj = String(estabelecimentoCnpj).trim();
    if (estabelecimentoEndereco !== undefined) {
      pilot.estabelecimentoEndereco = String(estabelecimentoEndereco).trim();
    }
    if (whatsappPedidos !== undefined) pilot.whatsappPedidos = String(whatsappPedidos).trim();
    if (catalogoPublicoAtivo !== undefined) pilot.catalogoPublicoAtivo = Boolean(catalogoPublicoAtivo);
    if (catalogoTitulo !== undefined) pilot.catalogoTitulo = String(catalogoTitulo).trim();

    if (toggleChecklistPasso && typeof toggleChecklistPasso === 'string') {
      const current = pilot.checklistPassos[toggleChecklistPasso]?.concluido || false;
      pilot.checklistPassos[toggleChecklistPasso] = {
        concluido: !current,
        concluidoEm: !current ? new Date().toISOString() : undefined,
        concluidoPorNome: !current ? req.user!.name : undefined,
      };
    }

    pilot.atualizadoEm = new Date().toISOString();
    db.save();

    res.json({ success: true, message: 'Configurações de implantação atualizadas.', pilot });
  });

  router.post('/pilot/mirror-mode', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const pilot = getOrCreatePilotConfig(companyId);
    const { action, sistemaAnteriorNome, observacoes } = req.body;

    const now = new Date();
    const nowIso = now.toISOString();

    if (action === 'start') {
      const exp = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      pilot.modoEspelho = {
        ativo: true,
        iniciadoEm: pilot.modoEspelho.iniciadoEm || nowIso,
        expiraEm: pilot.modoEspelho.expiraEm || exp,
        sistemaAnteriorNome: sistemaAnteriorNome ? String(sistemaAnteriorNome).trim() : 'Sistema Atual do Estabelecimento',
        observacoes: observacoes ? String(observacoes).trim() : undefined,
      };
    } else if (action === 'pause') {
      pilot.modoEspelho.ativo = false;
      pilot.modoEspelho.pausadoEm = nowIso;
    } else if (action === 'resume') {
      pilot.modoEspelho.ativo = true;
      pilot.modoEspelho.pausadoEm = undefined;
      if (!pilot.modoEspelho.iniciadoEm) {
        pilot.modoEspelho.iniciadoEm = nowIso;
        pilot.modoEspelho.expiraEm = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      }
    } else {
      res.status(400).json({ error: 'Ação inválida para Modo Espelho.' });
      return;
    }

    pilot.atualizadoEm = nowIso;
    db.save();

    res.json({
      success: true,
      message:
        action === 'pause'
          ? 'Modo Espelho pausado sem perda de dados.'
          : 'Modo Espelho de 7 dias ativado para operação paralela segura!',
      pilot,
    });
  });

  // --- CENTRAL DE IMPORTAÇÃO (CSV & XLSX REAL PARSING) ---
  router.post('/imports/parse', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const { fileName, contentBase64, csvText, tipoAlvo = 'produtos' } = req.body;

    if (!fileName || (!contentBase64 && csvText === undefined)) {
      res.status(400).json({ error: 'Envie um arquivo CSV ou XLSX válido.' });
      return;
    }
    if (!['produtos', 'fornecedores'].includes(tipoAlvo)) {
      res.status(400).json({ error: 'Tipo de importação inválido ("produtos" ou "fornecedores").' });
      return;
    }

    try {
      const parsed = parseSpreadsheetBuffer({ fileName, contentBase64, csvText });
      if (parsed.rows.length === 0) {
        res.status(400).json({ error: 'O arquivo não contém linhas de dados após o cabeçalho.' });
        return;
      }

      const suggestedMapping = suggestImportColumnMapping(parsed.headers, tipoAlvo);

      // Existing keys for duplicate preview
      const existingSkus = new Set(
        db.commercialProducts
          .filter((p) => p.companyId === companyId)
          .map((p) => p.sku.trim().toUpperCase())
      );
      const existingBarcodes = new Set(
        db.commercialProducts
          .filter((p) => p.companyId === companyId && p.codigoBarras)
          .map((p) => p.codigoBarras!.trim())
      );
      const existingCnpjs = new Set(
        db.commercialSuppliers
          .filter((s) => s.companyId === companyId && s.cnpjCpf)
          .map((s) => s.cnpjCpf.replace(/\D/g, ''))
      );

      res.json({
        success: true,
        formato: parsed.formato,
        headers: parsed.headers,
        suggestedMapping,
        totalLinhas: parsed.rows.length,
        rows: parsed.rows.slice(0, 500),
        existingKeys: {
          skusCount: existingSkus.size,
          barcodesCount: existingBarcodes.size,
          cnpjsCount: existingCnpjs.size,
        },
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Falha ao ler arquivo CSV/XLSX.' });
    }
  });

  router.post('/imports/commit', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const {
      fileName = 'importacao.xlsx',
      formato = 'xlsx',
      tipoAlvo = 'produtos',
      modulo = 'adega',
      modoEspelho = true,
      mapeamentoColunas = {},
      rows,
    } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'Nenhuma linha enviada para importação.' });
      return;
    }

    const origemTag = modoEspelho ? 'importado_espelho' : 'migrado';
    const nowIso = new Date().toISOString();
    let importadosQtd = 0;
    let ignoradosDuplicadosQtd = 0;
    const errosDetalhes: { linha: number; erro: string }[] = [];

    if (tipoAlvo === 'produtos') {
      const existingSkus = new Set(
        db.commercialProducts
          .filter((p) => p.companyId === companyId)
          .map((p) => p.sku.trim().toUpperCase())
      );
      const existingBarcodes = new Set(
        db.commercialProducts
          .filter((p) => p.companyId === companyId && p.codigoBarras)
          .map((p) => p.codigoBarras!.trim())
      );

      const getCol = (row: Record<string, any>, field: string) => {
        const mappedKey = mapeamentoColunas[field];
        if (mappedKey && row[mappedKey] !== undefined) return String(row[mappedKey]).trim();
        if (row[field] !== undefined) return String(row[field]).trim();
        return '';
      };

      const parseNum = (val: string, fallback: number) => {
        if (!val) return fallback;
        const normalized = val.replace(/[R$\s]/g, '').replace(',', '.');
        const num = parseFloat(normalized);
        return Number.isFinite(num) && num >= 0 ? num : NaN;
      };

      rows.forEach((row: Record<string, any>, idx: number) => {
        const lineNum = idx + 2;
        const nome = getCol(row, 'nome');
        if (!nome) {
          errosDetalhes.push({ linha: lineNum, erro: 'Nome do produto ausente.' });
          return;
        }

        const rawSku = getCol(row, 'sku');
        const sku = rawSku
          ? rawSku.toUpperCase()
          : `${modulo === 'adega' ? 'ADG' : 'TAB'}-IMP-${Date.now().toString().slice(-4)}-${idx + 1}`;
        const codigoBarras = getCol(row, 'codigoBarras') || undefined;

        if (existingSkus.has(sku) || (codigoBarras && existingBarcodes.has(codigoBarras))) {
          ignoradosDuplicadosQtd++;
          return;
        }

        const precoCusto = parseNum(getCol(row, 'precoCusto'), 0);
        const precoVenda = parseNum(getCol(row, 'precoVenda'), 0);
        if (Number.isNaN(precoCusto) || Number.isNaN(precoVenda)) {
          errosDetalhes.push({ linha: lineNum, erro: `Preço inválido para "${nome}".` });
          return;
        }

        const estoqueAtual = Math.floor(parseNum(getCol(row, 'estoqueAtual'), 0) || 0);
        const estoqueMinimo = Math.floor(parseNum(getCol(row, 'estoqueMinimo'), 5) || 5);
        const estoqueMaximoRaw = getCol(row, 'estoqueMaximo');
        const estoqueMaximo = estoqueMaximoRaw ? Math.floor(parseNum(estoqueMaximoRaw, 0) || 0) : undefined;
        const categoria = getCol(row, 'categoria') || (modulo === 'adega' ? 'Bebidas' : 'Tabacaria');
        const marca = getCol(row, 'marca') || undefined;
        const unidade = getCol(row, 'unidade') || 'un';

        const classRaw = getCol(row, 'classificacaoLegal').toLowerCase();
        let classificacaoLegal: CommercialProduct['classificacaoLegal'] = 'sem_restricao';
        let idadeMinima = 0;

        if (
          classRaw.includes('alcool') ||
          classRaw.includes('álcool') ||
          categoria.toLowerCase().includes('cerveja') ||
          categoria.toLowerCase().includes('vinho') ||
          categoria.toLowerCase().includes('destilad') ||
          nome.toLowerCase().includes('cerveja') ||
          nome.toLowerCase().includes('vinho') ||
          nome.toLowerCase().includes('whisky') ||
          nome.toLowerCase().includes('vodka')
        ) {
          classificacaoLegal = 'bebida_alcoolica';
          idadeMinima = 18;
        } else if (
          classRaw.includes('tabaco') ||
          categoria.toLowerCase().includes('tabaco') ||
          categoria.toLowerCase().includes('cigarro') ||
          nome.toLowerCase().includes('tabaco') ||
          nome.toLowerCase().includes('charuto') ||
          nome.toLowerCase().includes('cigarro')
        ) {
          classificacaoLegal = 'tabaco_derivados';
          idadeMinima = 18;
        } else if (classRaw.includes('restrit') || classRaw.includes('18')) {
          classificacaoLegal = 'outro_restrito';
          idadeMinima = 18;
        }

        const product: CommercialProduct = {
          id: crypto.randomUUID(),
          companyId,
          modulo: modulo === 'tabacaria' ? 'tabacaria' : 'adega',
          sku,
          codigoBarras,
          nome,
          categoria,
          classificacaoLegal,
          marca,
          precoCusto,
          precoVenda,
          estoqueAtual,
          estoqueMinimo,
          estoqueMaximo,
          unidade,
          idadeMinima,
          origemRegistro: origemTag,
          ativo: true,
          criadoEm: nowIso,
          atualizadoEm: nowIso,
        };

        db.commercialProducts.push(product);
        existingSkus.add(sku);
        if (codigoBarras) existingBarcodes.add(codigoBarras);

        if (estoqueAtual > 0) {
          db.commercialStockMovements.push({
            id: crypto.randomUUID(),
            companyId,
            productId: product.id,
            productNome: product.nome,
            modulo: product.modulo,
            tipo: 'entrada_compra',
            quantidade: estoqueAtual,
            quantidadeAnterior: 0,
            quantidadeNova: estoqueAtual,
            custoUnitarioNoMovimento: precoCusto,
            motivo: `Importação ${fileName} (${origemTag})`,
            usuarioId: req.user!.id,
            usuarioNome: req.user!.name,
            origemRegistro: origemTag,
            criadoEm: nowIso,
          });
        }
        importadosQtd++;
      });
    } else {
      const existingNames = new Set(
        db.commercialSuppliers
          .filter((s) => s.companyId === companyId)
          .map((s) => s.razaoSocial.trim().toLowerCase())
      );
      const existingCnpjs = new Set(
        db.commercialSuppliers
          .filter((s) => s.companyId === companyId && s.cnpjCpf)
          .map((s) => s.cnpjCpf.replace(/\D/g, ''))
      );

      const getCol = (row: Record<string, any>, field: string) => {
        const mappedKey = mapeamentoColunas[field];
        if (mappedKey && row[mappedKey] !== undefined) return String(row[mappedKey]).trim();
        if (row[field] !== undefined) return String(row[field]).trim();
        return '';
      };

      rows.forEach((row: Record<string, any>, idx: number) => {
        const lineNum = idx + 2;
        const razaoSocial = getCol(row, 'razaoSocial') || getCol(row, 'nomeFantasia');
        if (!razaoSocial) {
          errosDetalhes.push({ linha: lineNum, erro: 'Razão Social / Nome do fornecedor ausente.' });
          return;
        }
        const cnpjCpf = getCol(row, 'cnpjCpf');
        const cleanDoc = cnpjCpf.replace(/\D/g, '');
        if (existingNames.has(razaoSocial.toLowerCase()) || (cleanDoc && existingCnpjs.has(cleanDoc))) {
          ignoradosDuplicadosQtd++;
          return;
        }

        const segRaw = getCol(row, 'segmento').toLowerCase();
        const segmento: CommercialSupplier['segmento'] =
          segRaw === 'adega' || segRaw === 'tabacaria' ? segRaw : 'ambos';

        const supplier: CommercialSupplier = {
          id: crypto.randomUUID(),
          companyId,
          razaoSocial,
          nomeFantasia: getCol(row, 'nomeFantasia') || razaoSocial,
          cnpjCpf,
          contatoNome: getCol(row, 'contatoNome'),
          telefone: getCol(row, 'telefone'),
          email: getCol(row, 'email'),
          segmento,
          origemRegistro: origemTag,
          ativo: true,
          criadoEm: nowIso,
        };
        db.commercialSuppliers.push(supplier);
        existingNames.add(razaoSocial.toLowerCase());
        if (cleanDoc) existingCnpjs.add(cleanDoc);
        importadosQtd++;
      });
    }

    const batch: CommercialImportBatch = {
      id: crypto.randomUUID(),
      companyId,
      arquivoNome: String(fileName),
      formato: formato === 'csv' ? 'csv' : 'xlsx',
      tipoAlvo: tipoAlvo === 'fornecedores' ? 'fornecedores' : 'produtos',
      modulo: modulo === 'tabacaria' ? 'tabacaria' : 'adega',
      modoEspelho: Boolean(modoEspelho),
      totalLinhas: rows.length,
      importadosQtd,
      ignoradosDuplicadosQtd,
      errosQtd: errosDetalhes.length,
      mapeamentoColunas,
      errosDetalhes: errosDetalhes.slice(0, 50),
      usuarioId: req.user!.id,
      usuarioNome: req.user!.name,
      criadoEm: nowIso,
    };

    db.commercialImportBatches.push(batch);
    db.save();

    db.logAudit({
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: req.user!.name,
      companyId,
      acao: 'IMPORTACAO_PLANILHA_COMERCIAL',
      detalhes: `Importação ${batch.arquivoNome} (${batch.tipoAlvo}): ${importadosQtd} importado(s), ${ignoradosDuplicadosQtd} duplicado(s) ignorado(s), ${errosDetalhes.length} erro(s).`,
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: `${importadosQtd} registro(s) importado(s) com sucesso! (${ignoradosDuplicadosQtd} duplicado(s) ignorado(s), ${errosDetalhes.length} erro(s)).`,
      batch,
    });
  });

  router.get('/imports/history', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const batches = db.commercialImportBatches
      .filter((b) => b.companyId === companyId)
      .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
    res.json({ success: true, batches });
  });

  // --- RELATÓRIO DE AVALIAÇÃO (DADOS REAIS DO PERÍODO) ---
  router.get('/pilot/evaluation', (req: AuthRequest, res: Response) => {
    ensureCollections();
    const companyId = getEffectiveCompanyId(req);
    const pilot = getOrCreatePilotConfig(companyId);

    const products = db.commercialProducts.filter((p) => p.companyId === companyId);
    const suppliers = db.commercialSuppliers.filter((s) => s.companyId === companyId);
    const sales = db.commercialSales.filter((s) => s.companyId === companyId && s.status === 'concluida');
    const orders = db.commercialOrders.filter((o) => o.companyId === companyId);
    const losses = db.commercialLosses.filter((l) => l.companyId === companyId);
    const inventories = db.commercialInventories.filter((i) => i.companyId === companyId);
    const closings = db.commercialPeriodClosings.filter((c) => c.companyId === companyId);
    const customers = db.commercialCustomers.filter((c) => c.companyId === companyId && !c.anonimizado);
    const imports = db.commercialImportBatches.filter((b) => b.companyId === companyId);
    const cashSessions = db.commercialCashSessions.filter((c) => c.companyId === companyId);
    const alerts = db.commercialAlerts.filter((a) => a.companyId === companyId);

    const recursosAvaliados = [
      { recurso: 'PDV & Vendas', utilizado: sales.length > 0, registros: sales.length },
      { recurso: 'Abertura/Fechamento de Caixa', utilizado: cashSessions.length > 0, registros: cashSessions.length },
      { recurso: 'Cadastro & Importação de Produtos', utilizado: products.length > 0, registros: products.length },
      { recurso: 'Gestão de Fornecedores', utilizado: suppliers.length > 0, registros: suppliers.length },
      { recurso: 'Central de Pedidos & Entregas', utilizado: orders.length > 0, registros: orders.length },
      { recurso: 'Controle de Perdas', utilizado: losses.length > 0, registros: losses.length },
      { recurso: 'Inventário Físico', utilizado: inventories.length > 0, registros: inventories.length },
      { recurso: 'Fechamento Gerencial', utilizado: closings.length > 0, registros: closings.length },
      { recurso: 'Gestão de Clientes (LGPD)', utilizado: customers.length > 0, registros: customers.length },
      { recurso: 'Central de Importação XLSX/CSV', utilizado: imports.length > 0, registros: imports.length },
    ];

    const recursosUtilizadosCount = recursosAvaliados.filter((r) => r.utilizado).length;
    const faturamentoRealObservado = Number(sales.reduce((acc, s) => acc + s.valorTotal, 0).toFixed(2));
    const perdasEvitadasOuMapeadasValor = Number(
      losses.reduce((acc, l) => acc + l.custoTotalImpacto, 0).toFixed(2)
    );

    const notaAvaliacao =
      sales.length === 0 && orders.length === 0
        ? 'Dados insuficientes para avaliação conclusiva: ainda não há vendas no PDV ou pedidos operacionais registrados nesta empresa.'
        : `Operação avaliada com base em ${sales.length} venda(s) PDV, ${orders.length} pedido(s), ${products.length} produto(s) e ${recursosUtilizadosCount} de ${recursosAvaliados.length} recursos utilizados.`;

    res.json({
      success: true,
      pilot,
      metricasReais: {
        produtosTotais: products.length,
        produtosImportadosEspelho: products.filter((p) => p.origemRegistro === 'importado_espelho').length,
        vendasPdvQtd: sales.length,
        faturamentoPdvValor: faturamentoRealObservado,
        pedidosQtd: orders.length,
        pedidosEntreguesQtd: orders.filter((o) => o.status === 'entregue').length,
        perdasRegistradasQtd: losses.length,
        perdasValor: perdasEvitadasOuMapeadasValor,
        inventariosQtd: inventories.length,
        alertasResolvidosQtd: alerts.filter((a) => a.status === 'resolvido').length,
        clientesAtivosQtd: customers.length,
        importacoesRealizadasQtd: imports.length,
        recursosUtilizadosCount,
        recursosTotaisCount: recursosAvaliados.length,
      },
      recursosAvaliados,
      notaAvaliacao,
    });
  });

  // --- CENTRAL DE MIGRAÇÃO CONTROLADA ---
  router.post(
    '/migration/action',
    requireCommerceRole(MANAGER_COMMERCE_ROLES),
    (req: AuthRequest, res: Response) => {
      ensureCollections();
      const companyId = getEffectiveCompanyId(req);
      const pilot = getOrCreatePilotConfig(companyId);
      const { action, etapa, observacao } = req.body;
      const nowIso = new Date().toISOString();

      const addLog = (status: string, step: string, detalhes: string) => {
        pilot.migracao.historicoLogs.unshift({
          id: crypto.randomUUID(),
          dataHora: nowIso,
          etapa: step,
          status,
          detalhes,
          autorNome: req.user!.name,
        });
      };

      const products = db.commercialProducts.filter((p) => p.companyId === companyId);
      const suppliers = db.commercialSuppliers.filter((s) => s.companyId === companyId);

      // Detect real data consistency issues before cutover
      const seenSkus = new Set<string>();
      let duplicateSkuCount = 0;
      let missingPriceCount = 0;
      for (const p of products) {
        const key = p.sku.trim().toUpperCase();
        if (seenSkus.has(key)) duplicateSkuCount++;
        seenSkus.add(key);
        if (p.precoVenda <= 0) missingPriceCount++;
      }
      const conflicts = duplicateSkuCount + missingPriceCount;
      pilot.migracao.conflitosDetectados = conflicts;
      pilot.migracao.ultimoCheckEm = nowIso;

      if (action === 'check_conflicts') {
        pilot.migracao.status = conflicts === 0 && products.length > 0 ? 'validada' : 'em_preparacao';
        addLog(
          pilot.migracao.status,
          'verificacao_integridade',
          `Verificados ${products.length} produto(s) e ${suppliers.length} fornecedor(es). Conflitos: ${conflicts} (${duplicateSkuCount} SKU duplicado, ${missingPriceCount} sem preço de venda).`
        );
      } else if (action === 'start') {
        if (products.length === 0) {
          res.status(400).json({ error: 'Importe ou cadastre produtos antes de iniciar a migração.' });
          return;
        }
        pilot.migracao.status = 'em_execucao';
        pilot.migracao.iniciadoEm = pilot.migracao.iniciadoEm || nowIso;
        pilot.migracao.pausadoEm = undefined;
        pilot.migracao.etapaAtual = etapa || 'congelamento_planilha_espelho';
        addLog('em_execucao', pilot.migracao.etapaAtual, observacao || 'Migração iniciada de forma assistida.');
      } else if (action === 'complete_step') {
        if (!etapa) {
          res.status(400).json({ error: 'Informe a etapa a concluir.' });
          return;
        }
        if (!pilot.migracao.etapasConcluidas.includes(etapa)) {
          pilot.migracao.etapasConcluidas.push(etapa);
        }
        pilot.migracao.etapaAtual = etapa;
        if (pilot.migracao.status === 'nao_iniciada' || pilot.migracao.status === 'validada') {
          pilot.migracao.status = 'em_execucao';
        }
        addLog('etapa_concluida', etapa, observacao || `Etapa "${etapa}" concluída.`);
      } else if (action === 'pause') {
        pilot.migracao.status = 'pausada';
        pilot.migracao.pausadoEm = nowIso;
        addLog('pausada', pilot.migracao.etapaAtual, observacao || 'Migração pausada com segurança. Nenhum dado foi perdido.');
      } else if (action === 'resume') {
        pilot.migracao.status = 'em_execucao';
        pilot.migracao.pausadoEm = undefined;
        addLog('em_execucao', pilot.migracao.etapaAtual, observacao || 'Migração retomada a partir do ponto salvo.');
      } else if (action === 'complete') {
        if (conflicts > 0) {
          res.status(409).json({
            error: `Não é possível concluir a migração com ${conflicts} conflito(s) pendente(s). Corrija antes de efetivar a virada.`,
          });
          return;
        }
        // Promote mirror-imported records to active migrated production records
        let promoted = 0;
        for (const p of products) {
          if (p.origemRegistro === 'importado_espelho') {
            p.origemRegistro = 'migrado';
            promoted++;
          }
        }
        for (const s of suppliers) {
          if (s.origemRegistro === 'importado_espelho') {
            s.origemRegistro = 'migrado';
          }
        }
        pilot.migracao.status = 'concluida';
        pilot.migracao.concluidoEm = nowIso;
        pilot.modoEspelho.ativo = false;
        addLog('concluida', 'virada_definitiva', `Migração concluída. ${promoted} item(ns) consolidados em operação principal.`);
      } else {
        res.status(400).json({ error: 'Ação de migração inválida.' });
        return;
      }

      pilot.atualizadoEm = nowIso;
      db.save();

      db.logAudit({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name,
        companyId,
        acao: 'MIGRACAO_CONTROLADA_COMERCIAL',
        detalhes: `Ação de migração "${action}" executada. Status atual: ${pilot.migracao.status}.`,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: 'Estado da migração atualizado com segurança.',
        pilot,
        checklistResumo: {
          produtosTotal: products.length,
          fornecedoresTotal: suppliers.length,
          duplicateSkuCount,
          missingPriceCount,
          conflicts,
        },
      });
    }
  );

  return router;
}
