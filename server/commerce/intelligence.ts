import crypto from 'crypto';
import * as XLSX from 'xlsx';
import {
  db,
  type CommercialAlert,
  type CommercialAlertCategory,
  type CommercialAlertPriority,
  type CommercialCustomer,
  type CommercialInventory,
  type CommercialLoss,
  type CommercialOrder,
  type CommercialPeriodClosing,
  type CommercialPilotConfig,
  type CommercialProduct,
  type CommercialPurchase,
  type CommercialReplenishment,
  type CommercialSale,
  type CommercialStockMovement,
  type CommercialSupplier,
} from '../db.ts';

export interface SmartStockComputation {
  product: CommercialProduct;
  consumoMedioDiario: number | null;
  historicoSuficiente: boolean;
  motivoHistorico: string;
  diasCoberturaEstimada: number | null;
  diasSemMovimentacao: number | null;
  estoqueMaximoConfigurado: number;
  statusEstoque: 'ruptura' | 'critico' | 'atencao' | 'saudavel' | 'parado' | 'excesso';
  sugestaoReposicaoQtd: number;
  justificativaReposicao: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getEffectiveMaxStock(product: CommercialProduct): number {
  if (typeof product.estoqueMaximo === 'number' && product.estoqueMaximo > product.estoqueMinimo) {
    return product.estoqueMaximo;
  }
  const min = Math.max(1, Number(product.estoqueMinimo || 5));
  return Math.max(min * 3, 15);
}

export function isRestrictedProduct(product: Pick<CommercialProduct, 'classificacaoLegal' | 'idadeMinima'>): boolean {
  if (product.classificacaoLegal === 'bebida_alcoolica') return true;
  if (product.classificacaoLegal === 'tabaco_derivados') return true;
  if (product.classificacaoLegal === 'outro_restrito') return true;
  if ((product.idadeMinima || 0) >= 18) return true;
  return false;
}

/**
 * Compute real smart stock metrics from actual completed sales & movements.
 * Never invents fake averages when historical records are insufficient.
 */
export function computeSmartStockForCompany(
  companyId: string,
  modulo?: 'adega' | 'tabacaria',
  nowMs: number = Date.now()
): SmartStockComputation[] {
  const products = db.commercialProducts.filter(
    (p) => p.companyId === companyId && p.ativo && (!modulo || p.modulo === modulo)
  );
  const completedSales = db.commercialSales.filter(
    (s) => s.companyId === companyId && s.status === 'concluida'
  );
  const movements = db.commercialStockMovements.filter((m) => m.companyId === companyId);

  const thirtyDaysAgoMs = nowMs - 30 * MS_PER_DAY;

  return products.map((product) => {
    const estoqueMaximoConfigurado = getEffectiveMaxStock(product);

    // Gather actual sales & exit movements in the last 30 days
    const productMovements = movements.filter((m) => m.productId === product.id);
    const exitMovements30d = productMovements.filter((m) => {
      if (m.tipo !== 'saida_venda') return false;
      const t = new Date(m.criadoEm).getTime();
      return Number.isFinite(t) && t >= thirtyDaysAgoMs && t <= nowMs;
    });

    // Also inspect completed sales directly (in case a sale wasn't duplicated)
    let totalSold30d = 0;
    let earliestSaleMs = Infinity;
    let saleEventsCount = 0;
    for (const s of completedSales) {
      const sMs = new Date(s.criadoEm).getTime();
      if (!Number.isFinite(sMs) || sMs < thirtyDaysAgoMs || sMs > nowMs) continue;
      for (const item of s.itens) {
        if (item.productId === product.id) {
          totalSold30d += Number(item.quantidade || 0);
          saleEventsCount++;
          if (sMs < earliestSaleMs) earliestSaleMs = sMs;
        }
      }
    }

    // Fallback to exit movements if sales count is 0
    if (saleEventsCount === 0 && exitMovements30d.length > 0) {
      for (const m of exitMovements30d) {
        totalSold30d += Number(m.quantidade || 0);
        saleEventsCount++;
        const mMs = new Date(m.criadoEm).getTime();
        if (mMs < earliestSaleMs) earliestSaleMs = mMs;
      }
    }

    // Last movement timestamp
    let lastActivityMs = new Date(product.criadoEm).getTime();
    for (const m of productMovements) {
      const t = new Date(m.criadoEm).getTime();
      if (Number.isFinite(t) && t > lastActivityMs) lastActivityMs = t;
    }
    const diasSemMovimentacao = Number.isFinite(lastActivityMs)
      ? Math.max(0, Math.floor((nowMs - lastActivityMs) / MS_PER_DAY))
      : null;

    // Require minimum 3 sales/exit events OR >= 3 days of observed span with sales to avoid misleading extrapolation
    const observedDays = Number.isFinite(earliestSaleMs)
      ? Math.max(1, Math.ceil((nowMs - earliestSaleMs) / MS_PER_DAY))
      : 0;
    const historicoSuficiente =
      totalSold30d > 0 && (saleEventsCount >= 3 || (observedDays >= 3 && saleEventsCount >= 2));

    let consumoMedioDiario: number | null = null;
    let diasCoberturaEstimada: number | null = null;
    let motivoHistorico = '';

    if (historicoSuficiente) {
      const denominatorDays = Math.min(30, Math.max(observedDays, 3));
      consumoMedioDiario = Number((totalSold30d / denominatorDays).toFixed(2));
      diasCoberturaEstimada =
        consumoMedioDiario > 0
          ? Number((product.estoqueAtual / consumoMedioDiario).toFixed(1))
          : null;
      motivoHistorico = `Baseado em ${totalSold30d} ${product.unidade} vendidos em ${denominatorDays} dias observados (${saleEventsCount} registros reais).`;
    } else if (saleEventsCount > 0) {
      motivoHistorico = `Dados insuficientes para média confiável (${saleEventsCount} saída(s) registrada(s); mínimo recomendado: 3 ocorrências ou 3 dias de histórico).`;
    } else {
      motivoHistorico = 'Dados insuficientes: nenhuma saída por venda registrada nos últimos 30 dias.';
    }

    let statusEstoque: SmartStockComputation['statusEstoque'] = 'saudavel';
    if (product.estoqueAtual <= 0) {
      statusEstoque = 'ruptura';
    } else if (product.estoqueAtual <= product.estoqueMinimo) {
      statusEstoque = 'critico';
    } else if (
      (diasCoberturaEstimada !== null && diasCoberturaEstimada <= 5) ||
      product.estoqueAtual <= Math.ceil(product.estoqueMinimo * 1.35)
    ) {
      statusEstoque = 'atencao';
    } else if (diasSemMovimentacao !== null && diasSemMovimentacao >= 30 && product.estoqueAtual > 0) {
      statusEstoque = 'parado';
    } else if (product.estoqueAtual > estoqueMaximoConfigurado) {
      statusEstoque = 'excesso';
    }

    // Calculate honest restock suggestion
    let sugestaoReposicaoQtd = 0;
    let justificativaReposicao = 'Estoque dentro da faixa operacional configurada.';
    const needsRestock =
      statusEstoque === 'ruptura' || statusEstoque === 'critico' || statusEstoque === 'atencao';

    if (needsRestock) {
      const targetByConsumption =
        consumoMedioDiario !== null ? Math.ceil(consumoMedioDiario * 14) : 0;
      const targetStock = Math.max(estoqueMaximoConfigurado, targetByConsumption);
      sugestaoReposicaoQtd = Math.max(1, targetStock - product.estoqueAtual);
      if (consumoMedioDiario !== null) {
        justificativaReposicao = `Estoque atual (${product.estoqueAtual}) abaixo do ideal para cobertura de 14 dias (consumo real ${consumoMedioDiario}/dia) ou máximo (${estoqueMaximoConfigurado}). Sugerida reposição de ${sugestaoReposicaoQtd} ${product.unidade}.`;
      } else {
        justificativaReposicao = `Estoque atual (${product.estoqueAtual}) igual ou próximo ao mínimo configurado (${product.estoqueMinimo}). Sugestão baseada no estoque máximo (${estoqueMaximoConfigurado}) por ausência de histórico suficiente de consumo.`;
      }
    }

    return {
      product,
      consumoMedioDiario,
      historicoSuficiente,
      motivoHistorico,
      diasCoberturaEstimada,
      diasSemMovimentacao,
      estoqueMaximoConfigurado,
      statusEstoque,
      sugestaoReposicaoQtd,
      justificativaReposicao,
    };
  });
}

export interface EvaluatedAlertCandidate {
  alertKey: string;
  modulo: 'adega' | 'tabacaria' | 'ambos';
  categoria: CommercialAlertCategory;
  prioridade: CommercialAlertPriority;
  titulo: string;
  descricao: string;
  acaoRecomendada: string;
  rotaSugerida: string;
  referenciaTipo: 'product' | 'order' | 'purchase' | 'inventory' | 'loss';
  referenciaId: string;
}

/**
 * Synchronize dynamic rule-based alerts with persisted alert resolutions.
 * Returns active + resolved alerts cleanly isolated per company.
 */
export function evaluateAndSyncAlerts(
  companyId: string,
  modulo?: 'adega' | 'tabacaria'
): { alerts: CommercialAlert[]; smartStock: SmartStockComputation[] } {
  const smartStock = computeSmartStockForCompany(companyId, modulo);
  const existingAlerts = db.commercialAlerts.filter((a) => a.companyId === companyId);
  const nowIso = new Date().toISOString();
  const candidates: EvaluatedAlertCandidate[] = [];

  // 1. Stock rupture, critical & stagnant
  for (const item of smartStock) {
    const p = item.product;
    if (item.statusEstoque === 'ruptura') {
      candidates.push({
        alertKey: `ruptura:${p.id}`,
        modulo: p.modulo,
        categoria: 'ruptura_estoque',
        prioridade: 'critica',
        titulo: `Ruptura de estoque: ${p.nome}`,
        descricao: `Produto "${p.nome}" (${p.sku}) está zerado no sistema. Risco imediato de perda de venda no PDV e pedidos.`,
        acaoRecomendada: `Gerar reposição sugerida de ${item.sugestaoReposicaoQtd} ${p.unidade}`,
        rotaSugerida: 'replenishment',
        referenciaTipo: 'product',
        referenciaId: p.id,
      });
    } else if (item.statusEstoque === 'critico') {
      candidates.push({
        alertKey: `estoque_baixo:${p.id}`,
        modulo: p.modulo,
        categoria: 'estoque_baixo',
        prioridade: 'alta',
        titulo: `Estoque crítico: ${p.nome}`,
        descricao: `Saldo atual de ${p.estoqueAtual} ${p.unidade} (mínimo ${p.estoqueMinimo})${item.diasCoberturaEstimada !== null ? ` — cobertura estimada de ${item.diasCoberturaEstimada} dias.` : '.'}`,
        acaoRecomendada: `Revisar reposição de ${item.sugestaoReposicaoQtd} ${p.unidade}`,
        rotaSugerida: 'replenishment',
        referenciaTipo: 'product',
        referenciaId: p.id,
      });
    } else if (item.statusEstoque === 'parado') {
      candidates.push({
        alertKey: `parado:${p.id}`,
        modulo: p.modulo,
        categoria: 'produto_parado',
        prioridade: 'media',
        titulo: `Capital parado: ${p.nome}`,
        descricao: `Sem movimentação há ${item.diasSemMovimentacao} dias, mantendo ${p.estoqueAtual} ${p.unidade} (R$ ${(p.estoqueAtual * p.precoCusto).toFixed(2)} em custo).`,
        acaoRecomendada: 'Avaliar ajuste de preço ou redução de compra no próximo pedido',
        rotaSugerida: 'smart_stock',
        referenciaTipo: 'product',
        referenciaId: p.id,
      });
    }

    // 2. Supplier cost increase >= 5%
    if (typeof p.custoAnterior === 'number' && p.custoAnterior > 0 && p.precoCusto > p.custoAnterior) {
      const pct = ((p.precoCusto - p.custoAnterior) / p.custoAnterior) * 100;
      if (pct >= 5) {
        candidates.push({
          alertKey: `alta_custo:${p.id}:${p.precoCusto.toFixed(2)}`,
          modulo: p.modulo,
          categoria: 'alta_custo_fornecedor',
          prioridade: pct >= 15 ? 'alta' : 'media',
          titulo: `Aumento de custo (+${pct.toFixed(1)}%): ${p.nome}`,
          descricao: `Custo subiu de R$ ${p.custoAnterior.toFixed(2)} para R$ ${p.precoCusto.toFixed(2)}. Confira se o preço de venda atual (R$ ${p.precoVenda.toFixed(2)}) preserva sua margem.`,
          acaoRecomendada: 'Revisar margem na Rentabilidade ou comparar fornecedores',
          rotaSugerida: 'profitability',
          referenciaTipo: 'product',
          referenciaId: p.id,
        });
      }
    }
  }

  // 3. Open inventory with divergences
  const openInvs = db.commercialInventories.filter(
    (inv) =>
      inv.companyId === companyId &&
      inv.status === 'conferido' &&
      inv.totalDivergencias > 0 &&
      (!modulo || inv.modulo === modulo || inv.modulo === 'ambos')
  );
  for (const inv of openInvs) {
    candidates.push({
      alertKey: `inventario_div:${inv.id}`,
      modulo: inv.modulo,
      categoria: 'divergencia_estoque',
      prioridade: 'alta',
      titulo: `Inventário ${inv.codigo} aguarda aprovação`,
      descricao: `Foram detectadas ${inv.totalDivergencias} divergência(s) entre contagem física e sistema (impacto R$ ${inv.impactoFinanceiroTotal.toFixed(2)}).`,
      acaoRecomendada: 'Auditar divergências e aprovar ajuste na aba Inventário Físico',
      rotaSugerida: 'inventory_count',
      referenciaTipo: 'inventory',
      referenciaId: inv.id,
    });
  }

  // 4. Stalled orders (> 45 min in recebido/em_separacao)
  const nowMs = Date.now();
  const activeOrders = db.commercialOrders.filter(
    (o) =>
      o.companyId === companyId &&
      (o.status === 'recebido' || o.status === 'em_separacao' || o.status === 'saiu_entrega') &&
      (!modulo || o.modulo === modulo || o.modulo === 'misto')
  );
  for (const ord of activeOrders) {
    const elapsedMin = Math.floor((nowMs - new Date(ord.iniciadoEm).getTime()) / 60000);
    if (elapsedMin >= 45) {
      candidates.push({
        alertKey: `pedido_atraso:${ord.id}`,
        modulo: ord.modulo === 'misto' ? 'ambos' : ord.modulo,
        categoria: ord.status === 'saiu_entrega' ? 'entrega_pendente' : 'pedido_pendente',
        prioridade: elapsedMin >= 90 ? 'critica' : 'alta',
        titulo: `Pedido ${ord.codigoPedido} em andamento há ${elapsedMin} min`,
        descricao: `Cliente ${ord.clienteNome} — status atual "${ord.status}".`,
        acaoRecomendada: 'Acompanhar expedição na Central de Pedidos / Entregas',
        rotaSugerida: ord.status === 'saiu_entrega' ? 'deliveries' : 'orders',
        referenciaTipo: 'order',
        referenciaId: ord.id,
      });
    }
  }

  // 5. Frequent losses in last 30 days (>= 3 losses on same product)
  const losses30d = db.commercialLosses.filter(
    (l) =>
      l.companyId === companyId &&
      nowMs - new Date(l.criadoEm).getTime() <= 30 * MS_PER_DAY &&
      (!modulo || l.modulo === modulo)
  );
  const lossByProd: Record<string, { nome: string; modulo: 'adega' | 'tabacaria'; count: number; custo: number }> = {};
  for (const l of losses30d) {
    if (!lossByProd[l.productId]) {
      lossByProd[l.productId] = { nome: l.productNome, modulo: l.modulo, count: 0, custo: 0 };
    }
    lossByProd[l.productId].count += 1;
    lossByProd[l.productId].custo += l.custoTotalImpacto;
  }
  for (const [prodId, info] of Object.entries(lossByProd)) {
    if (info.count >= 2) {
      candidates.push({
        alertKey: `perda_rec:${prodId}`,
        modulo: info.modulo,
        categoria: 'perda_recorrente',
        prioridade: info.count >= 3 ? 'alta' : 'media',
        titulo: `Perdas recorrentes: ${info.nome}`,
        descricao: `${info.count} ocorrências nos últimos 30 dias totalizando R$ ${info.custo.toFixed(2)} em custo perdido.`,
        acaoRecomendada: 'Auditar armazenamento e vencimento no Controle de Perdas',
        rotaSugerida: 'losses',
        referenciaTipo: 'loss',
        referenciaId: prodId,
      });
    }
  }

  let changed = false;
  for (const cand of candidates) {
    const existing = existingAlerts.find((a) => a.alertKey === cand.alertKey);
    if (!existing) {
      const created: CommercialAlert = {
        id: crypto.randomUUID(),
        companyId,
        ...cand,
        status: 'ativo',
        criadoEm: nowIso,
      };
      db.commercialAlerts.push(created);
      changed = true;
    } else if (existing.status === 'ativo') {
      // Refresh live description/priority cleanly if still active
      if (existing.descricao !== cand.descricao || existing.prioridade !== cand.prioridade) {
        existing.descricao = cand.descricao;
        existing.prioridade = cand.prioridade;
        existing.acaoRecomendada = cand.acaoRecomendada;
        changed = true;
      }
    }
  }

  if (changed) {
    db.save();
  }

  const allCompanyAlerts = db.commercialAlerts.filter(
    (a) =>
      a.companyId === companyId &&
      (!modulo || a.modulo === modulo || a.modulo === 'ambos')
  );

  // Sort active critical/high first, then resolved by newest
  const weight: Record<CommercialAlertPriority, number> = { critica: 4, alta: 3, media: 2, baixa: 1 };
  allCompanyAlerts.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ativo' ? -1 : 1;
    if (weight[b.prioridade] !== weight[a.prioridade]) return weight[b.prioridade] - weight[a.prioridade];
    return new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime();
  });

  return { alerts: allCompanyAlerts, smartStock };
}

/**
 * Synchronize replenishment suggestions from Smart Stock without duplicating active pending suggestions.
 */
export function syncReplenishmentSuggestions(
  companyId: string,
  modulo?: 'adega' | 'tabacaria'
): CommercialReplenishment[] {
  const smart = computeSmartStockForCompany(companyId, modulo);
  const existing = db.commercialReplenishments.filter((r) => r.companyId === companyId);
  const nowIso = new Date().toISOString();
  let changed = false;

  for (const item of smart) {
    const p = item.product;
    const activeRep = existing.find(
      (r) => r.productId === p.id && (r.status === 'pendente' || r.status === 'aprovada')
    );

    if (item.sugestaoReposicaoQtd > 0) {
      if (!activeRep) {
        const rep: CommercialReplenishment = {
          id: crypto.randomUUID(),
          companyId,
          modulo: p.modulo,
          productId: p.id,
          productNome: p.nome,
          sku: p.sku,
          estoqueAtual: p.estoqueAtual,
          estoqueMinimo: p.estoqueMinimo,
          estoqueMaximo: item.estoqueMaximoConfigurado,
          consumoMedioDiario: item.consumoMedioDiario,
          coberturaDiasEstimada: item.diasCoberturaEstimada,
          quantidadeSugerida: item.sugestaoReposicaoQtd,
          custoUnitarioEstimado: p.precoCusto,
          custoTotalEstimado: Number((item.sugestaoReposicaoQtd * p.precoCusto).toFixed(2)),
          justificativa: item.justificativaReposicao,
          fornecedorId: p.fornecedorId,
          fornecedorNome: p.fornecedorNome,
          status: 'pendente',
          criadoEm: nowIso,
        };
        db.commercialReplenishments.push(rep);
        changed = true;
      } else if (activeRep.status === 'pendente') {
        activeRep.estoqueAtual = p.estoqueAtual;
        activeRep.consumoMedioDiario = item.consumoMedioDiario;
        activeRep.coberturaDiasEstimada = item.diasCoberturaEstimada;
        activeRep.quantidadeSugerida = item.sugestaoReposicaoQtd;
        activeRep.custoTotalEstimado = Number((item.sugestaoReposicaoQtd * p.precoCusto).toFixed(2));
        activeRep.justificativa = item.justificativaReposicao;
        changed = true;
      }
    }
  }

  if (changed) {
    db.save();
  }

  return db.commercialReplenishments
    .filter((r) => r.companyId === companyId && (!modulo || r.modulo === modulo))
    .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
}

/**
 * Compute real profitability metrics (Phase 2). Strictly separates Gross Profit vs Net Profit.
 */
export function computeProfitabilityMetrics(
  companyId: string,
  params: { modulo?: 'adega' | 'tabacaria'; dataInicio?: string; dataFim?: string }
) {
  const { modulo, dataInicio, dataFim } = params;
  const products = db.commercialProducts.filter(
    (p) => p.companyId === companyId && (!modulo || p.modulo === modulo)
  );
  const sales = db.commercialSales.filter((s) => {
    if (s.companyId !== companyId || s.status !== 'concluida') return false;
    if (modulo && s.modulo !== modulo && s.modulo !== 'misto') return false;
    if (dataInicio && s.criadoEm < dataInicio) return false;
    if (dataFim && s.criadoEm > `${dataFim}T23:59:59.999Z`) return false;
    return true;
  });
  const losses = db.commercialLosses.filter((l) => {
    if (l.companyId !== companyId) return false;
    if (modulo && l.modulo !== modulo) return false;
    if (dataInicio && l.dataPerda < dataInicio) return false;
    if (dataFim && l.dataPerda > dataFim) return false;
    return true;
  });
  const purchases = db.commercialPurchases.filter((pur) => {
    if (pur.companyId !== companyId || pur.status === 'cancelado') return false;
    if (dataInicio && pur.dataCompra < dataInicio) return false;
    if (dataFim && pur.dataCompra > dataFim) return false;
    return true;
  });

  let receitaTotal = 0;
  let cmvTotal = 0;

  const byProd: Record<
    string,
    {
      productId: string;
      nome: string;
      sku: string;
      categoria: string;
      modulo: 'adega' | 'tabacaria';
      quantidadeVendida: number;
      receita: number;
      custoTotal: number;
      lucroBruto: number;
      margemVendaPercentual: number;
      markupPercentual: number;
      precoCustoAtual: number;
      precoVendaAtual: number;
    }
  > = {};

  for (const sale of sales) {
    for (const item of sale.itens) {
      const prod = products.find((p) => p.id === item.productId);
      if (modulo && prod && prod.modulo !== modulo) continue;
      if (!byProd[item.productId]) {
        byProd[item.productId] = {
          productId: item.productId,
          nome: item.nome,
          sku: item.sku,
          categoria: item.categoria,
          modulo: prod?.modulo || (modulo || 'adega'),
          quantidadeVendida: 0,
          receita: 0,
          custoTotal: 0,
          lucroBruto: 0,
          margemVendaPercentual: 0,
          markupPercentual: 0,
          precoCustoAtual: prod?.precoCusto ?? item.precoCusto,
          precoVendaAtual: prod?.precoVenda ?? item.precoUnitario,
        };
      }
      const lineCusto = Number(item.precoCusto || 0) * Number(item.quantidade || 0);
      const lineReceita = Number(item.total || 0);
      receitaTotal += lineReceita;
      cmvTotal += lineCusto;
      byProd[item.productId].quantidadeVendida += Number(item.quantidade || 0);
      byProd[item.productId].receita += lineReceita;
      byProd[item.productId].custoTotal += lineCusto;
    }
  }

  for (const row of Object.values(byProd)) {
    row.receita = Number(row.receita.toFixed(2));
    row.custoTotal = Number(row.custoTotal.toFixed(2));
    row.lucroBruto = Number((row.receita - row.custoTotal).toFixed(2));
    row.margemVendaPercentual = row.receita > 0 ? Number(((row.lucroBruto / row.receita) * 100).toFixed(1)) : 0;
    row.markupPercentual = row.custoTotal > 0 ? Number(((row.lucroBruto / row.custoTotal) * 100).toFixed(1)) : 0;
  }

  const perdasValor = Number(losses.reduce((acc, l) => acc + l.custoTotalImpacto, 0).toFixed(2));
  const lucroBrutoEstimado = Number((receitaTotal - cmvTotal).toFixed(2));
  const margemBrutaMediaPercentual =
    receitaTotal > 0 ? Number(((lucroBrutoEstimado / receitaTotal) * 100).toFixed(1)) : 0;

  // Check registered operating expenses in financialRecords for this company & period
  const registeredExpenses = db.financialRecords.filter((f) => {
    if (f.companyId !== companyId || f.tipo !== 'despesa') return false;
    if (dataInicio && f.dataCompetencia < dataInicio) return false;
    if (dataFim && f.dataCompetencia > dataFim) return false;
    return true;
  });

  const despesasOperacionaisRegistradas =
    registeredExpenses.length > 0
      ? Number(registeredExpenses.reduce((acc, f) => acc + Number(f.valor || 0), 0).toFixed(2))
      : null;

  const lucroLiquidoObservado =
    despesasOperacionaisRegistradas !== null
      ? Number((lucroBrutoEstimado - perdasValor - despesasOperacionaisRegistradas).toFixed(2))
      : null;

  const notaLucroLiquido =
    despesasOperacionaisRegistradas !== null
      ? `Lucro líquido apurado considerando ${registeredExpenses.length} despesa(s) operacional(is) registrada(s) no financeiro (R$ ${despesasOperacionaisRegistradas.toFixed(2)}) e perdas de R$ ${perdasValor.toFixed(2)}.`
      : 'Dados insuficientes para Lucro Líquido: nenhuma despesa operacional fixa/variável foi registrada no módulo Financeiro para este período. Exibindo exclusivamente o Lucro Bruto Estimado (Receita - CMV).';

  // Catalog margin analysis (for all active products even without sales)
  const catalogMargins = products
    .filter((p) => p.ativo)
    .map((p) => {
      const lucroUnitario = Number((p.precoVenda - p.precoCusto).toFixed(2));
      const margemVenda = p.precoVenda > 0 ? Number(((lucroUnitario / p.precoVenda) * 100).toFixed(1)) : 0;
      const markup = p.precoCusto > 0 ? Number(((lucroUnitario / p.precoCusto) * 100).toFixed(1)) : 0;
      return {
        productId: p.id,
        nome: p.nome,
        sku: p.sku,
        categoria: p.categoria,
        modulo: p.modulo,
        precoCusto: p.precoCusto,
        custoAnterior: p.custoAnterior,
        precoVenda: p.precoVenda,
        lucroUnitario,
        margemVendaPercentual: margemVenda,
        markupPercentual: markup,
        estoqueAtual: p.estoqueAtual,
      };
    });

  const produtosMaisRentaveis = Object.values(byProd)
    .sort((a, b) => b.lucroBruto - a.lucroBruto)
    .slice(0, 8);

  const produtosBaixaMargem = catalogMargins
    .filter((m) => m.margemVendaPercentual < 20 || m.lucroUnitario <= 0)
    .sort((a, b) => a.margemVendaPercentual - b.margemVendaPercentual);

  // Supplier cost comparison per product based on real purchase history
  const supplierCostMap: Record<
    string,
    {
      productId: string;
      productNome: string;
      suppliers: Record<string, { fornecedorId: string; fornecedorNome: string; ultimoCusto: number; menorCusto: number; maiorCusto: number; comprasQtd: number; ultimaData: string }>;
    }
  > = {};

  for (const pur of purchases) {
    for (const it of pur.itens) {
      if (!supplierCostMap[it.productId]) {
        supplierCostMap[it.productId] = { productId: it.productId, productNome: it.nome, suppliers: {} };
      }
      const key = pur.fornecedorId || pur.fornecedorNome;
      const sEntry = supplierCostMap[it.productId].suppliers[key];
      if (!sEntry) {
        supplierCostMap[it.productId].suppliers[key] = {
          fornecedorId: pur.fornecedorId,
          fornecedorNome: pur.fornecedorNome,
          ultimoCusto: it.custoUnitario,
          menorCusto: it.custoUnitario,
          maiorCusto: it.custoUnitario,
          comprasQtd: 1,
          ultimaData: pur.dataCompra,
        };
      } else {
        sEntry.comprasQtd += 1;
        if (pur.dataCompra >= sEntry.ultimaData) {
          sEntry.ultimoCusto = it.custoUnitario;
          sEntry.ultimaData = pur.dataCompra;
        }
        sEntry.menorCusto = Math.min(sEntry.menorCusto, it.custoUnitario);
        sEntry.maiorCusto = Math.max(sEntry.maiorCusto, it.custoUnitario);
      }
    }
  }

  const comparativoCustosFornecedores = Object.values(supplierCostMap).map((entry) => ({
    productId: entry.productId,
    productNome: entry.productNome,
    fornecedores: Object.values(entry.suppliers).sort((a, b) => a.ultimoCusto - b.ultimoCusto),
  }));

  return {
    periodo: { dataInicio: dataInicio || null, dataFim: dataFim || null },
    vendasAnalisadasQtd: sales.length,
    receitaTotal: Number(receitaTotal.toFixed(2)),
    cmvTotal: Number(cmvTotal.toFixed(2)),
    lucroBrutoEstimado,
    margemBrutaMediaPercentual,
    perdasQtd: losses.reduce((acc, l) => acc + l.quantidade, 0),
    perdasValor,
    despesasOperacionaisRegistradas,
    lucroLiquidoObservado,
    notaLucroLiquido,
    produtosMaisRentaveis,
    produtosBaixaMargem,
    catalogMargins,
    comparativoCustosFornecedores,
  };
}

/**
 * Parse uploaded CSV text or Base64 XLSX buffer using `xlsx` without mutating DB.
 */
export function parseSpreadsheetBuffer(params: {
  fileName: string;
  contentBase64?: string;
  csvText?: string;
}): {
  formato: 'csv' | 'xlsx';
  headers: string[];
  rows: Record<string, string>[];
} {
  const lower = (params.fileName || '').toLowerCase();
  const isCsv = lower.endsWith('.csv') || Boolean(params.csvText && !params.contentBase64);

  let workbook: XLSX.WorkBook;
  if (isCsv && params.csvText !== undefined) {
    workbook = XLSX.read(params.csvText, { type: 'string', raw: false });
  } else if (params.contentBase64) {
    const cleanB64 = params.contentBase64.includes(',')
      ? params.contentBase64.split(',')[1]
      : params.contentBase64;
    const buf = Buffer.from(cleanB64, 'base64');
    workbook = XLSX.read(buf, { type: isCsv ? 'buffer' : 'buffer', raw: false });
  } else {
    throw new Error('Arquivo vazio ou formato inválido para leitura.');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('Planilha sem abas legíveis.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rawObjects = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  if (!Array.isArray(rawObjects) || rawObjects.length === 0) {
    return { formato: isCsv ? 'csv' : 'xlsx', headers: [], rows: [] };
  }

  const headerSet = new Set<string>();
  const normalizedRows: Record<string, string>[] = rawObjects.map((row) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanKey = String(k).trim();
      headerSet.add(cleanKey);
      out[cleanKey] = v === null || v === undefined ? '' : String(v).trim();
    }
    return out;
  });

  return {
    formato: isCsv ? 'csv' : 'xlsx',
    headers: Array.from(headerSet),
    rows: normalizedRows,
  };
}

export function suggestImportColumnMapping(
  headers: string[],
  tipoAlvo: 'produtos' | 'fornecedores'
): Record<string, string> {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const normalizedHeaders = headers.map((h) => ({ raw: h, n: norm(h) }));
  const findMatch = (aliases: string[]) => {
    for (const a of aliases) {
      const hit = normalizedHeaders.find((h) => h.n === a || h.n.includes(a));
      if (hit) return hit.raw;
    }
    return '';
  };

  if (tipoAlvo === 'produtos') {
    return {
      nome: findMatch(['nome', 'produto', 'descricaoitem', 'item', 'name']),
      sku: findMatch(['sku', 'codigo', 'cod', 'referencia']),
      codigoBarras: findMatch(['codigobarras', 'ean', 'gtin', 'barras', 'barcode']),
      categoria: findMatch(['categoria', 'grupo', 'departamento', 'category']),
      marca: findMatch(['marca', 'fabricante', 'brand']),
      precoCusto: findMatch(['precocusto', 'custo', 'custounitario', 'cost']),
      precoVenda: findMatch(['precovenda', 'preco', 'valor', 'venda', 'price']),
      estoqueAtual: findMatch(['estoqueatual', 'estoque', 'quantidade', 'saldo', 'qtd', 'qty']),
      estoqueMinimo: findMatch(['estoqueminimo', 'minimo', 'min']),
      estoqueMaximo: findMatch(['estoquemaximo', 'maximo', 'max']),
      unidade: findMatch(['unidade', 'un', 'medida']),
      classificacaoLegal: findMatch(['classificacaolegal', 'restricao', 'legal', 'idade']),
    };
  }

  return {
    razaoSocial: findMatch(['razaosocial', 'razao', 'empresa', 'fornecedor', 'nome']),
    nomeFantasia: findMatch(['nomefantasia', 'fantasia', 'apelido']),
    cnpjCpf: findMatch(['cnpjcpf', 'cnpj', 'cpf', 'documento']),
    contatoNome: findMatch(['contatonome', 'contato', 'vendedor', 'representante']),
    telefone: findMatch(['telefone', 'whatsapp', 'celular', 'fone']),
    email: findMatch(['email', 'mail']),
    segmento: findMatch(['segmento', 'categoria', 'ramo']),
  };
}

export function getOrCreatePilotConfig(companyId: string): CommercialPilotConfig {
  let config = db.commercialPilotConfigs.find((c) => c.companyId === companyId);
  if (!config) {
    const company = db.companies.find((c) => c.id === companyId);
    config = {
      id: `pilot_${companyId}`,
      companyId,
      estabelecimentoNome: company?.nomeFantasia || company?.razaoSocial || 'Minha Adega & Tabacaria',
      estabelecimentoCnpj: company?.cnpj || '',
      estabelecimentoEndereco: company?.endereco || '',
      whatsappPedidos: company?.telefone || '',
      catalogoPublicoAtivo: false,
      catalogoTitulo: `${company?.nomeFantasia || 'Adega & Tabacaria'} — Catálogo`,
      checklistPassos: {
        dados_estabelecimento: { concluido: Boolean(company?.nomeFantasia) },
        equipe_perfis: { concluido: false },
        fornecedores_cadastrados: {
          concluido: db.commercialSuppliers.some((s) => s.companyId === companyId),
        },
        produtos_importados: {
          concluido: db.commercialProducts.some((p) => p.companyId === companyId),
        },
        pdv_caixa_testado: {
          concluido: db.commercialSales.some((s) => s.companyId === companyId),
        },
        catalogo_revisado: { concluido: false },
      },
      modoEspelho: {
        ativo: false,
      },
      migracao: {
        status: 'nao_iniciada',
        etapaAtual: 'preparacao',
        etapasConcluidas: [],
        conflitosDetectados: 0,
        historicoLogs: [],
      },
      atualizadoEm: new Date().toISOString(),
    };
    db.commercialPilotConfigs.push(config);
    db.save();
  }
  return config;
}
